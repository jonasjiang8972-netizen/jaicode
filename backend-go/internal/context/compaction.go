// Jaicode Context Compaction
package context

import (
	"fmt"
	"strings"
)

func EstimateTokens(text string) int {
	if text == "" { return 0 }
	cjk, other := 0, 0
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fff { cjk++ } else { other++ }
	}
	return other/4 + cjk/2 + 1
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func ShouldCompact(messages []Message, max int) bool {
	total := 0
	for _, m := range messages { total += EstimateTokens(m.Content) + 4 }
	return total > max
}

func Compact(messages []Message, max int) ([]Message, bool) {
	total := 0
	for _, m := range messages { total += EstimateTokens(m.Content) + 4 }
	if total <= max || len(messages) <= 6 { return messages, false }
	result := []Message{messages[0]}
	middle := messages[1 : len(messages)-4]
	topics := []string{}
	for _, m := range middle {
		if m.Role == "user" {
			first := strings.Split(m.Content, "\n")[0]
			if len(first) > 80 { first = first[:80] + "..." }
			topics = append(topics, first)
		}
	}
	result = append(result, Message{
		Role:    "system",
		Content: "[Compacted " + itoa(len(middle)) + " msgs] Topics: " + strings.Join(topics[:min(5, len(topics))], "; "),
	})
	result = append(result, messages[len(messages)-4:]...)
	return result, true
}

func itoa(i int) string {
	return strings.TrimSuffix(strings.TrimPrefix(fmt.Sprintf("%d", i), "-"), "")
}
var _ = fmt.Sprintf
