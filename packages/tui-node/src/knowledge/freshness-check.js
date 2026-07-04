/**
 * Knowledge Freshness Check
 * Detects time-sensitive queries and adjusts System Prompt accordingly
 */

const KNOWLEDGE_CUTOFF = '2025-01-01'

// Time-related keywords that suggest the query may be about recent events
const TIME_KEYWORDS = [
  // Chinese
  '最新', '最近', '今天', '今年', '本月', '上周', '昨天', '明天',
  '2026', '2027', '2028',
  '新发布', '新版本', '新特性', '新框架', '新工具',
  // English
  'latest', 'recent', 'new release', 'just launched', 'announced',
  'this year', 'this month', 'this week', 'today', 'yesterday', 'tomorrow',
  '2026', '2027', '2028',
]

// Patterns that indicate time-sensitive queries
const TIME_PATTERNS = [
  /\d{4}年/,           // "2026年"
  /今年|本年|这一年/,
  /最新.*发布/,
  /有什么新/,
  /new.*\d{4}/i,
  /released.*\d{4}/i,
  /launched.*\d{4}/i,
]

// ─── Main Check ───────────────────────────────────────
export function checkFreshness(input) {
  const result = {
    isTimeSensitive: false,
    detectedYear: null,
    hint: null,
    modified: false,
  }

  // Check for year mentions
  const yearMatch = input.match(/\b(20\d{2})\b/)
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    const cutoffYear = parseInt(KNOWLEDGE_CUTOFF.slice(0, 4))
    if (year > cutoffYear) {
      result.isTimeSensitive = true
      result.detectedYear = yearMatch[1]
      result.hint = `Knowledge cutoff: ${KNOWLEDGE_CUTOFF}. User asks about ${yearMatch[1]}.`
      result.modified = true
      return result
    }
  }

  // Check for time keywords
  for (const keyword of TIME_KEYWORDS) {
    if (input.toLowerCase().includes(keyword.toLowerCase())) {
      result.isTimeSensitive = true
      result.hint = `Knowledge cutoff: ${KNOWLEDGE_CUTOFF}. Time-sensitive keyword detected: "${keyword}".`
      result.modified = true
      return result
    }
  }

  // Check for time patterns
  for (const pattern of TIME_PATTERNS) {
    if (pattern.test(input)) {
      result.isTimeSensitive = true
      result.hint = `Knowledge cutoff: ${KNOWLEDGE_CUTOFF}. Time pattern detected.`
      result.modified = true
      return result
    }
  }

  return result
}

// ─── Get System Prompt Modifier ───────────────────────
export function getFreshnessPromptModifier(input) {
  const check = checkFreshness(input)
  if (!check.modified) return ''

  return `
---
KNOWLEDGE FRESHNESS NOTICE:
Your knowledge cutoff is ${KNOWLEDGE_CUTOFF}.
The user's question may involve events or information after this date.
If you cannot answer accurately, please:
1. Clearly state your knowledge cutoff date
2. Suggest the user verify with up-to-date sources
3. Offer to help with web search if available
---`
}

export { KNOWLEDGE_CUTOFF }
