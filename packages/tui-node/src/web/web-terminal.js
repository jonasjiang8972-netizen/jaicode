/**
 * Web UI — ttyd-based web terminal integration
 * Provides browser-based access to Jaicode TUI
 */

import { execSync, spawn } from 'node:child_process'
import path from 'node:path'
import { info, error, debug } from '../logging/logger.js'

const DEFAULT_PORT = 3002
const DEFAULT_CMD = 'jaicode'

// ─── Start Web Terminal ────────────────────────────────
export function startWebTerminal(options = {}) {
  const port = options.port || DEFAULT_PORT
  const cmd = options.cmd || DEFAULT_CMD
  const cwd = options.cwd || process.cwd()

  try {
    // Check if ttyd is available
    try {
      execSync('which ttyd', { stdio: 'pipe' })
    } catch {
      return {
        error: 'ttyd not installed',
        install: 'brew install ttyd (macOS) or apt install ttyd (Linux)',
      }
    }

    // Start ttyd
    const args = [
      '--port', String(port),
      '--cwd', cwd,
      // '--readonly', // Remove for interactive
      cmd,
    ]

    info('Starting web terminal', { port })
    const proc = spawn('ttyd', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })

    proc.stdout.on('data', d => debug('ttyd stdout', { data: d.toString().trim() }))
    proc.stderr.on('data', d => error('ttyd stderr', { data: d.toString().trim() }))

    proc.unref()

    return {
      success: true,
      url: `http://localhost:${port}`,
      port,
      pid: proc.pid,
    }
  } catch (e) {
    error('Failed to start web terminal', { error: e.message })
    return { error: e.message }
  }
}

// ─── Check Web Terminal Status ─────────────────────────
export function checkWebTerminal(port = DEFAULT_PORT) {
  try {
    execSync(`lsof -i :${port} -t`, { stdio: 'pipe' })
    return { running: true, port }
  } catch {
    return { running: false, port }
  }
}

// ─── Stop Web Terminal ─────────────────────────────────
export function stopWebTerminal(port = DEFAULT_PORT) {
  try {
    const pids = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8' }).trim()
    if (pids) {
      execSync(`kill ${pids.split('\n').join(' ')}`)
      return { success: true }
    }
    return { error: 'No process found on port ' + port }
  } catch (e) {
    return { error: e.message }
  }
}

export { DEFAULT_PORT, DEFAULT_CMD }
