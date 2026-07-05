// Jaicode Security Engine - Input/Output filtering + Sandbox
package security

import (
	"regexp"
	"strings"
	"sync"
)

// ─── Input Filter ──────────────────────────────────────
type InputFilter struct {
	injectionPatterns []*regexp.Regexp
	sensitivePatterns []SensitiveRule
	mu                sync.RWMutex
}

type FilterResult struct {
	Cleaned   string   `json:"cleaned"`
	Blocked   bool     `json:"blocked"`
	Reason    string   `json:"reason,omitempty"`
	Warnings  []string `json:"warnings,omitempty"`
}

type SensitiveRule struct {
	Pattern     *regexp.Regexp `json:"-"`
	Replacement string         `json:"replacement"`
	Label       string         `json:"label"`
}

func NewInputFilter() *InputFilter {
	return &InputFilter{
		injectionPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)`),
			regexp.MustCompile(`(?i)you\s+are\s+now\s+(a|an|the)`),
			regexp.MustCompile(`(?i)system\s*:\s*`),
			regexp.MustCompile(`(?i)new\s+persona`),
			regexp.MustCompile(`(?i)forget\s+(everything|all|your)`),
			regexp.MustCompile(`(?i)jailbreak`),
			regexp.MustCompile(`(?i)do\s+anything\s+now`),
			regexp.MustCompile(`(?i)pretend\s+(you\s+are|to\s+be)`),
			regexp.MustCompile(`(?i)\[system\]`),
			regexp.MustCompile(`(?i)<system>`),
			regexp.MustCompile(`(?i)<\s*im_start\s*>`),
			regexp.MustCompile(`(?i)<\s*im_end\s*>`),
		},
		sensitivePatterns: []SensitiveRule{
			{regexp.MustCompile(`\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b`), "[API_KEY_REDACTED]", "API_KEY"},
			{regexp.MustCompile(`\b1[3-9]\d{9}\b`), "[PHONE_REDACTED]", "PHONE"},
			{regexp.MustCompile(`\b\d{17}[\dXx]\b`), "[ID_REDACTED]", "ID_CARD"},
			{regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`), "[EMAIL_REDACTED]", "EMAIL"},
			{regexp.MustCompile(`(?i)password\s*[=:]\s*\S+`), "password=[REDACTED]", "PASSWORD"},
			{regexp.MustCompile(`(?i)secret\s*[=:]\s*\S+`), "secret=[REDACTED]", "SECRET"},
			{regexp.MustCompile(`(?i)token\s*[=:]\s*\S+`), "token=[REDACTED]", "TOKEN"},
		},
	}
}

func (f *InputFilter) Filter(input string) FilterResult {
	result := FilterResult{Cleaned: input}

	// Check injection patterns
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, pattern := range f.injectionPatterns {
		if pattern.MatchString(input) {
			result.Blocked = true
			result.Reason = "Prompt injection detected: " + pattern.String()
			return result
		}
	}

	// Check and redact sensitive data
	for _, rule := range f.sensitivePatterns {
		if rule.Pattern.MatchString(input) {
			result.Warnings = append(result.Warnings, "Sensitive data detected: "+rule.Label)
			result.Cleaned = rule.Pattern.ReplaceAllString(result.Cleaned, rule.Replacement)
		}
	}

	// Check for dangerous commands
	dangerousCmds := []string{
		`rm\s+-rf\s+/`, `rm\s+-rf\s+\*`, `rm\s+-rf\s+~`,
		`sudo\s+`, `chmod\s+777`, `mkfs`, `dd\s+if=`,
		`>\s*/dev/`, `curl.*\|.*sh`, `wget.*\|.*sh`,
	}
	for _, cmd := range dangerousCmds {
		if matched, _ := regexp.MatchString(`(?i)`+cmd, input); matched {
			result.Blocked = true
			result.Reason = "Dangerous command detected: " + cmd
			return result
		}
	}

	return result
}

func (f *InputFilter) AddInjectionPattern(pattern string) error {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.injectionPatterns = append(f.injectionPatterns, re)
	return nil
}

// ─── Output Filter ─────────────────────────────────────
type OutputFilter struct {
	sensitivePatterns []SensitiveRule
}

func NewOutputFilter() *OutputFilter {
	return &OutputFilter{
		sensitivePatterns: []SensitiveRule{
			{regexp.MustCompile(`\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b`), "[API_KEY_REDACTED]", "API_KEY"},
			{regexp.MustCompile(`\b1[3-9]\d{9}\b`), "[PHONE_REDACTED]", "PHONE"},
			{regexp.MustCompile(`\b\d{17}[\dXx]\b`), "[ID_REDACTED]", "ID_CARD"},
			{regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`), "[EMAIL_REDACTED]", "EMAIL"},
			{regexp.MustCompile(`(?i)password\s*[=:]\s*\S+`), "password=[REDACTED]", "PASSWORD"},
			{regexp.MustCompile(`(?i)secret\s*[=:]\s*\S+`), "secret=[REDACTED]", "SECRET"},
			{regexp.MustCompile(`\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`), "[INTERNAL_IP]", "INTERNAL_IP"},
			{regexp.MustCompile(`\b(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b`), "[INTERNAL_IP]", "INTERNAL_IP"},
			{regexp.MustCompile(`\b(192\.168\.\d{1,3}\.\d{1,3})\b`), "[INTERNAL_IP]", "INTERNAL_IP"},
		},
	}
}

func (f *OutputFilter) Filter(input string) FilterResult {
	result := FilterResult{Cleaned: input}

	for _, rule := range f.sensitivePatterns {
		if rule.Pattern.MatchString(input) {
			result.Warnings = append(result.Warnings, "Sensitive data redacted: "+rule.Label)
			result.Cleaned = rule.Pattern.ReplaceAllString(result.Cleaned, rule.Replacement)
		}
	}

	return result
}

// ─── Sandbox ───────────────────────────────────────────
type Sandbox struct {
	projectRoot      string
	blockedPaths     []string
	blockedCommands  []string
	maxFileSize      int64
}

func NewSandbox(projectRoot string) *Sandbox {
	return &Sandbox{
		projectRoot: projectRoot,
		blockedPaths: []string{
			".git", "node_modules", ".env", ".env.local",
			"*.key", "*.pem", "*.secret", "*_secret*",
		},
		blockedCommands: []string{
			"rm -rf /", "sudo", "chmod 777", "mkfs", "dd if=",
		},
		maxFileSize: 5 * 1024 * 1024, // 5MB
	}
}

func (s *Sandbox) IsPathAllowed(path string) bool {
	// Normalize and check
	clean := strings.TrimSpace(path)

	// Must be within project root
	if !strings.HasPrefix(clean, s.projectRoot) {
		return false
	}

	// Block sensitive files
	base := path
	for _, blocked := range s.blockedPaths {
		if matched, _ := regexp.MatchString(regexp.QuoteMeta(blocked), base); matched {
			return false
		}
		if strings.Contains(base, blocked) {
			return false
		}
	}

	return true
}

func (s *Sandbox) IsCommandAllowed(cmd string) bool {
	for _, blocked := range s.blockedCommands {
		if strings.Contains(cmd, blocked) {
			return false
		}
	}
	return true
}

func (s *Sandbox) GetMaxFileSize() int64 {
	return s.maxFileSize
}
