// Jaicode Structured Logger
package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Logger interface {
	Debug(msg string)
	Info(msg string)
	Warn(msg string)
	Error(msg string)
	Sync() error
}

type simpleLogger struct {
	mu    sync.Mutex
	file  *os.File
	level string
}

type Entry struct {
	Timestamp string `json:"ts"`
	Level     string `json:"level"`
	Message   string `json:"msg"`
}

func NewLogger(level string) (Logger, error) {
	home, _ := os.UserHomeDir()
	logDir := filepath.Join(home, ".jaicode", "logs")
	os.MkdirAll(logDir, 0755)

	logFile := filepath.Join(logDir, time.Now().Format("2006-01-02")+".jsonl")
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}

	return &simpleLogger{file: f, level: level}, nil
}

func (l *simpleLogger) log(level, msg string) {
	prefix := ""
	switch level {
	case "DEBUG":
		prefix = "\x1B[90m[DEBUG]\x1B[0m "
	case "INFO":
		prefix = "\x1B[36m[INFO]\x1B[0m "
	case "WARN":
		prefix = "\x1B[33m[WARN]\x1B[0m "
	case "ERROR":
		prefix = "\x1B[31m[ERROR]\x1B[0m "
	}
	fmt.Fprintf(os.Stdout, "%s%s\n", prefix, msg)

	if l.file != nil {
		entry := Entry{
			Timestamp: time.Now().Format(time.RFC3339),
			Level:     level,
			Message:   msg,
		}
		data, _ := json.Marshal(entry)
		l.mu.Lock()
		l.file.Write(append(data, '\n'))
		l.mu.Unlock()
	}
}

func (l *simpleLogger) Debug(msg string) { l.log("DEBUG", msg) }
func (l *simpleLogger) Info(msg string)  { l.log("INFO", msg) }
func (l *simpleLogger) Warn(msg string)  { l.log("WARN", msg) }
func (l *simpleLogger) Error(msg string) { l.log("ERROR", msg) }
func (l *simpleLogger) Sync() error {
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}
