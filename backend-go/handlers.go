// Jaicode HTTP Handlers - Full integration of all modules
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/context"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/metrics"
)

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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	start := time.Now()

	// Input filter
	filterResult := inputFilter.Filter(req.Message)
	if filterResult.Blocked {
		auditLog.Log("input_blocked", "L0", req.Message, "DENIED", filterResult.Reason)
		http.Error(w, filterResult.Reason, http.StatusForbidden)
		return
	}
	auditLog.Log("input", "L0", fmt.Sprintf("%d chars", len(req.Message)), "ALLOWED", "")

	// Knowledge freshness check
	freshnessResult := memManager.CheckFreshness(req.Message)
	var freshnessNote string
	if freshnessResult.Modified {
		freshnessNote = "\n---\nKNOWLEDGE FRESHNESS NOTICE:\n" + freshnessResult.Hint + "\n---\n"
	}

	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	messages := append(req.Messages, llm.ChatMessage{Role: "user", Content: filterResult.Cleaned})

	// Context compaction
	if context.ShouldCompact(messagesToContext(messages), 4000) {
		compressed, _ := context.CompactMessages(messagesToContext(messages), 4000)
		messages = contextMessagesToLLM(compressed)
	}

	// Add freshness note to system message
	if freshnessNote != "" {
		messages = append([]llm.ChatMessage{{Role: "system", Content: freshnessNote}}, messages...)
	}

	// Get provider
	provider := getProvider(req.Provider)

	// Stream
	stream, err := llmSvc.StreamChat(provider, messages)
	if err != nil {
		metrics.Get().RecordError(provider.Name)
		fmt.Fprintf(w, "data: {\"type\":\"error\",\"error\":\"%s\"}\n\n", err.Error())
		return
	}

	flusher := w.(http.Flusher)
	var totalToks int
	for chunk := range stream {
		if chunk.Type == "text" && chunk.Content != "" {
			outResult := outputFilter.Filter(chunk.Content)
			chunk.Content = outResult.Cleaned
			totalToks += len(chunk.Content) / 3 // rough estimate
		}
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Record metrics
	latency := time.Since(start).Milliseconds()
	metrics.Get().RecordRequest(latency)
	metrics.Get().RecordTokens(provider.Name, len(req.Message)/4, totalToks)
	auditLog.LogWithDuration("chat", "L1", fmt.Sprintf("provider=%s, latency=%dms", provider.Name, latency), "ALLOWED", "", latency)
}

// ─── File Handlers ─────────────────────────────────────
func handleFileRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

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
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := fileSvc.WriteFile(cwd, req.Path, req.Content); err != nil {
		auditLog.LogWrite(req.Path, false, err.Error())
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	auditLog.LogWrite(req.Path, true, "")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "size": len(req.Content)})
}

// ─── Git Handlers ──────────────────────────────────────
func handleGitStatus(w http.ResponseWriter, r *http.Request) {
	status, err := gitOps.Status(cwd)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(status)
}

func handleGitCommit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string   `json:"message"`
		Files   []string `json:"files"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := gitOps.Commit(cwd, req.Message, req.Files); err != nil {
		auditLog.Log("git_commit", "L1", req.Message, "DENIED", err.Error())
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	auditLog.Log("git_commit", "L1", req.Message, "ALLOWED", "")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func handleGitBranch(w http.ResponseWriter, r *http.Request) {
	result, err := gitOps.Branch(cwd)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(result)
}

func handleGitLog(w http.ResponseWriter, r *http.Request) {
	logs, err := gitOps.Log(cwd, 10)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"commits": logs})
}

// ─── Sessions ──────────────────────────────────────────
func handleSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := sessionSvc.List()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": sessions})
}

// ─── Health & Metrics ──────────────────────────────────
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	profile, _ := memManager.LoadUserProfile()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok", "version": VERSION, "language": profile.Language,
	})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics.Get())
}

func handlePrometheus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, metrics.Get().ToPrometheus())
}

// ─── Audit ─────────────────────────────────────────────
func handleAudit(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}

	entries, err := auditLog.Query(limit)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"entries": entries})
}

// ─── Memory ────────────────────────────────────────────
func handleMemory(w http.ResponseWriter, r *http.Request) {
	mem, err := memManager.LoadProjectMemory()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(mem)
}

// ─── Compact ───────────────────────────────────────────
func handleCompact(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Messages []context.Message `json:"messages"`
		MaxTok   int              `json:"max_tokens"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.MaxTok == 0 {
		req.MaxTok = 4000
	}

	compacted, wasCompacted := context.CompactMessages(req.Messages, req.MaxTok)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"compacted":  wasCompacted,
		"messages":   compacted,
	})
}

// ─── Context ───────────────────────────────────────────
func handleContext(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	profile, _ := memManager.LoadUserProfile()
	freshness := memManager.CheckFreshness(r.URL.Query().Get("input"))

	json.NewEncoder(w).Encode(map[string]interface{}{
		"profile":      profile,
		"freshness":    freshness,
		"knowledge_cutoff": memory.KnowledgeCutoff,
	})
}

// ─── Helpers ───────────────────────────────────────────
func getProvider(name string) llm.ProviderConfig {
	if name == "" {
		name = os.Getenv("JAICODE_PROVIDER")
		if name == "" {
			name = cfg.DefaultProvider
			if name == "" {
				name = "anthropic"
			}
		}
	}

	p, ok := cfg.Providers[name]
	if !ok {
		for n, prov := range cfg.Providers {
			name = n
			p = prov
			break
		}
	}

	format := "openai"
	if name == "anthropic" {
		format = "anthropic"
	}

	model := p.Model
	if model == "" {
		if name == "anthropic" {
			model = "claude-sonnet-4-20250514"
		} else {
			model = "gpt-4o"
		}
	}

	baseURL := p.BaseURL
	if baseURL == "" {
		if name == "anthropic" {
			baseURL = "https://api.anthropic.com"
		} else {
			baseURL = "https://api.openai.com"
		}
	}

	return llm.ProviderConfig{Name: name, BaseURL: baseURL, APIKey: p.ApiKey, Model: model, Format: format}
}

func messagesToContext(msgs []llm.ChatMessage) []context.Message {
	result := make([]context.Message, len(msgs))
	for i, m := range msgs {
		result[i] = context.Message{Role: m.Role, Content: m.Content}
	}
	return result
}

func contextMessagesToLLM(msgs []context.Message) []llm.ChatMessage {
	result := make([]llm.ChatMessage, len(msgs))
	for i, m := range msgs {
		result[i] = llm.ChatMessage{Role: m.Role, Content: m.Content}
	}
	return result
}
