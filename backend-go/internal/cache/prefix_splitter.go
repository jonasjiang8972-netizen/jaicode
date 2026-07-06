package cache

import (
	"regexp"
	"sort"
	"strings"
)

// PrefixSplitter splits context into static prefix and dynamic suffix
type PrefixSplitter struct {
	CacheThreshold int
	MaxPrefixSize  int
	SensitiveRules []string
}

func NewPrefixSplitter() *PrefixSplitter {
	return &PrefixSplitter{
		CacheThreshold: 1024,
		MaxPrefixSize:  8000,
		SensitiveRules: []string{
			`.env`, `.env.`, `.key$`, `.pem$`, `_secret`, `.secret$`,
			`node_modules/`, `dist/`, `build/`, `.cache/`,
		},
	}
}

type ContextFile struct {
	Path     string
	Content  string
	IsStatic bool
}

type SplitResult struct {
	StaticPrefix  []ContextFile
	DynamicSuffix []ContextFile
	StaticTokens  int
	DynamicTokens int
	UseCache      bool
}

func (ps *PrefixSplitter) Split(files []ContextFile) SplitResult {
	sorted := make([]ContextFile, len(files))
	copy(sorted, files)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Path < sorted[j].Path
	})

	var prefix []ContextFile
	var suffix []ContextFile
	prefixTokens := 0

	for _, file := range sorted {
		if ps.isSensitive(file.Path) {
			continue
		}

		tokens := EstimateTokens(file.Content)

		if prefixTokens+tokens <= ps.MaxPrefixSize {
			prefix = append(prefix, file)
			prefixTokens += tokens
		} else {
			suffix = append(suffix, file)
		}
	}

	suffixTokens := 0
	for _, f := range suffix {
		suffixTokens += EstimateTokens(f.Content)
	}

	return SplitResult{
		StaticPrefix:  prefix,
		DynamicSuffix: suffix,
		StaticTokens:  prefixTokens,
		DynamicTokens: suffixTokens,
		UseCache:      prefixTokens >= ps.CacheThreshold,
	}
}

func (ps *PrefixSplitter) isSensitive(path string) bool {
	for _, rule := range ps.SensitiveRules {
		if matched := matchSimple(path, rule); matched {
			return true
		}
	}
	return false
}

func matchSimple(path, pattern string) bool {
	if strings.HasSuffix(pattern, `$`) {
		suffix := pattern[:len(pattern)-1]
		return strings.HasSuffix(path, suffix)
	}
	return strings.Contains(path, strings.Trim(pattern, "/"))
}

func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}
	cjkCount := 0
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fff ||
			r >= 0x3000 && r <= 0x303f ||
			r >= 0xff00 && r <= 0xffef {
			cjkCount++
		}
	}
	otherCount := len([]rune(text)) - cjkCount
	return (cjkCount+1)/2 + (otherCount+3)/4
}

// BuildAnthropicCacheControl creates a cache_control block for Anthropic API
func BuildAnthropicCacheControl(content string, useCache bool) map[string]interface{} {
	block := map[string]interface{}{
		"type": "text",
		"text": content,
	}
	if useCache {
		block["cache_control"] = map[string]interface{}{
			"type": "ephemeral",
		}
	}
	return block
}

// BuildMessageStructure builds the full message array with cache markers
func BuildMessageStructure(systemPrompt string, files []ContextFile, userInput string) []map[string]interface{} {
	var messages []map[string]interface{}

	if systemPrompt != "" {
		messages = append(messages, map[string]interface{}{
			"role":    "system",
			"content": systemPrompt,
		})
	}

	var prefixContent strings.Builder
	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})

	for _, f := range files {
		if f.IsStatic && !isPathSensitive(f.Path) {
			prefixContent.WriteString("--- " + f.Path + " ---\n")
			prefixContent.WriteString(f.Content)
			prefixContent.WriteString("\n\n")
		}
	}

	if prefixContent.Len() > 0 {
		messages = append(messages, map[string]interface{}{
			"role":    "user",
			"content": prefixContent.String(),
		})
	}

	for _, f := range files {
		if !f.IsStatic {
			messages = append(messages, map[string]interface{}{
				"role":    "user",
				"content": "--- " + f.Path + " (modified) ---\n" + f.Content,
			})
		}
	}

	if userInput != "" {
		messages = append(messages, map[string]interface{}{
			"role":    "user",
			"content": userInput,
		})
	}

	return messages
}

func isPathSensitive(path string) bool {
	patterns := []string{".env", ".key", ".pem", "secret", "node_modules/", "dist/"}
	for _, p := range patterns {
		if strings.Contains(path, p) {
			return true
		}
	}
	return false
}

// Placeholder to use regexp
var _ = regexp.MustCompile
