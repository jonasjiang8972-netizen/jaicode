// Jaicode Memory System - Project memory + user profile + knowledge freshness
package memory

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"
)

const KnowledgCutoff = "2025-01-01"

var timeKeywords = []string{
	"最新", "最近", "今天", "今年", "本月", "上周", "昨天", "明天",
	"2026", "2027", "2028", "新发布", "新版本", "新特性", "新框架", "新工具",
	"latest", "recent", "new release", "just launched", "announced",
	"this year", "this month", "this week", "today", "yesterday", "tomorrow",
}

var timePatterns = []*regexp.Regexp{
	regexp.MustCompile(`\b20[2-9][0-9]年`),
	regexp.MustCompile(`今年|本年|这一年|最新.*发布|有什么新`),
	regexp.MustCompile(`new.*\d{4}`),
	regexp.MustCompile(`released.*\d{4}`),
	regexp.MustCompile(`launched.*\d{4}`),
}

type ProjectMemory struct {
	Project      ProjectInfo      `json:"project"`
	Preferences  UserPreferences  `json:"preferences"`
	History      []HistoryEntry   `json:"history"`
	LastScan     time.Time        `json:"last_scan"`
}

type ProjectInfo struct {
	Name         string   `json:"name"`
	TechStack    []string `json:"tech_stack"`
	Directories  []string `json:"directories"`
	EntryPoints  []string `json:"entry_points"`
}

type UserPreferences struct {
	Language    string `json:"language"`
	Verbosity   string `json:"verbosity"`
	LastProvider string `json:"last_provider"`
}

type HistoryEntry struct {
	Date    string `json:"date"`
	Actions string `json:"actions"`
}

type FreshnessResult struct {
	IsTimeSensitive bool   `json:"is_time_sensitive"`
	DetectedYear    string `json:"detected_year,omitempty"`
	Hint            string `json:"hint,omitempty"`
	Modified        bool   `json:"modified"`
}

type Manager struct {
	log      *zap.Logger
	projectDir string
}

func NewManager(log *zap.Logger, projectDir string) *Manager {
	return &Manager{log: log, projectDir: projectDir}
}

// Project memory
func (m *Manager) LoadProjectMemory() (*ProjectMemory, error) {
	memPath := filepath.Join(m.projectDir, ".jaicode", "memory.json")
	data, err := os.ReadFile(memPath)

	if err != nil {
		return nil, err
	}
	var mem ProjectMemory
	if err := json.Unmarshal(data, &mem); err != nil {
		return nil, err
	}
	return &mem, nil
}

func (m *Manager) SaveProjectMemory(mem *ProjectMemory) error {
	mem.LastScan = time.Now()
	dir := filepath.Join(m.projectDir, ".jaicode")
	os.MkdirAll(dir, 0755)

	data, err := json.MarshalIndent(mem, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "memory.json"), data, 0644)
}

// User profile
func (m *Manager) LoadUserProfile() (*UserPreferences, error) {
	home, _ := os.UserHomeDir()
	profilePath := filepath.Join(home, ".jaicode", "user.profile")

	data, err := os.ReadFile(profilePath)
	if err != nil {
		return &UserPreferences{Language: "zh", Verbosity: "normal"}, nil
	}

	var profile UserPreferences
	json.Unmarshal(data, &profile)
	return &profile, nil
}

func (m *Manager) SaveUserProfile(profile *UserPreferences) error {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".jaicode")
	os.MkdirAll(dir, 0755)

	if profile.Language == "" {
		profile.Language = "en"
	}

	data, _ := json.MarshalIndent(profile, "", "  ")
	return os.WriteFile(filepath.Join(dir, "user.profile"), data, 0644)
}

// Knowledge freshness
func (m *Manager) CheckFreshness(input string) FreshnessResult {
	result := FreshnessResult{}

	for _, year := range []string{"2026", "2027", "2028"} {
		if strings.Contains(input, year) {
			cutoffYear := KnowledgeCutoff[:4]
			if year > cutoffYear {
				result.IsTimeSensitive = true
				result.DetectedYear = year
				result.Modified = true
				result.Hint = fmt.Sprintf("Knowledge cutoff: %s. User asks about %s.", KnowledgeCutoff, year)
				return result
			}
		}
	}

	lower := strings.ToLower(input)
	for _, kw := range timeKeywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			result.IsTimeSensitive = true
			result.Modified = true
			result.Hint = fmt.Sprintf("Knowledge cutoff: %s. Time-sensitive keyword: %q.", KnowledgeCutoff, kw)
			return result
		}
	}

	for _, pattern := range timePatterns {
		if pattern.MatchString(input) {
			result.IsTimeSensitive = true
			result.Modified = true
			result.Hint = fmt.Sprintf("Knowledge cutoff: %s. Time pattern detected.", KnowledgeCutoff)
			return result
		}
	}

	return result
}

// Auto scan project
func (m *Manager) AutoScan() (*ProjectInfo, error) {
	info := &ProjectInfo{}

	pkgPath := filepath.Join(m.projectDir, "package.json")
	if data, err := os.ReadFile(pkgPath); err == nil {
		var pkg struct {
			Name         string            `json:"name"`
			Dependencies map[string]string `json:"dependencies"`
		}
		json.Unmarshal(data, &pkg)
		info.Name = pkg.Name
		info.TechStack = detectTechStack(pkg.Dependencies)
		info.EntryPoints = findEntryPoints(pkg.Dependencies)
	} else {
		info.Name = filepath.Base(m.projectDir)
	}

	entries, _ := os.ReadDir(m.projectDir)
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") && entry.Name() != "node_modules" {
			info.Directories = append(info.Directories, entry.Name())
		}
	}

	return info, nil
}

func detectTechStack(deps map[string]string) []string {
	stack := []string{}
	mappings := map[string]string{
		"react": "react", "vue": "vue", "typescript": "typescript",
		"express": "express", "next": "nextjs", "vite": "vite",
		"tailwindcss": "tailwind", "prisma": "prisma",
	}
	for dep, name := range mappings {
		if deps[dep] != "" {
			stack = append(stack, name)
		}
	}
	return stack
}

func findEntryPoints(deps map[string]string) []string {
	if deps["next"] != "" {
		return []string{"pages/", "app/"}
	}
	if deps["vite"] != "" {
		return []string{"src/main.ts"}
	}
	return []string{"src/"}
}
