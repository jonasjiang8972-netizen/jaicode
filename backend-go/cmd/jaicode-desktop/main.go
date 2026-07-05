// Jaicode Desktop Backend (v1.0.0)
// Optimized for Tauri desktop integration
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
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

const VERSION = "1.0.0"

var (
	cwd, _       = os.Getwd()
	log          logger.Logger
	fileSvc      *files.Service
	llmSvc       *llm.Service
	sessionSvc   *session.Service
	hooksEngine  *hooks.Engine
	mcpClient    *mcp.Client
	gitOps       *git.Operations
	auditLog     *audit.Logger
	memMgr       *memory.Manager
	vlAnalyzer   *vl.Analyzer
	webServer    *web.Server
	agentPool    *agents.AgentPool
	inputFilter  *security.InputFilter
	outputFilter *security.OutputFilter
)

func main() {
	var err error

	log, err = logger.NewLogger(getEnv("JAICODE_LOG_LEVEL", "INFO"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "Logger init failed:", err)
		os.Exit(1)
	}
	defer log.Sync()

	log.Info("Jaicode Desktop Backend v" + VERSION)
	log.Info("Working directory: " + cwd)

	initServices()
	setupRoutes()

	port := getPort()
	health()

	srv := &http.Server{Addr: ":" + strconv.Itoa(port), Handler: router()}

	go func() {
		<-signalChan()
		log.Info("Shutting down Jaicode Desktop Backend...")
		auditLog.Log("shutdown", "system", "graceful", "ALLOWED", "")
		srv.Close()
	}()

	log.Info("Jaicode Desktop Backend ready on port " + strconv.Itoa(port))
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Error("Server failed: " + err.Error())
	}
}

func initServices() {
	fileSvc = files.NewService(log)
	llmSvc = llm.NewService(log)
	sessionSvc = session.NewService(log)
	hooksEngine = hooks.NewEngine(log)
	mcpClient = mcp.NewClient(log)
	gitOps = git.NewOperations(log)
	memMgr = memory.NewManager(log, cwd)
	vlAnalyzer = vl.NewAnalyzer(log)
	webServer = web.NewServer(log)
	agentPool = agents.NewPool(log, 4)
	inputFilter = security.NewInputFilter()
	outputFilter = security.NewOutputFilter()

	var err error
	auditLog, err = audit.NewLogger(cwd)
	if err != nil {
		log.Warn("Audit logger init failed: " + err.Error())
	}
	defer auditLog.Close()

	if info, err := memMgr.AutoScan(); err == nil {
		log.Info(fmt.Sprintf("Project scanned: %s (%s)", info.Name, strings.Join(info.TechStack, ", ")))
	}
}

func setupRoutes() {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/chat", handleChat)
	mux.HandleFunc("/api/file/read", handleFileRead)
	mux.HandleFunc("/api/file/write", handleFileWrite)
	mux.HandleFunc("/api/file/list", handleFileList)
	mux.HandleFunc("/api/git/status", handleGitStatus)
	mux.HandleFunc("/api/git/commit", handleGitCommit)
	mux.HandleFunc("/api/git/branch", handleGitBranch)
	mux.HandleFunc("/api/git/log", handleGitLog)
	mux.HandleFunc("/api/git/diff", handleGitDiff)
	mux.HandleFunc("/api/sessions", handleSessions)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/audit", handleAudit)
	mux.HandleFunc("/api/memory", handleMemory)
	mux.HandleFunc("/api/compact", handleCompact)
	mux.HandleFunc("/api/caps", handleCaps)
	mux.HandleFunc("/api/vl/analyze", handleVLAnalyze)
	mux.HandleFunc("/api/web/start", handleWebStart)
	mux.HandleFunc("/api/web/stop", handleWebStop)
	mux.HandleFunc("/api/agents/execute", handleAgentsExecute)
	mux.HandleFunc("/api/hooks", handleHooks)
	mux.HandleFunc("/api/hooks/test", handleHooksTest)
	mux.HandleFunc("/api/mcp/servers", handleMCPServers)
	mux.HandleFunc("/api/mcp/connect", handleMCPConnect)
	mux.HandleFunc("/api/command", handleCommand)
	mux.HandleFunc("/api/context", handleContext)
	mux.HandleFunc("/api/metrics", handleMetrics)
	mux.HandleFunc("/api/metrics/prometheus", handlePrometheus)
	mux.HandleFunc("/api/config", handleConfig)

	// Serve frontend in production
	mux.Handle("/", http.FileServer(http.Dir("./static")))
}

func router() http.Handler {
	return http.DefaultServeMux
}

// ─── Handlers ──────────────────────────────────────────
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

	// Freshness
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
	var totalToks int
	for chunk := range stream {
		if chunk.Type == "text" && chunk.Content != "" {
			or := outputFilter.Filter(chunk.Content)
			chunk.Content = or.Cleaned
			totalToks += len(chunk.Content) / 3
		}
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	metrics.Get().RecordRequest(time.Since(start).Milliseconds(), provider.Name)
	metrics.Get().RecordTokens(int64(len(req.Message)/4), int64(totalToks))
	auditLog.Log("chat", "L1", "provider="+provider.Name, "ALLOWED", "")
}

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

func handleFileList(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = cwd
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	var names []string
	for _, e := range entries {
		prefix := ""
		if e.IsDir() {
			prefix = "[D] "
		}
		names = append(names, prefix+e.Name())
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"path": path, "entries": names})
}

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

func handleGitDiff(w http.ResponseWriter, r *http.Request) {
	file := r.URL.Query().Get("file")
	cmd := "git diff"
	if file != "" {
		cmd += " -- " + file
	}
	out := runShell(cmd, cwd)
	json.NewEncoder(w).Encode(map[string]interface{}{"diff": out})
}

func handleSessions(w http.ResponseWriter, r *http.Request) {
	ss, _ := sessionSvc.List()
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": ss})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
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

func handleCompact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Messages []context.Message `json:"messages"`
		MaxTok   int              `json:"max_tokens"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.MaxTok == 0 {
		req.MaxTok = 4000
	}
	compacted, wasCompacted := context.Compact(req.Messages, req.MaxTok)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"compacted": wasCompacted, "messages": compacted,
	})
}

func handleCaps(w http.ResponseWriter, r *http.Request) {
	result := capabilities.Audit()
	result["project"] = capabilities.DetectProject()
	json.NewEncoder(w).Encode(result)
}

func handleVLAnalyze(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ImagePath string `json:"image_path"`
		Filename  string `json:"filename"`
		Base64    string `json:"base64"`
		MimeType  string `json:"mime_type"`
		Prompt    string `json:"prompt"`
		Provider  string `json:"provider"`
		APIKey    string `json:"api_key"`
		Model     string `json:"model"`
		BaseURL   string `json:"base_url"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	result := map[string]interface{}{}
	if req.Filename != "" {
		analysis, err := vlAnalyzer.AnalyzeImage(req.Filename, req.Prompt, req.Provider, req.APIKey, req.Model, req.BaseURL)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["description"] = analysis.Description
		}
	} else if req.Base64 != "" {
		if req.MimeType == "" {
			req.MimeType = "image/png"
		}
		analysis, err := vlAnalyzer.AnalyzeImageBase64(req.Base64, req.MimeType, req.Prompt, req.Provider, req.APIKey, req.Model, req.BaseURL)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["description"] = analysis.Description
		}
	} else {
		result["error"] = "No image provided"
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

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
		go webServer.Start(req.Port, req.WorkDir)
		result["status"] = "starting"
		result["url"] = fmt.Sprintf("http://localhost:%d", req.Port)
	}
	json.NewEncoder(w).Encode(result)
}

func handleWebStop(w http.ResponseWriter, r *http.Request) {
	webServer.Stop()
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "stopped"})
}

func handleAgentsExecute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Description string   `json:"description"`
		Tasks       []string `json:"tasks"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	result := map[string]interface{}{}
	if len(req.Tasks) > 1 {
		results, err := agentPool.ExecuteParallel(req.Tasks)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["results"] = results
			result["mode"] = "parallel"
		}
	} else if req.Description != "" {
		res, err := agentPool.Execute(req.Description)
		if err != nil {
			result["error"] = err.Error()
		} else {
			result["result"] = res
			result["mode"] = "single"
		}
	} else {
		result["error"] = "No description or tasks"
	}
	json.NewEncoder(w).Encode(result)
}

func handleHooks(w http.ResponseWriter, r *http.Request) {
	// Return hooks configuration
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "hooks API ready"})
}

func handleHooksTest(w http.ResponseWriter, r *http.Request) {
	results := hooksEngine.Execute("session-start", cwd, nil)
	json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
}

func handleMCPServers(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"servers": []string{}})
}

func handleMCPConnect(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "MCP connect ready"})
}

func handleCommand(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Command string `json:"command"`
		WorkDir string `json:"work_dir"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.WorkDir == "" {
		req.WorkDir = cwd
	}
	output := runShell(req.Command, req.WorkDir)
	json.NewEncoder(w).Encode(map[string]interface{}{"output": output})
}

func handleContext(w http.ResponseWriter, r *http.Request) {
	profile, _ := memMgr.LoadUserProfile()
	freshness := memMgr.CheckFreshness(r.URL.Query().Get("input"))
	json.NewEncoder(w).Encode(map[string]interface{}{
		"profile": profile, "freshness": freshness,
		"knowledge_cutoff": memory.KnowledgeCutoff,
	})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(metrics.Get())
}

func handlePrometheus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, metrics.Get().ToPrometheus())
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"version": VERSION,
		"cwd": cwd,
		"platform": map[string]interface{}{
			"arch": "x86_64",
			"os": "linux",
		},
	})
}

// ─── SSE Chat Simplified ───────────────────────────────
func handleChatSimple(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", 405)
		return
	}
	var req struct{ Message string `json:"message"` }
	json.NewDecoder(r.Body).Decode(&req)
	if filter := inputFilter.Filter(req.Message); filter.Blocked {
		http.Error(w, filter.Reason, 403)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	fmt.Fprintf(w, "data: {\"type\":\"text\",\"content\":\"Jaicode %s is ready.\\nMessage: %s\"}\n\n", VERSION, req.Message)
	fmt.Fprintf(w, "data: {\"type\":\"done\"}\n\n")
	w.(http.Flusher).Flush()
}

func handleFileReadSimple(w http.ResponseWriter, r *http.Request) {
	var req struct{ Path string `json:"path"` }
	json.NewDecoder(r.Body).Decode(&req)
	data, err := os.ReadFile(filepath.Join(cwd, req.Path))
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	w.Write(data)
}

// ─── Helpers ───────────────────────────────────────────
func getPort() int {
	if p := os.Getenv("JAICODE_PORT"); p != "" {
		if port, err := strconv.Atoi(p); err == nil {
			return port
		}
	}
	return 3003
}

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
		baseURL = "https://api.anthropic.com"
		model = "claude-sonnet-4-20250514"
		format = "anthropic"
	case "openai":
		baseURL = "https://api.openai.com"
		model = "gpt-4o"
		format = "openai"
	default:
		baseURL = getEnv("JAICODE_API_URL", "https://api.longcat.chat/openai")
		model = getEnv("JAICODE_MODEL", "LongCat-2.0")
		format = "openai"
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

func runShell(cmd, dir string) string {
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		return ""
	}
	c := exec.Command(parts[0], parts[1:]...)
	c.Dir = dir
	out, _ := c.CombinedOutput()
	return strings.TrimSpace(string(out))
}

func signalCh() chan os.Signal {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	return ch
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func executeHooks(w http.ResponseWriter, r *http.Request) {
	// Implementation for hooks execution
	results := hooksEngine.Execute("session-start", cwd, map[string][]string{})
	json.NewEncoder(w).Encode(results)
}

func health() {
	log.Info("Initializing Jaicode Desktop Backend v" + VERSION)
}

var _ = executeHooks
