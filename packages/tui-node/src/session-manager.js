/**
 * Session Manager — PID file + session persistence + restore
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const PID_DIR = path.join(os.homedir(), '.jaicode', 'sessions')

function getPidFile() {
  return path.join(PID_DIR, `${process.pid}.json`)
}

function ensureDir() {
  fs.mkdirSync(PID_DIR, { recursive: true })
}

// ─── Save Session ──────────────────────────────────────
export function saveSession(state) {
  try {
    ensureDir()
    const session = {
      pid: process.pid,
      cwd: state.cwd,
      mode: state.mode,
      messages: state.messages,
      timestamp: Date.now(),
    }
    fs.writeFileSync(getPidFile(), JSON.stringify(session, null, 2))
  } catch { /* ignore */ }
}

// ─── List Active Sessions ──────────────────────────────
export function listSessions() {
  try {
    ensureDir()
    const files = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.json'))
    const sessions = []
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PID_DIR, file), 'utf-8'))
        // Check if process is still running
        try { process.kill(data.pid, 0); data.active = true } catch { data.active = false }
        sessions.push(data)
      } catch { /* skip corrupt */ }
    }
    return sessions.sort((a, b) => b.timestamp - a.timestamp)
  } catch { return [] }
}

// ─── Restore Session ───────────────────────────────────
export function restoreSession(pid) {
  try {
    const file = path.join(PID_DIR, `${pid}.json`)
    if (!fs.existsSync(file)) return null
    const session = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return session
  } catch { return null }
}

// ─── Clean Session Files ───────────────────────────────
export function cleanSession(pid) {
  try {
    const file = path.join(PID_DIR, `${pid || process.pid}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch { /* ignore */ }
}

// ─── Auto-clean stale sessions ─────────────────────────
export function cleanStaleSessions(maxAge = 24 * 60 * 60 * 1000) {
  try {
    ensureDir()
    const now = Date.now()
    const files = fs.readdirSync(PID_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PID_DIR, file), 'utf-8'))
        if (now - data.timestamp > maxAge) fs.unlinkSync(path.join(PID_DIR, file))
      } catch {
        fs.unlinkSync(path.join(PID_DIR, file))
      }
    }
  } catch { /* ignore */ }
}

export { PID_DIR }
