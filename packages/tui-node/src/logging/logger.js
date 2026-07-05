/**
 * Structured Logger — JSON lines + levels + file output
 * Replaces basic console.log throughout the codebase
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const LOG_DIR = path.join(os.homedir(), '.jaicode', 'logs')

let logLevel = 'INFO'
let logFile = null
let logStream = null

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

// ─── Configuration ─────────────────────────────────────
export function initLogger(options = {}) {
  logLevel = options.level || process.env.JAICODE_LOG_LEVEL || 'INFO'

  if (options.file !== false) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true })
      const date = new Date().toISOString().slice(0, 10)
      logFile = path.join(LOG_DIR, `${date}.jsonl`)
      logStream = fs.createWriteStream(logFile, { flags: 'a' })
    } catch { /* ignore file logging errors */ }
  }
}

// ─── Core Logging ──────────────────────────────────────
export function log(level, message, data = {}) {
  if (LEVELS[level] < LEVELS[logLevel]) return

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    pid: process.pid,
    ...data,
  }

  const line = JSON.stringify(entry)

  // Console output (colorized)
  const colors = {
    DEBUG: '\x1B[90m',  // gray
    INFO: '\x1B[36m',   // cyan
    WARN: '\x1B[33m',   // yellow
    ERROR: '\x1B[31m',  // red
  }
  const reset = '\x1B[0m'
  const prefix = process.stdout.isTTY ? `${colors[level]}[${level}]${reset}` : `[${level}]`
  process.stdout.write(`${prefix} ${message}\n`)

  // File output (JSON)
  if (logStream) {
    try { logStream.write(line + '\n') } catch { /* ignore write errors */ }
  }
}

// ─── Convenience Methods ───────────────────────────────
export const debug = (msg, data) => log('DEBUG', msg, data)
export const info = (msg, data) => log('INFO', msg, data)
export const warn = (msg, data) => log('WARN', msg, data)
export const error = (msg, data) => log('ERROR', msg, data)

// ─── Log Level ─────────────────────────────────────────
export function setLevel(level) { logLevel = level }
export function getLevel() { return logLevel }

// ─── Flush & Close ─────────────────────────────────────
export function flush() {
  if (logStream && !logStream.destroyed) {
    logStream.end()
  }
}

export { LOG_DIR }
