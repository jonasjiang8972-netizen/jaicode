// Upload Handler - Image upload with local temp storage
package upload

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Handler struct {
	mu        sync.Mutex
	uploadDir string
	maxSize   int64 // bytes
	files     map[string]*UploadedFile
}

type UploadedFile struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Path      string    `json:"-"`
	Size      int64     `json:"size"`
	MimeType  string    `json:"mime_type"`
	CreatedAt time.Time `json:"created_at"`
}

func NewHandler(uploadDir string, maxSizeMB int) *Handler {
	os.MkdirAll(uploadDir, 0755)
	return &Handler{
		uploadDir: uploadDir,
		maxSize:   int64(maxSizeMB) * 1024 * 1024,
		files:     make(map[string]*UploadedFile),
	}
}

func (h *Handler) HandleUpload(file multipart.File, header *multipart.FileHeader) (*UploadedFile, error) {
	if header.Size > h.maxSize {
		return nil, fmt.Errorf("file too large: %d bytes (max %d)", header.Size, h.maxSize)
	}

	// Read file data
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Validate MIME type
	mimeType := header.Header.Get("Content-Type")
	if !isAllowedImage(mimeType) {
		return nil, fmt.Errorf("unsupported image type: %s", mimeType)
	}

	// Generate unique ID from content hash
	hash := sha256.Sum256(data)
	id := hex.EncodeToString(hash[:16])

	// Determine extension
	ext := extensionFromMIME(mimeType)
	if ext == "" {
		ext = filepath.Ext(header.Filename)
	}

	// Save to disk
	filename := id + ext
	path := filepath.Join(h.uploadDir, filename)

	if err := os.WriteFile(path, data, 0644); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	uploaded := &UploadedFile{
		ID:        id,
		Name:      header.Filename,
		Path:      path,
		Size:      int64(len(data)),
		MimeType:  mimeType,
		CreatedAt: time.Now(),
	}

	h.mu.Lock()
	h.files[id] = uploaded
	h.mu.Unlock()

	return uploaded, nil
}

func (h *Handler) GetFile(id string) (*UploadedFile, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	file, ok := h.files[id]
	return file, ok
}

func (h *Handler) DeleteFile(id string) error {
	h.mu.Lock()
	file, ok := h.files[id]
	if ok {
		delete(h.files, id)
	}
	h.mu.Unlock()

	if ok {
		os.Remove(file.Path)
	}
	return nil
}

func (h *Handler) ReadAsBase64(id string) (string, string, error) {
	file, ok := h.GetFile(id)
	if !ok {
		return "", "", fmt.Errorf("file not found: %s", id)
	}

	data, err := os.ReadFile(file.Path)
	if err != nil {
		return "", "", err
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return encoded, file.MimeType, nil
}

func (h *Handler) Cleanup(maxAge time.Duration) {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()
	for id, file := range h.files {
		if now.Sub(file.CreatedAt) > maxAge {
			os.Remove(file.Path)
			delete(h.files, id)
		}
	}
}

func isAllowedImage(mime string) bool {
	allowed := []string{"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
	for _, a := range allowed {
		if mime == a {
			return true
		}
	}
	return false
}

func extensionFromMIME(mime string) string {
	switch mime {
	case "image/png":
		return ".png"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	}
	return ""
}
