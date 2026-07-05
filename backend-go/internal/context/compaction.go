// Jaicode Context Compaction - Token management + LCS summarization
package context

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}
	cjkCount := 0
	otherCount := 0
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fff || r >= 0x3000 && r <= 0x303f || r >= 0xff00 && r <= 0xffef {
			cjkCount++
		} else {
			otherCount++
		}
	}
	return otherCount/4 + cjkCount/2 + 1
}

func CountMessagesTokens(messages []Message) int {
	total := 0
	for _, msg := range messages {
		total += EstimateTokens(msg.Content) + 4
	}
	return total
}

func ShouldCompact(messages []Message, maxTokens int) bool {
	return CountMessagesTokens(messages) > maxTokens
}

func CompactMessages(messages []Message, maxTokens int) ([]Message, bool) {
	currentTokens := CountMessagesTokens(messages)
	if currentTokens <= maxTokens {
		return messages, false
	}

	const keepRecent = 4
	if len(messages) <= keepRecent+2 {
		return messages, false
	}

	recent := messages[len(messages)-keepRecent:]
	toCompact := messages[1 : len(messages)-keepRecent]

	summary := GenerateSummary(toCompact, currentTokens-maxTokens)

	compacted := []Message{messages[0]}
	compacted = append(compacted, Message{
		Role:    "system",
		Content: summary,
		Compacted: true,
	})
	compacted = append(compacted, recent...)

	return compacted, true
}

func GenerateSummary(messages []Message, targetReduction int) string {
	var topics []string
	roleCount := make(map[string]int)

	for _, msg := range messages {
		roleCount[msg.Role]++
		if msg.Role == "user" && len(msg.Content) > 10 {
			firstLine := strings.Split(msg.Content, "\n")[0]
			if utf8.RuneCountInString(firstLine) > 80 {
				firstLine = string([]rune(firstLine)[:80]) + "..."
			}
			topics = append(topics, firstLine)
		}
	}

	parts := []string{"[Compacted"}
	if len(messages) > 0 {
		parts[0] += fmt.Sprintf(" %d msgs", len(messages))
	}
	roleParts := make([]string, 0, len(roleCount))
	for role, count := range roleCount {
		roleParts = append(roleParts, fmt.Sprintf("%s:%d", role, count))
	}
	if len(roleParts) > 0 {
		parts[0] += " " + strings.Join(roleParts, ",")
	}
	parts[0] += "]"

	if len(topics) > 0 {
		show := topics
		if len(show) > 5 {
			show = show[:5]
		}
		parts = append(parts, "Topics: "+strings.Join(show, "; "))
	}

	return strings.Join(parts, "\n")
}

type Message struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Compacted bool   `json:"compacted,omitempty"`
	Timestamp int64  `json:"ts,omitempty"`
}
