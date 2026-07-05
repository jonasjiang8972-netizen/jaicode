<<<<<<< Updated upstream
// Jaicode Context Compaction - Token management + LCS summarization
package context

import (
	"fmt"
	"strings"
	"unicode/utf8"
=======
package context

import (
	"strconv"
	"strings"
>>>>>>> Stashed changes
)

func EstimateTokens(text string) int {
	if text == "" {
		return 0
	}
<<<<<<< Updated upstream
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
=======
	cjk, other := 0, 0
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fff {
			cjk++
		} else {
			other++
		}
	}
	return other/4 + cjk/2 + 1
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func CountTokens(messages []Message) int {
	total := 0
	for _, m := range messages {
		total += EstimateTokens(m.Content) + 4
>>>>>>> Stashed changes
	}
	return total
}

<<<<<<< Updated upstream
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
=======
func ShouldCompact(messages []Message, max int) bool {
	return CountTokens(messages) > max
}

func Compact(messages []Message, max int) ([]Message, bool) {
	if CountTokens(messages) <= max {
		return messages, false
	}
	if len(messages) <= 6 {
		return messages, false
	}
	// Keep first system + last 4, summarize the middle
	result := []Message{messages[0]}
	middle := messages[1 : len(messages)-4]
	topics := []string{}
	for _, m := range middle {
		if m.Role == "user" {
			first := strings.Split(m.Content, "\n")[0]
			if len(first) > 80 {
				first = first[:80] + "..."
			}
			topics = append(topics, first)
		}
	}
	result = append(result, Message{
		Role:    "system",
		Content: "[Compacted " + strconv.Itoa(len(middle)) + " msgs] Topics: " + strings.Join(topics[:min(5, len(topics))], "; "),
	})
	result = append(result, messages[len(messages)-4:]...)
	return result, true
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Unused but prevents import errors
var _ = strings.Split
>>>>>>> Stashed changes
