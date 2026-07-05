package memory

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jonasjiang8972-netizen/jaicode-go/pkg/logger"
)

const KnowledgeCutoff = "2025-01-01"

type Manager struct {
	log    logger.Logger
	root   string
}

type ProjectMemory struct {
	Project     ProjectInfo     `json:"project"`
	Preferences UserPreferences `json:"preferences"`
	LastScan    time.Time       `json:"last_scan"`
}

type ProjectInfo struct {
	Name        string   `json:"name"`
	TechStack   []string `json:"tech_stack"`
	Directories []string `json:"directories"`
}

type UserPreferences struct {
	Language  string `json:"language"`
	Verbosity string `json:"verbosity"`
}

type FreshnessResult struct {
	IsTimeSensitive bool   `json:"is_time_sensitive"`
	DetectedYear    string `json:"detected_year,omitempty"`
	Hint            string `json:"hint,omitempty"`
	Modified        bool   `json:"modified"`
}

func NewManager(log logger.Logger, root string) *Manager {
	return &Manager{log: log, root: root}
}

func (m *Manager) IsPathAllowed(path string) bool {
	clean := filepath.Join(m.root, path)
	clean = filepath.Clean(clean)
	return strings.HasPrefix(clean, m.root)
}

func (m *Manager) ListEntries(path string) ([]string, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), ".") {
			names = append(names, e.Name())
		}
	}
	return names, nil
}

func (m *Manager) CheckFreshness(input string) FreshnessResult {
	result := FreshnessResult{}
	for _, year := range []string{"2026", "2027", "2028"} {
		if strings.Contains(input, year) {
			result.IsTimeSensitive = true
			result.DetectedYear = year
			result.Modified = true
			result.Hint = "Knowledge cutoff: " + KnowledgeCutoff + ". User asks about " + year + "."
			return result
		}
	}
	keywords := []string{"latest", "recent", "new", "最新", "最近"}
	for _, kw := range keywords {
		if strings.Contains(strings.ToLower(input), kw) {
			result.IsTimeSensitive = true
			result.Modified = true
			result.Hint = "Time-sensitive keyword: " + kw
			return result
		}
	}
	return result
}

func (m *Manager) AutoScan() (*ProjectInfo, error) {
	info := &ProjectInfo{Directories: []string{}}

	pkgPath := filepath.Join(m.root, "package.json")
	if data, err := os.ReadFile(pkgPath); err == nil {
		var pkg struct {
			Name         string            `json:"name"`
			Dependencies map[string]string `json:"dependencies"`
		}
		json.Unmarshal(data, &pkg)
		info.Name = pkg.Name
		// Detect tech stack
		for dep := range pkg.Dependencies {
			switch {
			case strings.Contains(dep, "react"):
				info.TechStack = append(info.TechStack, "react")
			case strings.Contains(dep, "vue"):
				info.TechStack = append(info.TechStack, "vue")
			case strings.Contains(dep, "typescript"):
				info.TechStack = append(info.TechStack, "typescript")
			}
		}
	} else {
		info.Name = filepath.Base(m.root)
	}

	entries, _ := os.ReadDir(m.root)
	for _, e := range entries {
		if e.IsDir() && !strings.HasPrefix(e.Name(), ".") && e.Name() != "node_modules" {
			info.Directories = append(info.Directories, e.Name())
		}
	}

	return info, nil
}

func (m *Manager) LoadUserProfile() (*UserPreferences, error) {
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, ".jaicode", "user.profile"))
	if err != nil {
		return &UserPreferences{Language: "zh"}, nil
	}
	var p UserPreferences
	json.Unmarshal(data, &p)
	return &p, nil
}

func (m *Manager) LoadProjectMemory() (*ProjectMemory, error) {
	data, err := os.ReadFile(filepath.Join(m.root, ".jaicode", "memory.json"))
	if err != nil {
		return nil, err
	}
	var mem ProjectMemory
	json.Unmarshal(data, &mem)
	return &mem, nil
}
