// HTTP Handlers for Jaicode Go Server
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/files"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/git"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/llm"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/security"
	"go.uber.org/zap"
)

var inputFilter = security.NewInputFilter()
var outputFilter = security.NewOutputFilter()
var cwd, _ = os.Getwd()

// ─── Chat (SSE) ────────────────────────────────────────
func handleChat(w http.ResponseWriter, r *http.Request, llmSvc *llm.Service, log *zap.Logger) {
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

	// Input filter
	filterResult := inputFilter.Filter(req.Message)
	if filterResult.Blocked {
		http.Error(w, filterResult.Reason, http.StatusForbidden)
		return
	}

	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	messages := append(req.Messages, llm.ChatMessage{Role: "user", Content: filterResult.Cleaned})
	provider := getProvider()

	stream, err := llmSvc.StreamChat(provider, messages)
	if err != nil {
		fmt.Fprintf(w, "data: {\"type\":\"error\",\"error\":\"%s\"}\n\n", err.Error())
		return
	}

	flusher := w.(http.Flusher)
	for chunk := range stream {
		if chunk.Type == "text" && chunk.Content != "" {
			outResult := outputFilter.Filter(chunk.Content)
			chunk.Content = outResult.Cleaned
		}
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}
}

// ─── File Handlers ─────────────────────────────────────
func handleFileRead(svc *files.Service, log *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		info, err := svc.ReadFile(cwd, req.Path, req.MaxBytes)
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
}

func handleFileWrite(svc *files.Service, log *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST required", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		result, err := svc.WriteFile(cwd, req.Path, req.Content)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": err.Error()})
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true, "size": result.Size,
			"backup_path": result.BackupPath,
		})
	}
}

// ─── Git Handlers ──────────────────────────────────────
func handleGitStatus(gitOps *git.Operations, log *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, err := gitOps.Status(cwd)
		if err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(status)
	}
}

func handleGitCommit(gitOps *git.Operations, log *zap.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Message string   `json:"message"`
			Files   []string `json:"files"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		err := gitOps.Commit(cwd, req.Message, req.Files)
		json.NewEncoder(w).Encode(map[string]interface{}{"success": err == nil, "error": errStr(err)})
	}
}

// ─── Helpers ───────────────────────────────────────────
func getProvider() llm.ProviderConfig {
	name := os.Getenv("JAICODE_PROVIDER")
	if name == "" {
		name = "anthropic"
	}

	apiKey := os.Getenv(strings.ToUpper(name) + "_API_KEY")
	model := ""
	format := "openai"

	var baseURL string
	switch name {
	case "anthropic":
		baseURL = "https://api.anthropic.com"
		model = "claude-sonnet-4-20250514"
		format = "anthropic"
	case "openai":
		baseURL = "https://api.openai.com"
		model = "gpt-4o"
	default:
		baseURL = os.Getenv("JAIKODE_API_URL")
		model = os.Getenv("JAIKODE_MODEL")
	}

	return llm.ProviderConfig{
		Name: name,
		BaseURL: baseURL,
		APIKey: apiKey,
		Model: model,
		Format: format,
	}
}

func errStr(err error) string {
	if err == nil { return "" }
	return err.Error()
}
