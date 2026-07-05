// Jaicode HTTP API Server - REST + SSE for TypeScript frontend
package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/hooks"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/llm"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/mcp"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/session"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/config"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/security"
	"go.uber.org/zap"
)

type Server struct {
	fileService    *files.Service
	llmService     *llm.Service
	sessionService *session.Service
	hooksEngine    *hooks.Engine
	mcpClient      *mcp.Client
	gitOps         *git.Operations
	inputFilter    *security.InputFilter
	outputFilter   *security.OutputFilter
	log            *zap.Logger
	config         *config.Config
}

func NewServer(cfg *config.Config, log *zap.Logger) *Server {
	return &Server{
		fileService:    files.NewService(log),
		llmService:     llm.NewService(cfg, log),
		sessionService: session.NewService(log),
		hooksEngine:    hooks.NewEngine(log),
		mcpClient:      mcp.NewClient(log),
		gitOps:         git.NewOperations(log),
		inputFilter:    security.NewInputFilter(),
		outputFilter:   security.NewOutputFilter(),
		log:            log,
		config:         cfg,
	}
}

func (s *Server) Start(addr string) error {
	mux := http.NewServeMux()

	// Chat endpoint (SSE streaming)
	mux.HandleFunc("/api/chat", s.handleChat)

	// File operations
	mux.HandleFunc("/api/file/read", s.handleFileRead)
	mux.HandleFunc("/api/file/write", s.handleFileWrite)

	// Git operations
	mux.HandleFunc("/api/git/status", s.handleGitStatus)
	mux.HandleFunc("/api/git/commit", s.handleGitCommit)
	mux.HandleFunc("/api/git/branch", s.handleGitBranch)
	mux.HandleFunc("/api/git/log", s.handleGitLog)

	// Session operations
	mux.HandleFunc("/api/sessions", s.handleSessions)

	// Health check
	mux.HandleFunc("/api/health", s.handleHealth)

	// Metrics
	mux.HandleFunc("/api/metrics", s.handleMetrics)

	s.log.Info("HTTP server starting", zap.String("addr", addr))
	return http.ListenAndServe(addr, mux)
}

// ─── Chat (SSE Streaming) ──────────────────────────────
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Message  string             `json:"message"`
		Mode     string             `json:"mode"`
		Provider string             `json:"provider"`
		Messages []llm.ChatMessage  `json:"messages"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Input filter
	filterResult := s.inputFilter.Filter(req.Message)
	if filterResult.Blocked {
		http.Error(w, filterResult.Reason, http.StatusForbidden)
		return
	}

	// Set up SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// Build messages
	messages := req.Messages
	if messages == nil {
		messages = []llm.ChatMessage{}
	}
	messages = append(messages, llm.ChatMessage{Role: "user", Content: filterResult.Cleaned})

	// Get provider config
	providerCfg := s.getProviderConfig(req.Provider)

	// Stream
	stream, err := s.llmService.StreamChat(providerCfg, messages)
	if err != nil {
		fmt.Fprintf(w, "data: {\"type\":\"error\",\"error\":\"%s\"}\n\n", err.Error())
		return
	}

	flusher := w.(http.Flusher)
	for chunk := range stream {
		// Output filter
		if chunk.Type == "text" && chunk.Content != "" {
			outResult := s.outputFilter.Filter(chunk.Content)
			chunk.Content = outResult.Cleaned
		}

		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}
}

// ─── File Operations ───────────────────────────────────
func (s *Server) handleFileRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		MaxBytes int64 `json:"max_bytes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.MaxBytes == 0 {
		req.MaxBytes = 5_000_000
	}

	info, err := s.fileService.ReadFile(cwd, req.Path, req.MaxBytes)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"found": false, "error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"found":    true,
		"content":  info.Content,
		"language": info.Language,
		"lines":    info.Lines,
	})
}

func (s *Server) handleFileWrite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	result, err := s.fileService.WriteFile(cwd, req.Path, req.Content)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"size":        result.Size,
		"backup_path": result.BackupPath,
	})
}

// ─── Git Operations ────────────────────────────────────
func (s *Server) handleGitStatus(w http.ResponseWriter, r *http.Request) {
	status, err := s.gitOps.Status(cwd)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(status)
}

func (s *Server) handleGitCommit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string   `json:"message"`
		Files   []string `json:"files"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	err := s.gitOps.Commit(cwd, req.Message, req.Files)
	json.NewEncoder(w).Encode(map[string]interface{}{"success": err == nil, "error": errStr(err)})
}

func (s *Server) handleGitBranch(w http.ResponseWriter, r *http.Request) {
	result, err := s.gitOps.Branch(cwd)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleGitLog(w http.ResponseWriter, r *http.Request) {
	log, err := s.gitOps.Log(cwd, 10)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"commits": log})
}

// ─── Sessions ──────────────────────────────────────────
func (s *Server) handleSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.sessionService.List()
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": sessions})
}

// ─── Health ────────────────────────────────────────────
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": "0.14.0",
	})
}

// ─── Metrics ───────────────────────────────────────────
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uptime":  time.Now().Unix(),
		"version": "0.14.0",
	})
}

// ─── Helpers ───────────────────────────────────────────
func (s *Server) getProviderConfig(name string) llm.ProviderConfig {
	if name == "" {
		name = s.config.DefaultProvider
	}

	p, ok := s.config.Providers[name]
	if !ok {
		// Fallback to first available
		for n, prov := range s.config.Providers {
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

	return llm.ProviderConfig{
		Name:    name,
		BaseURL: baseURL,
		APIKey:  p.ApiKey,
		Model:   model,
		Format:  format,
	}
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

var cwd, _ = os.Getwd()
