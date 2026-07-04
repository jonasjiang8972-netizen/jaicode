/**
 * Session Memory — Cross-session conversation persistence
 * Stores conversation history in ~/.jaicode/sessions/{date}.jsonl
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SESSIONS_DIR = path.join(os.homedir(), '.jaicode', 'sessions')
const MAX_RECENT_MESSAGES = 20
const MAX_CONTEXT_CHARS = 8000
const SESSION_EXPIRY_DAYS = 7

function getSessionFile() {
  const today = new Date().toISOString().slice(0, 10)
  return path.join(SESSIONS_DIR, `${today}.jsonl`)
}

function ensureDir() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

// ─── Privacy Sanitization ──────────────────────────────
function sanitize(text) {
  if (!text) return text
  return text
    .replace(/\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b/gi, '[API_KEY_REDACTED]')
    .replace(/\b1[3-9]\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{17}[\dXx]\b/g, '[ID_REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/password\s*[=:]\s*\S+/gi, 'password=[REDACTED]')
    .slice(0, 2000)
}

// ─── Save ─────────────────────────────────────────────
export function saveSessionMessage(message) {
  try {
    ensureDir()
    const file = getSessionFile()
    const entry = JSON.stringify({
      role: message.role,
      content: sanitize(message.content),
      ts: Date.now(),
    })
    fs.appendFileSync(file, entry + '\n')
  } catch { /* ignore write errors */ }
}

// ─── Load Recent Context ──────────────────────────────
export function loadRecentContext(limit = MAX_RECENT_MESSAGES) {
  try {
    ensureDir()
    const file = getSessionFile()
    if (!fs.existsSync(file)) return []

    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
    const messages = lines.slice(-limit).map(l => {
      try { return JSON.parse(l) } catch { return null }
    }).filter(Boolean)

    return messages.map(m => ({ role: m.role, content: m.content }))
  } catch { return [] }
}

// ─── Compress Old Sessions ────────────────────────────
export function compressOldSessions() {
  try {
    ensureDir()
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl'))
    const now = Date.now()
    const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000

    for (const file of files) {
      const filePath = path.join(SESSIONS_DIR, file)
      const stat = fs.statSync(filePath)
      if (now - stat.mtimeMs > maxAge) {
        // Compress: count messages, extract summary
        const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean)
        const summary = {
          type: 'compressed',
          date: file.replace('.jsonl', ''),
          totalMessages: lines.length,
          summary: `${lines.length} messages on ${file.replace('.jsonl', '')}`,
        }
        fs.writeFileSync(filePath + '.summary', JSON.stringify(summary))
        fs.unlinkSync(filePath)
      }
    }
  } catch { /* ignore */ }
}

// ─── Get Context Window ───────────────────────────────
export function getContextWindow() {
  const recent = loadRecentContext(MAX_RECENT_MESSAGES)
  // Estimate tokens (rough: 1 token ≈ 4 chars for English, 2 chars for CJK)
  let totalChars = 0
  for (const msg of recent) {
    totalChars += msg.content.length
  }

  // If too many chars, reduce to last 10 messages
  if (totalChars > MAX_CONTEXT_CHARS) {
    return recent.slice(-10)
  }

  return recent
}

export { SESSIONS_DIR }
