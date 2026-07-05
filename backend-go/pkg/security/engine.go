package security

import (
	"regexp"
	"strings"
	"sync"
)

type InputFilter struct {
	injectionPatterns []*regexp.Regexp
	sensitivePatterns []SensitiveRule
	mu                sync.RWMutex
}

type FilterResult struct {
	Cleaned  string   `json:"cleaned"`
	Blocked  bool     `json:"blocked"`
	Reason   string   `json:"reason,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

type SensitiveRule struct {
	Pattern     *regexp.Regexp
	Replacement string
	Label       string
}

func NewInputFilter() *InputFilter {
	return &InputFilter{
		injectionPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)`),
			regexp.MustCompile(`(?i)you\s+are\s+now\s+(a|an|the)`),
			regexp.MustCompile(`(?i)new\s+persona`),
			regexp.MustCompile(`(?i)forget\s+(everything|all|your)`),
			regexp.MustCompile(`(?i)jailbreak`),
			regexp.MustCompile(`(?i)do\s+anything\s+now`),
			regexp.MustCompile(`(?i)pretend\s+(you\s+are|to\s+be)`),
			regexp.MustCompile(`(?i)\[system\]`),
			regexp.MustCompile(`(?i)<system>`),
		},
		sensitivePatterns: []SensitiveRule{
			{regexp.MustCompile(`\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b`), "[API_KEY_REDACTED]", "API_KEY"},
			{regexp.MustCompile(`\b1[3-9]\d{9}\b`), "[PHONE_REDACTED]", "PHONE"},
			{regexp.MustCompile(`\b\d{17}[\dXx]\b`), "[ID_REDACTED]", "ID_CARD"},
			{regexp.MustCompile(`(?i)password\s*[=:]\s*\S+`), "password=[REDACTED]", "PASSWORD"},
		},
	}
}

func (f *InputFilter) Filter(input string) FilterResult {
	result := FilterResult{Cleaned: input}
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, pat := range f.injectionPatterns {
		if pat.MatchString(input) {
			result.Blocked = true
			result.Reason = "Prompt injection: " + pat.String()
			return result
		}
	}

	for _, rule := range f.sensitivePatterns {
		if rule.Pattern.MatchString(input) {
			result.Warnings = append(result.Warnings, "Sensitive: "+rule.Label)
			result.Cleaned = rule.Pattern.ReplaceAllString(result.Cleaned, rule.Replacement)
		}
	}

	dangerous := []string{`rm\s+-rf\s+/`, `sudo\s+`, `chmod\s+777`}
	for _, d := range dangerous {
		if matched, _ := regexp.MatchString(`(?i)`+d, input); matched {
			result.Blocked = true
			result.Reason = "Dangerous command: " + d
			return result
		}
	}

	return result
}

func (f *InputFilter) AddPattern(pattern string) error {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.injectionPatterns = append(f.injectionPatterns, re)
	return nil
}

type OutputFilter struct {
	patterns []SensitiveRule
}

func NewOutputFilter() *OutputFilter {
	return &OutputFilter{
		patterns: []SensitiveRule{
			{regexp.MustCompile(`\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b`), "[API_KEY_REDACTED]", "API_KEY"},
			{regexp.MustCompile(`\b1[3-9]\d{9}\b`), "[PHONE_REDACTED]", "PHONE"},
			{regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`), "[EMAIL_REDACTED]", "EMAIL"},
		},
	}
}

func (f *OutputFilter) Filter(input string) FilterResult {
	result := FilterResult{Cleaned: input}
	for _, rule := range f.patterns {
		if rule.Pattern.MatchString(input) {
			result.Warnings = append(result.Warnings, "Redacted: "+rule.Label)
			result.Cleaned = rule.Pattern.ReplaceAllString(result.Cleaned, rule.Replacement)
		}
	}
	return result
}

// Sandbox validates paths and commands
type Sandbox struct {
	root           string
	maxFileSize    int64
}

func NewSandbox(root string) *Sandbox {
	return & Sandbox{root: root, maxFileSize: 5 * 1024 * 1024}
}

func (s *Sandbox) IsPathAllowed(path string) bool {
	clean := strings.TrimSpace(path)
	if !strings.HasPrefix(clean, s.root) {
		return false
	}
	sensitive := []string{".env", ".env.local", "*.key", "*.pem"}
	base := path
	for _, blocked := range sensitive {
		if matched, _ := regexp.MatchString(regexp.QuoteMeta(blocked), base); matched {
			return false
		}
	}
	return true
}

func (s *Sandbox) GetMaxSize() int64 { return s.maxFileSize }
