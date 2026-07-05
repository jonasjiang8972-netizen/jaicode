// Jaicode Capability Audit - Self-check system capabilities
package capabilities

import (
	"encoding/json"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

var registry = []capability{
	// P0 - Core
	{"file-read", "File Read", "Read project files", "P0"},
	{"file-write", "File Write", "Write/modify files with diff", "P0"},
	{"llm-chat", "LLM Chat", "Multi-provider LLM conversation", "P0"},
	{"session", "Session", "Cross-session persistence", "P0"},
	{"security-input", "Input Filter", "Prompt injection detection", "P0"},
	{"security-output", "Output Filter", "Sensitive data redaction", "P0"},
	{"context-compact", "Context Compact", "Token management + summarization", "P0"},
	{"memory-project", "Project Memory", "Auto-scan + memory.yaml", "P0"},
	{"memory-user", "User Profile", "User preferences + habits", "P0"},
	{"knowledge-freshness", "Knowledge Fresh", "Knowledge cutoff detection", "P0"},
	// P1 - Important
	{"git-ops", "Git Operations", "status/commit/branch/log/PR", "P1"},
	{"shell-exec", "Shell Execute", "Safe command execution", "P1"},
	{"mcp", "MCP Client", "External tool server protocol", "P1"},
	{"hooks", "Hooks System", "Pre/post action automation", "P1"},
	{"audit", "Audit Log", "Operation audit trail", "P1"},
	{"metrics", "Metrics", "Prometheus-compatible stats", "P1"},
	{"vl-image", "Image Analysis", "VL model image understanding", "P1"},
	// P2 - Nice to have
	{"web-terminal", "Web Terminal", "Browser-based ttyd access", "P2"},
	{"sub-agents", "Sub-Agents", "Parallel task execution", "P2"},
	{"auto-update", "Auto Update", "GitHub release check", "P2"},
	{"multi-provider", "Multi-Provider", "Hot-switch LLM providers", "P2"},
}

type capability struct {
	id, name, desc, priority string
}

// Audit runs the full capability audit
func Audit() map[string]interface{} {
	var available, partial, missing, p0Missing int
	var caps []map[string]interface{}

	for _, c := range registry {
		status := check(c.id)
		caps = append(caps, map[string]interface{}{
			"id": c.id, "name": c.name, "description": c.desc,
			"status": status, "priority": c.priority,
		})
		switch status {
		case "available":
			available++
		case "partial":
			partial++
		case "missing":
			missing++
			if c.priority == "P0" {
				p0Missing++
			}
		}
	}

	return map[string]interface{}{
		"capabilities": caps,
		"summary": map[string]int{
			"total": len(registry), "available": available,
			"partial": partial, "missing": missing, "p0_missing": p0Missing,
		},
	}
}

func check(id string) string {
	switch id {
	case "file-read", "file-write", "session", "security-input", "security-output",
		"context-compact", "memory-project", "memory-user", "knowledge-freshness",
		"hooks", "audit", "metrics", "shell-exec", "sub-agents", "multi-provider":
		return "available"
	case "llm-chat":
		return boolToCheck(checkCmd("node"))
	case "git-ops":
		return boolToCheck(checkCmd("git"))
	case "mcp":
		return "available"
	case "vl-image":
		return "partial"
	case "web-terminal":
		return boolToCheck(IsTtydAvailable())
	case "auto-update":
		return "partial"
	}
	return "missing"
}

func checkCmd(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func boolToCheck(ok bool) string {
	if ok {
		return "available"
	}
	return "missing"
}

func IsTtydAvailable() bool {
	return checkCmd("ttyd")
}

func DetectProject() map[string]interface{} {
	info := map[string]interface{}{
		"platform": runtime.GOOS, "arch": runtime.GOARCH,
		"cpus": runtime.NumCPU(), "go_version": runtime.Version(),
	}
	if data, err := os.ReadFile("package.json"); err == nil {
		var pkg map[string]interface{}
		json.Unmarshal(data, &pkg)
		info["project_name"] = pkg["name"]
	}
	return info
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Unused but keeps imports clean
var _ = strings.ToLower
