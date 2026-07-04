/**
 * Context Compaction — Token management and conversation summarization
 */

// ─── Token Estimation ──────────────────────────────────
export function estimateTokens(text) {
  // Rough estimation: 1 token ≈ 4 chars (English), 2 chars (CJK)
  let cjkCount = 0
  let otherCount = 0
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) cjkCount++
    else otherCount++
  }
  return Math.ceil(otherCount / 4 + cjkCount / 2)
}

// ─── Session Token Count ───────────────────────────────
export function countSessionTokens(messages) {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content || '') + 4 // role overhead
  }
  return total
}

// ─── Compact Messages ──────────────────────────────────
export function compactMessages(messages, maxTokens = 4000) {
  const currentTokens = countSessionTokens(messages)

  if (currentTokens <= maxTokens) {
    return { messages, compacted: false, tokens: currentTokens }
  }

  // Strategy: keep first 2 (always recent), summarize middle, keep last N
  const keepRecent = 4
  const recent = messages.slice(-keepRecent)
  const toCompact = messages.slice(2, -keepRecent)

  if (toCompact.length === 0) {
    return { messages: recent, compacted: true, tokens: countSessionTokens(recent) }
  }

  // Generate summary of compacted messages
  const summary = generateSummary(toCompact)

  const compacted = [
    messages[0], // system/initial
    { role: 'system', content: summary, compacted: true },
    ...recent,
  ]

  return { messages: compacted, compacted: true, tokens: countSessionTokens(compacted) }
}

// ─── Generate Summary ──────────────────────────────────
function generateSummary(messages) {
  const roles = {}
  const topics = []

  for (const msg of messages) {
    roles[msg.role] = (roles[msg.role] || 0) + 1
    // Extract first line of each message as topic hint
    const firstLine = (msg.content || '').split('\n')[0].slice(0, 80)
    if (firstLine && msg.role === 'user') topics.push(firstLine)
  }

  const parts = [`[Compacted ${messages.length} messages]`]
  parts.push(`Roles: ${Object.entries(roles).map(([r, c]) => `${r}(${c})`).join(', ')}`)
  if (topics.length > 0) {
    parts.push(`Topics: ${topics.slice(0, 5).join('; ')}`)
  }

  return parts.join('\n')
}

// ─── Auto-Compact Decision ─────────────────────────────
export function shouldCompact(messages, maxTokens = 6000) {
  return countSessionTokens(messages) > maxTokens
}

export { countSessionTokens as getTokenCount }
