// Jaicode Audit Logger
package audit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Logger struct {
	mu   sync.Mutex
	file *os.File
	dir  string
}

type Entry struct {
	Timestamp string `json:"ts"`
	Action    string `json:"action"`
	Level     string `json:"level"`
	Details   string `json:"details"`
	Result    string `json:"result"`
	Reason    string `json:"reason,omitempty"`
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
	entry := Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action: action, Level: level, Details: details, Result: result, Reason: reason,
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	data, _ := json.Marshal(entry)
	_, err := l.file.Write(append(data, '\n'))
	return err
}

func (l *Logger) LogWithDuration(action, level, details, result, reason string, _ int64) error {
	return l.Log(action, level, details, result, reason)
}

func (l *Logger) LogRead(path string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed { result = "DENIED" }
	l.Log("read", "L0", path, result, reason)
}

func (l *Logger) LogWrite(path string, allowed bool, reason string) {
	result := "ALLOWED"
	if !allowed { result = "DENIED" }
	l.Log("write", "L1", path, result, reason)
}

func (l *Logger) Close() {
	if l.file != nil { l.file.Close() }
}

func (l *Logger) Query(limit int) ([]Entry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	data, err := os.ReadFile(filepath.Join(l.dir, "audit.jsonl"))
	if err != nil { return nil, err }
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	var entries []Entry
	for i := len(lines) - 1; i >= 0 && len(entries) < limit; i-- {
		if lines[i] == "" { continue }
		var e Entry
		if err := json.Unmarshal([]byte(lines[i]), &e); err == nil {
			entries = append(entries, e)
		}
	}
	return entries, nil
}
