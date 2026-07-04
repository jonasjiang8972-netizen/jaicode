/**
 * Input Filter — Detect and block malicious input before LLM call
 */

// ─── Injection Patterns ────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)/i,
  /system\s*:\s*/i,
  /new\s+persona/i,
  /forget\s+(everything|all|your)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /do\s+anything\s+now/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(a|an)\s+/i,
  /\[system\]/i,
  /<system>/i,
  /\{\{.*\}\}/,
  /INST\s*:/i,
  /\<\|im_start\|\>/i,
  /\<\|im_end\|\>/i,
]

// ─── Sensitive Data Patterns ───────────────────────────
const SENSITIVE_PATTERNS = [
  { pattern: /\b\d{17}[\dXx]\b/, label: 'ID_CARD' },
  { pattern: /\b1[3-9]\d{9}\b/, label: 'PHONE' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, label: 'EMAIL' },
  { pattern: /\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b/i, label: 'API_KEY' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, label: 'CREDIT_CARD' },
  { pattern: /password\s*[=:]\s*\S+/i, label: 'PASSWORD' },
]

// ─── Malicious Command Patterns ────────────────────────
const MALICIOUS_COMMAND_PATTERNS = [
  /rm\s+-rf?\s+\//,
  /rm\s+-rf?\s+~/,
  /sudo\s+/,
  /chmod\s+777/,
  /mkfs/,
  /dd\s+if=/,
  />\s*\/dev\//,
  /curl.*\|.*sh/,
  /wget.*\|.*sh/,
  /eval\s*\(/,
  /exec\s*\(/,
]

// ─── Main Filter Function ──────────────────────────────
export function filterInput(rawText) {
  const result = {
    clean: rawText,
    blocked: false,
    reason: null,
    warnings: [],
  }

  // Check injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(rawText)) {
      result.blocked = true
      result.reason = `Prompt injection detected: ${pattern.source}`
      return result
    }
  }

  // Check for sensitive data leaks
  for (const { pattern, label } of SENSITIVE_PATTERNS) {
    if (pattern.test(rawText)) {
      result.warnings.push(`Sensitive data detected: ${label}`)
      result.clean = result.clean.replace(pattern, `[${label}_REDACTED]`)
    }
  }

  // Check for malicious commands
  for (const pattern of MALICIOUS_COMMAND_PATTERNS) {
    if (pattern.test(rawText)) {
      result.warnings.push(`Potentially dangerous command: ${pattern.source}`)
    }
  }

  return result
}

export { INJECTION_PATTERNS, SENSITIVE_PATTERNS, MALICIOUS_COMMAND_PATTERNS }
