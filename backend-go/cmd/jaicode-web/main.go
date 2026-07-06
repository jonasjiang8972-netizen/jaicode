// Jaicode Web Server - Main entry with static hosting + API
package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/internal/auth"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/upload"
)

const VERSION = "0.20.0"

var webDist embed.FS

func main() {
	port := os.Getenv("JAICODE_PORT")
	if port == "" {
		port = "3003"
	}

	sessionManager := auth.NewSessionManager(os.Getenv("JAICODE_DOMAIN"), os.Getenv("JAICODE_HTTPS") == "true")
	uploadHandler := upload.NewHandler(os.Getenv("JAICODE_UPLOAD_DIR"), 2)

	// Cleanup old uploads periodically
	go func() {
		ticker := time.NewTicker(time.Hour)
		for range ticker.C {
			uploadHandler.Cleanup(24 * time.Hour)
		}
	}()

	mux := http.NewServeMux()

	// Static files (SPA)
	webHandler := newWebHandler()
	mux.Handle("/", webHandler)

	// Auth endpoints (public)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/api/auth/login", handleLogin(sessionManager))
	mux.HandleFunc("/api/auth/logout", handleLogout(sessionManager))

	// API endpoints (authenticated via middleware)
	api := http.NewServeMux()
	api.HandleFunc("/api/chat", handleChat(sessionManager, uploadHandler))
	api.HandleFunc("/api/upload", handleUpload(uploadHandler))
	api.HandleFunc("/api/sessions", handleSessions)
	api.HandleFunc("/api/cache/stats", handleCacheStats)

	// Wrap API with auth + security middleware
	authAPI := sessionManager.Middleware(securityMiddleware(api))
	mux.Handle("/api/", authAPI)

	addr := ":" + port
	log.Printf("Jaicode Web v%s starting on http://localhost%s", VERSION, port)

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 5 * time.Minute,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

// ============ Web Static Handler ============

type webHandler struct {
	fs http.FileSystem
}

func newWebHandler() *webHandler {
	fsys, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		log.Printf("[WARN] Using disk-based web files: %v", err)
		return &webHandler{fs: http.Dir("../web/dist")}
	}
	return &webHandler{fs: http.FS(fsys)}
}

func (h *webHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	upath := r.URL.Path
	if upath == "/" {
		upath = "/index.html"
	}

	file, err := h.fs.Open(strings.TrimPrefix(upath, "/"))
	if err != nil {
		file, err = h.fs.Open("index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}
	defer file.Close()

	stat, _ := file.Stat()
	if stat.IsDir() {
		file, _ = h.fs.Open("index.html")
		defer file.Close()
	}

	w.Header().Set("Content-Type", mimeType(upath))
	http.ServeContent(w, r, upath, stat.ModTime(), file.(io.ReadSeeker))
}

func mimeType(path string) string {
	ext := strings.ToLower(path[strings.LastIndex(path, ".")+1:])
	switch ext {
	case "html":
		return "text/html"
	case "css":
		return "text/css"
	case "js":
		return "application/javascript"
	case "json":
		return "application/json"
	case "png":
		return "image/png"
	case "jpg", "jpeg":
		return "image/jpeg"
	case "svg":
		return "image/svg+xml"
	case "ico":
		return "image/x-icon"
	case "woff2":
		return "font/woff2"
	}
	return "application/octet-stream"
}

// ============ Middleware ============

func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ============ Auth Handlers ============

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","version":"%s"}`, VERSION)
}

func handleLogin(sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			APIKey   string `json:"apiKey"`
			Provider string `json:"provider"`
			Model    string `json:"model"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		if req.APIKey == "" {
			http.Error(w, `{"error":"API Key required"}`, http.StatusBadRequest)
			return
		}
		if req.Provider == "" {
			req.Provider = "anthropic"
		}
		if req.Model == "" {
			req.Model = defaultModel(req.Provider)
		}

		sessionID := sm.CreateSession(req.APIKey, req.Provider, req.Model)
		sm.SetSessionCookie(w, sessionID)

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	}
}

func handleLogout(sm *auth.SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("jaicode_session")
		if err == nil {
			sm.DeleteSession(cookie.Value)
		}
		sm.ClearSessionCookie(w)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	}
}

func defaultModel(provider string) string {
	switch provider {
	case "anthropic":
		return "claude-sonnet-4-20250514"
	case "openai":
		return "gpt-4o"
	default:
		return "gpt-4o"
	}
}

// ============ API Handlers ============

func handleChat(sm *auth.SessionManager, uh *upload.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		session, ok := auth.GetSessionFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Message  string   `json:"message"`
			Mode     string   `json:"mode"`
			Images   []string `json:"images"`
			Messages []any    `json:"messages"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		flusher := w.(http.Flusher)

		fmt.Fprintf(w, "event: start\ndata: {\"mode\":\"%s\"}\n\n", req.Mode)
		flusher.Flush()

		response := generateResponse(session, req, uh)
		chunks := splitChunks(response, 20)

		for _, chunk := range chunks {
			fmt.Fprintf(w, "event: chunk\ndata: {\"content\":\"%s\"}\n\n", escapeJSON(chunk))
			flusher.Flush()
			time.Sleep(30 * time.Millisecond)
		}

		fmt.Fprint(w, "event: done\ndata: {}\n\n")
		flusher.Flush()
	}
}

func handleUpload(uh *upload.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 3<<20)
		file, header, err := r.FormFile("image")
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
			return
		}
		defer file.Close()

		uploaded, err := uh.HandleUpload(file, header)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"id":        uploaded.ID,
			"name":      uploaded.Name,
			"size":      uploaded.Size,
			"mime_type": uploaded.MimeType,
		})
	}
}

func handleSessions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"sessions":[]}`)
}

func handleCacheStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"cache":{"hits":0,"misses":0,"tokensSaved":0}}`)
}

// ============ Helpers ============

func generateResponse(session *auth.Session, req struct {
	Message  string   `json:"message"`
	Mode     string   `json:"mode"`
	Images   []string `json:"images"`
	Messages []any    `json:"messages"`
}, uh *upload.Handler) string {
	return fmt.Sprintf("[Jaicode %s] Mode: %s | Message: %s | Images: %d",
		VERSION, req.Mode, req.Message, len(req.Images))
}

func splitChunks(s string, size int) []string {
	runes := []rune(s)
	var chunks []string
	for i := 0; i < len(runes); i += size {
		end := i + size
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[i:end]))
	}
	return chunks
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	s = strings.ReplaceAll(s, "\r", `\r`)
	return s
}
