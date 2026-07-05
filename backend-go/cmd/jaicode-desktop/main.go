// Jaicode Go Backend - Desktop Server
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/audit"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/memory"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	security "github.com/jonasjiang8972-netizen/jaicode-go/pkg/security"
)

const VERSION = "0.15.0"

var (
	cwd, _      = os.Getwd()
	log         logger.Logger
	fileSvc     *files.Service
	mgr         *memory.Manager
	auditLogger *audit.Logger
	inputFilter *security.InputFilter
)

type llmConfig struct {
	apiKey  string
	baseURL string
	model   string
	format  string
}

func main() {
	var err error
	log, err = logger.NewLogger("INFO")
	if err != nil {
		fmt.Fprintln(os.Stderr, "Logger init failed:", err)
		os.Exit(1)
	}
	defer log.Sync()

	log.Info("Jaicode Go Backend v" + VERSION)

	fileSvc = files.NewService(log)
	mgr = memory.NewManager(log, cwd)
	inputFilter = security.NewInputFilter()

	auditLogger, _ = audit.NewLogger(cwd)

	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/chat", handleChat)
	mux.HandleFunc("/api/file/read", handleFileRead)
	mux.HandleFunc("/api/file/write", handleFileWrite)
	mux.HandleFunc("/api/file/list", handleFileList)
	mux.HandleFunc("/api/git/status", handleGitStatus)
	mux.HandleFunc("/api/git/commit", handleGitCommit)
	mux.HandleFunc("/api/git/branch", handleGitBranch)
	mux.HandleFunc("/api/git/log", handleGitLog)
	mux.HandleFunc("/api/caps", handleCaps)

	srv := &http.Server{
		Addr:    ":3004",
		Handler: securityMiddleware(authMiddleware(mux)),
	}

	go func() {
		<-signalChan()
		log.Info("Shutting down...")
		srv.Close()
	}()

	log.Info("Server listening on :3004")
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Error("Server failed: " + err.Error())
	}
}

func signalChan() chan os.Signal {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	return ch
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": VERSION})
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Message  string `json:"message"`
		Mode     string `json:"mode"`
		Provider string `json:"provider"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Message == "" {
		http.Error(w, "Message required", http.StatusBadRequest)
		return
	}

	filterResult := inputFilter.Filter(req.Message)
	if filterResult.Blocked {
		http.Error(w, "Input blocked: security policy", http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher := w.(http.Flusher)

	response := processLLMRequest(filterResult.Cleaned, req.Provider, req.Mode)
	for _, chunk := range splitLines(response) {
		fmt.Fprintf(w, "data: {\"type\":\"text\",\"content\":\"%s\\n\"}\n\n", escapeSSE(chunk))
		flusher.Flush()
		time.Sleep(15 * time.Millisecond)
	}
	fmt.Fprint(w, "data: {\"type\":\"done\"}\n\n")
	flusher.Flush()
}

func handleFileRead(w http.ResponseWriter, r *http.Request) {
	var req struct{ Path string `json:"path"` }
	json.NewDecoder(r.Body).Decode(&req)

	if !mgr.IsPathAllowed(req.Path) {
		http.Error(w, "Path not allowed", http.StatusForbidden)
		return
	}

	info, err := fileSvc.ReadFile(cwd, req.Path, 5000000)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"found": false, "error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found": true, "content": info.Content, "language": info.Language, "lines": info.Lines,
	})
}

func handleFileWrite(w http.ResponseWriter, r *http.Request) {
	var req struct{ Path, Content string }
	json.NewDecoder(r.Body).Decode(&req)

	if !mgr.IsPathAllowed(req.Path) {
		http.Error(w, "Path not allowed", http.StatusForbidden)
		return
	}

	result, err := fileSvc.WriteFile(cwd, req.Path, req.Content)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	auditLogger.LogWrite(req.Path, true, "")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "size": result.Size})
}

func handleFileList(w http.ResponseWriter, r *http.Request) {
	entries, _ := mgr.ListEntries(cwd)
	json.NewEncoder(w).Encode(map[string]interface{}{"entries": entries})
}

func handleGitStatus(w http.ResponseWriter, r *http.Request) {
	result, _ := git.NewOperations(log).Status(cwd)
	json.NewEncoder(w).Encode(result)
}

func handleGitCommit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string   `json:"message"`
		Files   []string `json:"files"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	err := git.NewOperations(log).Commit(cwd, req.Message, req.Files)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": err == nil, "error": errStr(err)})
}

func handleGitBranch(w http.ResponseWriter, r *http.Request) {
	b, _ := git.NewOperations(log).Branch(cwd)
	json.NewEncoder(w).Encode(b)
}

func handleGitLog(w http.ResponseWriter, r *http.Request) {
	l, _ := git.NewOperations(log).Log(cwd, 10)
	json.NewEncoder(w).Encode(map[string]interface{}{"commits": l})
}

func handleCaps(w http.ResponseWriter, r *http.Request) {
	caps := []map[string]string{
		{"id": "file-read", "name": "文件读取", "status": "available"},
		{"id": "file-write", "name": "文件写入", "status": "available"},
		{"id": "chat", "name": "LLM 对话", "status": "available"},
		{"id": "git", "name": "Git 操作", "status": "available"},
		{"id": "context", "name": "上下文管理", "status": "available"},
		{"id": "security", "name": "安全过滤", "status": "available"},
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"version": VERSION, "capabilities": caps,
		"summary": map[string]int{"total": len(caps), "available": len(caps)},
	})
}

func processLLMRequest(message, provider, mode string) string {
	cfg := getProviderConfig(provider)
	if cfg.apiKey == "" {
		return "未配置 API Key。请运行: jaicode config --provider " + provider + " --api-key <your-key>"
	}

	messages := []map[string]string{
		{"role": "system", "content": getSystemPrompt(mode)},
		{"role": "user", "content": message},
	}

	if cfg.format == "anthropic" {
		return callAnthropic(cfg, messages)
	}
	return callOpenAI(cfg, messages)
}

func getProviderConfig(name string) llmConfig {
	if name == "" {
		name = os.Getenv("JAICODE_PROVIDER")
		if name == "" {
			name = "custom"
		}
	}

	apiKey := os.Getenv(strings.ToUpper(name) + "_API_KEY")
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}

	var baseURL, model, format string
	switch name {
	case "anthropic":
		baseURL, model, format = "https://api.anthropic.com", "claude-sonnet-4-20250514", "anthropic"
	case "openai":
		baseURL, model, format = "https://api.openai.com", "gpt-4o", "openai"
	default:
		baseURL, model, format = os.Getenv("JAICODE_API_URL"), os.Getenv("JAICODE_MODEL"), "openai"
		if baseURL == "" {
			baseURL = "https://api.longcat.chat/openai"
			model = "LongCat-2.0"
		}
	}

	return llmConfig{apiKey: apiKey, baseURL: baseURL, model: model, format: format}
}

func callAnthropic(cfg llmConfig, messages []map[string]string) string {
	body := map[string]interface{}{
		"model": cfg.model, "max_tokens": 4096, "stream": true,
		"system": messages[0]["content"], "messages": messages[1:],
	}
	bodyJSON, _ := json.Marshal(body)

	var resp *http.Response
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequest("POST", cfg.baseURL+"/v1/messages", bytes.NewReader(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-api-key", cfg.apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")

		client := &http.Client{Timeout: 60 * time.Second}
		resp, err = client.Do(req)
		if err == nil && resp.StatusCode == 200 {
			break
		}
		time.Sleep(time.Duration(attempt+1) * time.Second)
	}

	if err != nil || resp.StatusCode != 200 {
		return fmt.Sprintf("Error: Anthropic API %s", errStr(err))
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	var fullContent strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			break
		}
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Type  string `json:"type"`
			Delta struct {
				Text string `json:"text"`
			} `json:"delta"`
		}
		if json.Unmarshal([]byte(data), &chunk) == nil && chunk.Delta.Text != "" {
			fullContent.WriteString(chunk.Delta.Text)
		}
	}
	return fullContent.String()
}

func callOpenAI(cfg llmConfig, messages []map[string]string) string {
	body := map[string]interface{}{
		"model": cfg.model, "max_tokens": 4096, "stream": true, "messages": messages,
	}
	bodyJSON, _ := json.Marshal(body)

	var resp *http.Response
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequest("POST", cfg.baseURL+"/v1/chat/completions", bytes.NewReader(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+cfg.apiKey)

		client := &http.Client{Timeout: 60 * time.Second}
		resp, err = client.Do(req)
		if err == nil && resp.StatusCode == 200 {
			break
		}
		time.Sleep(time.Duration(attempt+1) * time.Second)
	}

	if err != nil || resp.StatusCode != 200 {
		return fmt.Sprintf("Error: OpenAI API %s", errStr(err))
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	var fullContent strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err == io.EOF {
			break
		}
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if json.Unmarshal([]byte(data), &chunk) == nil && len(chunk.Choices) > 0 {
			fullContent.WriteString(chunk.Choices[0].Delta.Content)
		}
	}
	return fullContent.String()
}

func getSystemPrompt(mode string) string {
	prompts := map[string]string{
		"plan":  "你是架构设计专家。生成架构决策记录（ADR）。",
		"code":  "你是编程助手。输出 FILE: 格式的代码变更。",
		"debug": "你是调试助手。分析错误并提供修复。",
		"ask":   "你是问答助手。简洁回答。",
	}
	if p, ok := prompts[mode]; ok {
		return p
	}
	return prompts["code"]
}

// ─── Security Middleware ─────────────────────────────────

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" || r.URL.Path == "/api/caps" {
			next.ServeHTTP(w, r)
			return
		}

		apiKey := os.Getenv("JAICODE_API_KEY")
		if apiKey != "" {
			auth := r.Header.Get("Authorization")
			if auth != "Bearer "+apiKey {
				http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost"
		}
		origin := r.Header.Get("Origin")
		if origin != "" {
			for _, allowed := range strings.Split(allowedOrigins, ",") {
				if origin == allowed {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ─── Helpers ─────────────────────────────────────────────

func splitLines(s string) []string {
	return strings.Split(s, "\n")
}

func escapeSSE(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
