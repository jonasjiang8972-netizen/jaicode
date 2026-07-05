// Jaicode Session Service - Cross-session persistence
package session

import (
	"encoding/json"
	"fmt"
	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
	"os"
	"path/filepath"
	"sort"
	"time"

)

type Service struct {
	log      logger.Logger
	basePath string
}

type Session struct {
	PID       int       `json:"pid"`
	CWD       string    `json:"cwd"`
	Mode      string    `json:"mode"`
	Messages  []Message `json:"messages"`
	Timestamp time.Time `json:"timestamp"`
}

type Message struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp int64  `json:"ts"`
}

func NewService(log logger.Logger) *Service {
	home, _ := os.UserHomeDir()
	basePath := filepath.Join(home, ".jaicode", "sessions")
	os.MkdirAll(basePath, 0755)
	return &Service{log: log, basePath: basePath}
}

func (s *Service) Save(pid int, cwd, mode string, messages []Message) error {
	session := Session{
		PID:       pid,
		CWD:       cwd,
		Mode:      mode,
		Messages:  messages,
		Timestamp: time.Now(),
	}

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}

	filename := fmt.Sprintf("%d.json", pid)
	return os.WriteFile(filepath.Join(s.basePath, filename), data, 0644)
}

func (s *Service) List() ([]Session, error) {
	files, err := os.ReadDir(s.basePath)
	if err != nil {
		return nil, err
	}

	var sessions []Session
	for _, f := range files {
		if filepath.Ext(f.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.basePath, f.Name()))
		if err != nil {
			continue
		}
		var session Session
		if err := json.Unmarshal(data, &session); err != nil {
			continue
		}
		// Check if process is alive
		if isProcessAlive(session.PID) {
			session.Timestamp = time.Now()
		}
		sessions = append(sessions, session)
	}

	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].Timestamp.After(sessions[j].Timestamp)
	})

	return sessions, nil
}

func (s *Service) Restore(pid int) (*Session, error) {
	data, err := os.ReadFile(filepath.Join(s.basePath, fmt.Sprintf("%d.json", pid)))
	if err != nil {
		return nil, err
	}

	var session Session
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}

	return &session, nil
}

func isProcessAlive(pid int) bool {
	if pid == 0 {
		return false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = proc.Signal(os.Signal(nil))
	return err == nil
}
