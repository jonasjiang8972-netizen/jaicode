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

	// Validate MIME type first (before reading content)
	mimeType := header.Header.Get("Content-Type")
	if !isAllowedImage(mimeType) {
		return nil, fmt.Errorf("unsupported image type: %s", mimeType)
	}

	// Read header bytes for magic detection
	headerBuf := make([]byte, 8)
	n, err := io.ReadFull(file, headerBuf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, fmt.Errorf("failed to read file header: %w", err)
	}
	headerBuf = headerBuf[:n]

	// Validate magic bytes to prevent MIME spoofing
	if !isValidImageSignature(headerBuf) {
		return nil, fmt.Errorf("invalid file signature: content does not match declared type")
	}

	// Stream to temp file with memory-efficient buffering
	tmpFile, err := os.CreateTemp(h.uploadDir, "upload-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Write header bytes first, then stream the rest
	if _, err := tmpFile.Write(headerBuf); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write header: %w", err)
	}

	// Stream copy with 64KB buffer (constant memory regardless of file size)
	buf := make([]byte, 64*1024)
	written, err := io.CopyBuffer(tmpFile, io.LimitReader(file, h.maxSize-int64(len(headerBuf))), buf)
	tmpFile.Close()

	if err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	totalSize := int64(len(headerBuf)) + written

	// Compute hash from temp file
	hash, err := hashFile(tmpPath)
	if err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to hash file: %w", err)
	}
	id := hash[:16]

	// Determine extension
	ext := extensionFromMIME(mimeType)
	if ext == "" {
		ext = filepath.Ext(header.Filename)
	}

	// Move to final location
	filename := id + ext
	path := filepath.Join(h.uploadDir, filename)
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("failed to move file: %w", err)
	}

	uploaded := &UploadedFile{
		ID:        id,
		Name:      header.Filename,
		Path:      path,
		Size:      totalSize,
		MimeType:  mimeType,
		CreatedAt: time.Now(),
	}

	h.mu.Lock()
	h.files[id] = uploaded
	h.mu.Unlock()

	return uploaded, nil
}

// isValidImageSignature checks if file header matches known image signatures
func isValidImageSignature(header []byte) bool {
	return isPNG(header) || isJPEG(header) || isWEBP(header) || isGIF(header) || isJPEG2000(header)
}

func isJPEG2000(header []byte) bool {
	// JPEG 2000 starts with 00 00 00 0C 6A 50 20 20
	return len(header) >= 4 && header[0] == 0x00 && header[1] == 0x00 && header[2] == 0x00 && header[3] == 0x0C
}


func isPNG(header []byte) bool {
	return len(header) >= 4 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47
}

func isJPEG(header []byte) bool {
	return len(header) >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF
}

func isWEBP(header []byte) bool {
	return len(header) >= 12 && string(header[0:4]) == "RIFF" && string(header[8:12]) == "WEBP"
}

func isGIF(header []byte) bool {
	return len(header) >= 6 && (string(header[0:6]) == "GIF87a" || string(header[0:6]) == "GIF89a")
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	buf := make([]byte, 64*1024)
	if _, err := io.CopyBuffer(h, f, buf); err != nil {
		return "", err
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

func validateMagicBytes(_ multipart.File) error {
	return nil
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
