// Jaicode Audit Logger - Structured audit trail for sensitive operations
package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const AuditLogFile = ".jaicode/audit.jsonl"

type Logger struct {
	mu     sync.Mutex
	file   *os.File
	dir    string
}

type Entry struct {
	Timestamp string `json:"ts"`
	Action    string `json:"action"`
	Level     string `json:"level"` // L0-L4
	Details   string `json:"details"`
	Result    string `json:"result"` // ALLOWED / DENIED
	Reason    string `json:"reason,omitempty"`
	Duration  int64  `json:"duration_ms,omitempty"`
}

func NewLogger(projectDir string) (*Logger, error) {
	dir := filepath.Join(projectDir, ".jaicode")
	os.MkdirAll(dir, 0755)

	file, err := os.OpenFile(filepath.Join(dir, "audit.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	return &Logger{file: file, dir: dir}, nil
}

func (l *Logger) Log(action, level, details, result, reason string) error {
	return l.LogWithDuration(action, level, details, result, reason, 0)
}

func (l *Logger) LogWithDuration(action, level, details, result, reason string, durationMs int64) error {
	entry := Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    action,
		Level:     level,
		Details:   details,
		Result:    result,
		Reason:    reason,
		Duration:  durationMs,
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	_, err = l.file.Write(append(data, '\n'))
	return err
}

func (l *Logger) Close() error {
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}

// ─── Convenience Methods ───────────────────────────────
func (l *Logger) LogRead(path string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed {
		result = "DENIED"
	}
	l.Log("read", "L0", path, result, reason)
}

func (l *Logger) LogWrite(path string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed {
		result = "DENIED"
	}
	l.Log("write", "L1", path, result, reason)
}

func (l *Logger) LogExec(cmd string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed {
		result = "DENIED"
	}
	l.Log("exec", "L2", cmd, result, reason)
}

func (l *Logger) LogExtend(action string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed {
		result = "DENIED"
	}
	l.Log("extend", "L3", action, result, reason)
}

// ─── Query ──────────────────────────────────────────────
func (l *Logger) Query(limit int) ([]Entry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	data, err := os.ReadFile(filepath.Join(l.dir, "audit.jsonl"))
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	var entries []Entry

	for i := len(lines) - 1; i >= 0 && len(entries) < limit; i-- {
		if lines[i] == "" {
			continue
		}
		var entry Entry
		if err := json.Unmarshal([]byte(lines[i]), &entry); err == nil {
			entries = append(entries, entry)
		}
	}

	return entries, nil
}

// Helper - not used directly but keeps import clean
func _() {
	_ = fmt.Sprintf("")
}
