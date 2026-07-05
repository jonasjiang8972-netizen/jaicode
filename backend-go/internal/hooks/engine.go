// Jaicode Hooks Engine - Pre/post action automation
package hooks

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
)

type Engine struct {
	log   *zap.Logger
	hooks map[string][]string
}

func NewEngine(log *zap.Logger) *Engine {
	home, _ := os.UserHomeDir()
	configPath := filepath.Join(home, ".jaicode", "hooks.json")

	hooks := loadHooks(configPath)

	return &Engine{
		log:   log,
		hooks: hooks,
	}
}

func loadHooks(configPath string) map[string][]string {
	defaultHooks := map[string][]string{
		"pre-edit":      {},
		"post-edit":     {},
		"pre-commit":    {},
		"post-commit":   {},
		"pre-exec":      {},
		"post-exec":     {},
		"session-start": {},
		"session-end":   {},
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return defaultHooks
	}

	var hooks map[string][]string
	if err := json.Unmarshal(data, &hooks); err != nil {
		return defaultHooks
	}

	return hooks
}

func (e *Engine) Execute(event, cwd string, context map[string][]string) []HookResult {
	var results []HookResult

	for _, cmdTemplate := range e.hooks[event] {
		// Replace variables
		cmd := cmdTemplate
		if context != nil {
			for key, values := range context {
				if len(values) > 0 {
					cmd = strings.ReplaceAll(cmd, "$"+key, values[0])
				}
			}
		}
		cmd = strings.ReplaceAll(cmd, "$CWD", cwd)

		result := HookResult{Command: cmd, Timestamp: time.Now()}

		parts := strings.Fields(cmd)
		if len(parts) == 0 {
			continue
		}

		execCmd := exec.Command(parts[0], parts[1:]...)
		execCmd.Dir = cwd
		out, err := execCmd.CombinedOutput()

		if err == nil {
			result.Success = true
			result.Output = strings.TrimSpace(string(out))
		} else {
			result.Success = false
			result.Error = err.Error()
		}

		results = append(results, result)
	}

	return results
}

type HookResult struct {
	Command   string    `json:"command"`
	Success   bool      `json:"success"`
	Output    string    `json:"output,omitempty"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
