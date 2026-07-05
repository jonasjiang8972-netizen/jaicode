/**
 * Process Resilience — Auto-restart on crash + health monitoring
 * Similar to systemd but for Node.js processes
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PID_FILE = path.join(os.homedir(), '.jaicode', '.daemon.pid')
const MAX_RESTARTS = 5
const RESTART_WINDOW = 60000 // 1 minute

let restartCount = 0
let restartWindowStart = Date.now()

// ─── Start with Auto-Restart ───────────────────────────
export function startWithResilience(scriptPath, args = []) {
  const child = spawn(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    detached: false,
  })

  // Write PID file
  try {
    fs.mkdirSync(path.dirname(PID_FILE), { recursive: true })
    fs.writeFileSync(PID_FILE, child.pid.toString())
  } catch { /* ignore */ }

  child.on('exit', (code) => {
    if (code === 0 || code === null) {
      // Clean exit, don't restart
      cleanup()
      return
    }

    // Check restart limits
    const now = Date.now()
    if (now - restartWindowStart > RESTART_WINDOW) {
      restartCount = 0
      restartWindowStart = now
    }

    restartCount++

    if (restartCount >= MAX_RESTARTS) {
      process.stderr.write(`[Jaicode] Max restarts (${MAX_RESTARTS}) reached. Exiting.\n`)
      cleanup()
      process.exit(1)
    }

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, restartCount - 1), 30000)
    process.stderr.write(`[Jaicode] Process exited (code: ${code}). Restarting in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})...\n`)

    setTimeout(() => {
      startWithResilience(scriptPath, args)
    }, delay)
  })

  return child
}

// ─── Health Check ──────────────────────────────────────
export function checkHealth() {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim())
    try {
      process.kill(pid, 0)
      return { healthy: true, pid }
    } catch {
      return { healthy: false, pid, error: 'Process not running' }
    }
  } catch {
    return { healthy: false, error: 'No PID file found' }
  }
}

// ─── Stop Daemon ───────────────────────────────────────
export function stopDaemon() {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim())
    process.kill(pid, 'SIGTERM')
    cleanup()
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Cleanup ───────────────────────────────────────────
function cleanup() {
  try { fs.unlinkSync(PID_FILE) } catch { /* ignore */ }
}

export { PID_FILE, MAX_RESTARTS, RESTART_WINDOW }
