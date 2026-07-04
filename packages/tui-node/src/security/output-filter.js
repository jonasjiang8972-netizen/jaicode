/**
 * Output Filter — Detect and redact sensitive info from LLM responses
 */

// ─── Sensitive Patterns ────────────────────────────────
const SENSITIVE_PATTERNS = [
  { pattern: /\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b/gi, label: 'API_KEY' },
  { pattern: /\b1[3-9]\d{9}\b/g, label: 'PHONE' },
  { pattern: /\b\d{17}[\dXx]\b/g, label: 'ID_CARD' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: 'EMAIL' },
  { pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, label: 'INTERNAL_IP' },
  { pattern: /\b(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g, label: 'INTERNAL_IP' },
  { pattern: /\b(192\.168\.\d{1,3}\.\d{1,3})\b/g, label: 'INTERNAL_IP' },
  { pattern: /password\s*[=:]\s*\S+/gi, label: 'PASSWORD' },
  { pattern: /secret\s*[=:]\s*\S+/gi, label: 'SECRET' },
  { pattern: /token\s*[=:]\s*\S+/gi, label: 'TOKEN' },
]

// ─── Main Filter Function ──────────────────────────────
export function filterOutput(rawText) {
  const result = {
    clean: rawText,
    hasSensitive: false,
    redactedCount: 0,
  }

  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    if (pattern.test(rawText)) {
      result.hasSensitive = true
      result.clean = result.clean.replace(pattern, `[${label}_REDACTED]`)
      result.redactedCount++
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0
  }

  return result
}

export { SENSITIVE_PATTERNS }
