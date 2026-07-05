// Jaicode Go Backend - Main Entry Point (v0.14.0)
// Single binary, no external runtime dependencies
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/agents"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/audit"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/capabilities"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/context"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/hooks"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/llm"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/mcp"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/memory"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/metrics"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/session"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/vl"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/web"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/security"
)

const VERSION = "0.15.0"

var (
	cwd, _      = os.Getwd()
	log         logger.Logger
	fileSvc     *files.Service
	llmSvc      *llm.Service
	sessionSvc  *session.Service
	hooksEngine *hooks.Engine
	mcpClient   *mcp.Client
	gitOps      *git.Operations
	auditLog    *audit.Logger
	memMgr      *memory.Manager
	inputFilter *security.InputFilter
	outputFiltr *security.OutputFilter
	vlAnalyzer  *vl.Analyzer
	webServer   *web.Server
	agentPool   *agents.AgentPool
)

func main() {
	var err error

	// Logger
	log, err = logger.NewLogger("INFO")
	if err != nil {
		fmt.Fprintln(os.Stderr, "Logger init failed:", err)
		os.Exit(1)
	}
	defer log.Sync()

	log.Info("Jaicode Go Backend starting")

	// Services
	fileSvc = files.NewService(log)
	llmSvc = llm.NewService(log)
	sessionSvc = session.NewService(log)
	hooksEngine = hooks.NewEngine(log)
	mcpClient = mcp.NewClient(log)
	gitOps = git.NewOperations(log)
	inputFilter = security.NewInputFilter()
	outputFiltr = security.NewOutputFilter()

	var auditErr error
	auditLog, auditErr = audit.NewLogger(cwd)
	if auditErr != nil {
		log.Warn("Audit logger init failed: " + auditErr.Error())
	}
	defer auditLog.Close()

	memMgr = memory.NewManager(log, cwd)
	vlAnalyzer = vl.NewAnalyzer(log)
	webServer = web.NewServer(log)
	agentPool = agents.NewPool(log, 4)

	// Routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/chat", handleChat)
	mux.HandleFunc("/api/file/read", handleFileRead)
	mux.HandleFunc("/api/file/write", handleFileWrite)
	mux.HandleFunc("/api/git/status", handleGitStatus)
	mux.HandleFunc("/api/git/commit", handleGitCommit)
	mux.HandleFunc("/api/git/branch", handleGitBranch)
	mux.HandleFunc("/api/git/log", handleGitLog)
	mux.HandleFunc("/api/sessions", handleSessions)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/audit", handleAudit)
	mux.HandleFunc("/api/memory", handleMemory)
	mux.HandleFunc("/api/vl/analyze", handleVLAnalyze)
	mux.HandleFunc("/api/web/start", handleWebStart)
	mux.HandleFunc("/api/web/stop", handleWebStop)
	mux.HandleFunc("/api/agents/execute", handleAgentsExecute)
	mux.HandleFunc("/api/caps", handleCaps)
	mux.HandleFunc("/metrics", handleMetrics)

	srv := &http.Server{Addr: ":3003", Handler: mux}

	// Graceful shutdown
	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
		<-ch
		log.Info("Shutting down...")
		srv.Close()
	}()

	log.Info("Jaicode Go Backend ready on port 3003")
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Error("Server failed: " + err.Error())
	}
}

// ─── Chat (SSE) ────────────────────────────────────────
func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Message  string            `json:"message"`
		Mode     string            `json:"mode"`
		Provider string            `json:"provider"`
		Messages []llm.ChatMessage `json:"messages"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	start := time.Now()

	// Input filter
	fr := inputFilter.Filter(req.Message)
	if fr.Blocked {
		auditLog.Log("input_blocked", "L0", req.Message[:min(100, len(req.Message))], "DENIED", fr.Reason)
		http.Error(w, fr.Reason, http.StatusForbidden)
		return
	}

	// Knowledge freshness
	fresh := memMgr.CheckFreshness(req.Message)
	var freshnessNote string
	if fresh.Modified {
		freshnessNote = "\n---\nKNOWLEDGE FRESHNESS:\n" + fresh.Hint + "\n---\n"
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")

	messages := append(req.Messages, llm.ChatMessage{Role: "user", Content: fr.Cleaned})
	if freshnessNote != "" {
		messages = append([]llm.ChatMessage{{Role: "system", Content: freshnessNote}}, messages...)
	}

	// Context compaction
	if context.ShouldCompact(messagesToCtx(messages), 4000) {
		comp, _ := context.Compact(messagesToCtx(messages), 4000)
		messages = ctxToMessages(comp)
	}

	provider := getProvider(req.Provider)
	stream, err := llmSvc.StreamChat(provider, messages)
	if err != nil {
		metrics.Get().RecordError()
		fmt.Fprintf(w, "data: {\"type\":\"error\",\"error\":\"%s\"}\n\n", err.Error())
		return
	}

	flusher := w.(http.Flusher)
	for chunk := range stream {
		if chunk.Type == "text" && chunk.Content != "" {
			or := outputFiltr.Filter(chunk.Content)
			chunk.Content = or.Cleaned
		}
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	metrics.Get().RecordRequest(time.Since(start).Milliseconds(), provider.Name)
	auditLog.Log("chat", "L1", "provider="+provider.Name, "ALLOWED", "")
}

// ─── File Handlers ─────────────────────────────────────
func handleFileRead(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path     string `json:"path"`
		MaxBytes int64  `json:"max_bytes"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.MaxBytes == 0 {
		req.MaxBytes = 5_000_000
	}
	info, err := fileSvc.ReadFile(cwd, req.Path, req.MaxBytes)
	if err != nil {
		auditLog.LogRead(req.Path, false, err.Error())
		json.NewEncoder(w).Encode(map[string]interface{}{"found": false, "error": err.Error()})
		return
	}
	auditLog.LogRead(req.Path, true, "")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"found": true, "content": info.Content, "language": info.Language, "lines": info.Lines,
	})
}

func handleFileWrite(w http.ResponseWriter, r *http.Request) {
	var req struct{ Path, Content string }
	json.NewDecoder(r.Body).Decode(&req)
	result, err := fileSvc.WriteFile(cwd, req.Path, req.Content)
	if err != nil {
		auditLog.LogWrite(req.Path, false, err.Error())
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}
	auditLog.LogWrite(req.Path, true, "")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "size": result.Size})
}

// ─── Git Handlers ──────────────────────────────────────
func handleGitStatus(w http.ResponseWriter, r *http.Request) {
	s, _ := gitOps.Status(cwd)
	json.NewEncoder(w).Encode(s)
}

func handleGitCommit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string   `json:"message"`
		Files   []string `json:"files"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	err := gitOps.Commit(cwd, req.Message, req.Files)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": err == nil, "error": errStr(err)})
}

func handleGitBranch(w http.ResponseWriter, r *http.Request) {
	b, _ := gitOps.Branch(cwd)
	json.NewEncoder(w).Encode(b)
}

func handleGitLog(w http.ResponseWriter, r *http.Request) {
	l, _ := gitOps.Log(cwd, 10)
	json.NewEncoder(w).Encode(map[string]interface{}{"commits": l})
}

// ─── Sessions / Health / Audit / Metrics ───────────────
func handleSessions(w http.ResponseWriter, r *http.Request) {
	ss, _ := sessionSvc.List()
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": ss})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": VERSION})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}
	entries, _ := auditLog.Query(limit)
	json.NewEncoder(w).Encode(map[string]interface{}{"entries": entries})
}

func handleMemory(w http.ResponseWriter, r *http.Request) {
	mem, err := memMgr.LoadProjectMemory()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(mem)
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(metrics.Get())
}

// ─── Helpers ───────────────────────────────────────────
func getProvider(name string) llm.ProviderConfig {
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

	return llm.ProviderConfig{Name: name, BaseURL: baseURL, APIKey: apiKey, Model: model, Format: format}
}

func messagesToCtx(msgs []llm.ChatMessage) []context.Message {
	r := make([]context.Message, len(msgs))
	for i, m := range msgs {
		r[i] = context.Message{Role: m.Role, Content: m.Content}
	}
	return r
}

func ctxToMessages(msgs []context.Message) []llm.ChatMessage {
	r := make([]llm.ChatMessage, len(msgs))
	for i, m := range msgs {
		r[i] = llm.ChatMessage{Role: m.Role, Content: m.Content}
	}
	return r
}

// ─── VL Image Analysis ─────────────────────────────────
func handleVLAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ImagePath string `json:"image_path"`
		Prompt    string `json:"prompt"`
		Provider  string `json:"provider"`
		APIKey    string `json:"api_key"`
		Model     string `json:"model"`
		BaseURL   string `json:"base_url"`
		Filename  string `json:"filename"`
		Base64    string `json:"base64"`
		MimeType  string `json:"mime_type"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	result := map[string]interface{}{}

	if req.Filename != "" {
		// Analyze from file path
		analysis, err := vlAnalyzer.AnalyzeImage(req.Filename, req.Prompt, req.Provider, req.APIKey, req.Model, req.BaseURL)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["description"] = analysis.Description
			result["model"] = analysis.Model
			result["provider"] = analysis.Provider
		}
	} else if req.Base64 != "" {
		// Analyze from base64 data
		if req.MimeType == "" {
			req.MimeType = "image/png"
		}
		analysis, err := vlAnalyzer.AnalyzeImageBase64(req.Base64, req.MimeType, req.Prompt, req.Provider, req.APIKey, req.Model, req.BaseURL)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["description"] = analysis.Description
			result["model"] = analysis.Model
			result["provider"] = analysis.Provider
		}
	} else {
		result["error"] = "No image provided. Send image_path, filename, or base64."
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ─── Web Terminal ──────────────────────────────────────
func handleWebStart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Port    int    `json:"port"`
		WorkDir string `json:"work_dir"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	result := map[string]interface{}{}

	if !web.IsTtydAvailable() {
		result["error"] = "ttyd not installed"
		result["install"] = web.InstallInstructions()
	} else {
		go func() {
			err := webServer.Start(req.Port, req.WorkDir)
			if err != nil {
				log.Error("Web terminal failed: " + err.Error())
			}
		}()
		result["status"] = "starting"
		result["url"] = fmt.Sprintf("http://localhost:%d", req.Port)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleWebStop(w http.ResponseWriter, r *http.Request) {
	webServer.Stop()
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "stopped"})
}

// ─── Sub-Agents ───────────────────────────────────────
func handleAgentsExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Description string   `json:"description"`
		Tasks       []string `json:"tasks"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	result := map[string]interface{}{}

	if len(req.Tasks) > 1 {
		// Parallel execution
		results, err := agentPool.ExecuteParallel(req.Tasks)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["results"] = results
			result["mode"] = "parallel"
		}
	} else if req.Description != "" {
		// Single task
		res, err := agentPool.Execute(req.Description)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["result"] = res
			result["mode"] = "single"
		}
	} else {
		result["error"] = "No description or tasks provided"
		result["pool_status"] = agentPool.GetStatus()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ─── Capabilities Audit ────────────────────────────────
func handleCaps(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	result := capabilities.Audit()
	result["project"] = capabilities.DetectProject()
	json.NewEncoder(w).Encode(result)
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
