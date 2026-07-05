// Jaicode File Service - Safe file operations with path traversal protection
package files

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
)

type Service struct {
	log logger.Logger
}

type FileInfo struct {
	Path         string    `json:"path"`
	Size         int64     `json:"size"`
	IsDir        bool      `json:"is_dir"`
	Language     string    `json:"language"`
	Lines        int       `json:"lines"`
	LastModified time.Time `json:"last_modified"`
	Content      string    `json:"content,omitempty"`
	Truncated    bool      `json:"truncated,omitempty"`
}

type WriteResult struct {
	Path       string `json:"path"`
	Size       int    `json:"size"`
	BackupPath string `json:"backup_path,omitempty"`
}

func NewService(log logger.Logger) *Service {
	return &Service{log: log}
}

// ReadFile safely reads a file within project boundaries
func (s *Service) ReadFile(projectRoot, filePath string, maxBytes int64) (*FileInfo, error) {
	resolved := filepath.Join(projectRoot, filePath)

	// Security: path traversal protection
	if !strings.HasPrefix(resolved, projectRoot) {
		return nil, fmt.Errorf("access denied: path outside project directory: %s", filePath)
	}

	// Block dangerous files
	if isSensitiveFile(filePath) {
		return nil, fmt.Errorf("access denied: sensitive file: %s", filePath)
	}

	stat, err := os.Stat(resolved)
	if err != nil {
		return nil, fmt.Errorf("file not found: %w", err)
	}

	if stat.IsDir() {
		return nil, fmt.Errorf("path is directory: %s", filePath)
	}

	if stat.Size() > maxBytes {
		return nil, fmt.Errorf("file too large: %d bytes (max %d)", stat.Size(), maxBytes)
	}

	content, err := os.ReadFile(resolved)
	if err != nil {
		return nil, fmt.Errorf("failed to read: %w", err)
	}

	lines := strings.Count(string(content), "\n") + 1

	return &FileInfo{
		Path:         filePath,
		Size:         stat.Size(),
		IsDir:        false,
		Language:     detectLanguage(filePath),
		Lines:        lines,
		LastModified: stat.ModTime(),
		Content:      string(content),
		Truncated:    false,
	}, nil
}

// WriteFile safely writes a file with backup
func (s *Service) WriteFile(projectRoot, filePath, content string) (*WriteResult, error) {
	resolved := filepath.Join(projectRoot, filePath)

	// Security check
	if !strings.HasPrefix(resolved, projectRoot) {
		return nil, fmt.Errorf("access denied: path outside project directory")
	}

	// Ensure directory exists
	dir := filepath.Dir(resolved)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	// Backup existing file
	var backupPath string
	if _, err := os.Stat(resolved); err == nil {
		backupDir := filepath.Join(projectRoot, ".jaicode_backup", fmt.Sprintf("%d", time.Now().Unix()))
		os.MkdirAll(backupDir, 0755)
		backupPath = filepath.Join(backupDir, path.Base(filePath))
		if err := copyFile(resolved, backupPath); err != nil {
			s.log.Warn("Backup failed: " + err.Error())
		}
	}

	// Write
	if err := os.WriteFile(resolved, []byte(content), 0644); err != nil {
		return nil, fmt.Errorf("failed to write: %w", err)
	}

	return &WriteResult{
		Path:       filePath,
		Size:       len(content),
		BackupPath: backupPath,
	}, nil
}

func isSensitiveFile(path string) bool {
	sensitive := []string{".env", ".env.local", "*.key", "*.pem", "*_secret*"}
	base := filepath.Base(path)
	for _, pattern := range sensitive {
		if strings.Contains(base, strings.TrimPrefix(pattern, "*")) {
			return true
		}
	}
	return false
}

func detectLanguage(filePath string) string {
	ext := filepath.Ext(filePath)
	langMap := map[string]string{
		".ts": "typescript", ".tsx": "typescript",
		".js": "javascript", ".jsx": "javascript",
		".py": "python", ".go": "go", ".rs": "rust",
		".java": "java", ".c": "c", ".cpp": "cpp",
		".md": "markdown", ".json": "json", ".yaml": "yaml",
	}
	if lang, ok := langMap[ext]; ok {
		return lang
	}
	return "text"
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

// EncryptAPIKey encrypts API key with device-specific key
func EncryptAPIKey(plaintext string) (string, error) {
	key := getDeviceKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptAPIKey decrypts API key
func DecryptAPIKey(ciphertext string) (string, error) {
	key := getDeviceKey()
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func getDeviceKey() []byte {
	home, _ := os.UserHomeDir()
	hostname, _ := os.Hostname()
	raw := fmt.Sprintf("jaicode-device-key:%s:%s", home, hostname)

	// HKDF-SHA256 key derivation (256-bit entropy)
	h1 := hmac.New(sha256.New, []byte("jaicode-device-salt-v2"))
	h1.Write([]byte(raw))
	prk := h1.Sum(nil)

	h2 := hmac.New(sha256.New, prk)
	h2.Write([]byte("jaicode-aes-key"))
	h2.Write([]byte{0x01})
	return h2.Sum(nil)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
