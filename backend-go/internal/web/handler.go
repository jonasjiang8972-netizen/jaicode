// Web Static Handler - go:embed static file serving
package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed all:dist/*
var staticFiles embed.FS

type Handler struct {
	fs http.FileSystem
}

func NewHandler() *Handler {
	subFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		// Fallback to dist directory on disk for development
		return &Handler{fs: http.Dir("./dist")}
	}
	return &Handler{fs: http.FS(subFS)}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	upath := r.URL.Path
	if !strings.HasPrefix(upath, "/") {
		upath = "/" + upath
	}
	upath = path.Clean(upath)

	// Try to serve the file
	file, err := h.fs.Open(upath)
	if err != nil {
		// Fall back to index.html for SPA routing
		file, err = h.fs.Open("/index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}
	defer file.Close()

	// Get file info for content type
	stat, err := file.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Don't serve directories
	if stat.IsDir() {
		file, err = h.fs.Open(path.Join(upath, "index.html"))
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
	}

	// Set content type
	contentType := mimeType(path.Ext(upath))
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	// Serve the file
	http.ServeContent(w, r, upath, stat.ModTime(), file.(io.ReadSeeker))
}

func mimeType(ext string) string {
	switch strings.ToLower(ext) {
	case ".html":
		return "text/html"
	case ".css":
		return "text/css"
	case ".js":
		return "application/javascript"
	case ".json":
		return "application/json"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff2":
		return "font/woff2"
	}
	return ""
}
