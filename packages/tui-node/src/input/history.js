/**
 * Input History & Autocomplete
 * Command history, file path completion, command suggestions
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

const HISTORY_FILE = path.join(os.homedir(), '.jaicode', 'history.jsonl')
const MAX_HISTORY = 500

// ─── Command Suggestions ───────────────────────────────
const COMMANDS = [
  { cmd: '/quit', desc: 'exit Jaicode' },
  { cmd: '/clear', desc: 'clear screen' },
  { cmd: '/mode', desc: 'switch mode (plan/code/debug/ask)' },
  { cmd: '/config', desc: 'configure providers' },
  { cmd: '/read <file>', desc: 'read a project file' },
  { cmd: '/exec <cmd>', desc: 'execute shell command' },
  { cmd: '/stats', desc: 'show usage statistics' },
  { cmd: '/caps', desc: 'show capability audit' },
  { cmd: '/fix <id>', desc: 'develop missing capability' },
  { cmd: '/audit', desc: 'show security audit log' },
  { cmd: '/help', desc: 'show available commands' },
]

// ─── History Management ────────────────────────────────
export function loadHistory() {
  try {
    const dir = path.dirname(HISTORY_FILE)
    fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(HISTORY_FILE)) return []
    const lines = fs.readFileSync(HISTORY_FILE, 'utf-8').trim().split('\n').filter(Boolean)
    return lines.slice(-MAX_HISTORY).map(l => JSON.parse(l))
  } catch { return [] }
}

export function saveToHistory(input) {
  try {
    const dir = path.dirname(HISTORY_FILE)
    fs.mkdirSync(dir, { recursive: true })
    const entry = JSON.stringify({ input, ts: Date.now() })
    fs.appendFileSync(HISTORY_FILE, entry + '\n')
  } catch { /* ignore */ }
}

// ─── Autocomplete ──────────────────────────────────────
export function autocomplete(partial, cwd) {
  if (!partial) return { suggestions: [], type: 'none' }

  // Command completion
  if (partial.startsWith('/')) {
    const matches = COMMANDS.filter(c => c.cmd.startsWith(partial))
    return { suggestions: matches.map(c => `${c.cmd} — ${c.desc}`), type: 'command' }
  }

  // File path completion
  if (partial.includes('/') || partial.includes('.')) {
    try {
      const dir = path.dirname(path.resolve(cwd, partial))
      const prefix = path.basename(partial)
      const entries = fs.readdirSync(dir).filter(e => e.startsWith(prefix))
      const suggestions = entries.map(e => {
        const full = path.join(path.dirname(partial), e)
        return fs.statSync(path.join(dir, e)).isDirectory() ? full + '/' : full
      })
      return { suggestions: suggestions.slice(0, 10), type: 'file' }
    } catch { return { suggestions: [], type: 'file' } }
  }

  return { suggestions: [], type: 'none' }
}

export { COMMANDS, HISTORY_FILE }
