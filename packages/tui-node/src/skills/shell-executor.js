/**
 * Shell Executor Skill - Execute terminal commands with safety checks
 */

import { spawn } from 'node:child_process'
import path from 'node:path'

const DANGEROUS_PATTERNS = [
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
]

const TIMEOUT_MS = 30000 // 30s timeout

export function validateCommand(cmd) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(cmd)) {
      return { safe: false, reason: `Dangerous pattern detected: ${pattern}` }
    }
  }
  return { safe: true }
}

export function executeCommand(cmd, cwd) {
  return new Promise((resolve) => {
    const validation = validateCommand(cmd)
    if (!validation.safe) {
      resolve({ stdout: '', stderr: validation.reason, code: -1, blocked: true })
      return
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const proc = spawn(cmd, { cwd, shell: true, env: { ...process.env } })

    const timeout = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
    }, TIMEOUT_MS)

    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', (code) => {
      clearTimeout(timeout)
      resolve({
        stdout: stdout.slice(0, 5000),
        stderr: stderr.slice(0, 2000),
        code,
        timedOut,
      })
    })

    proc.on('error', (e) => {
      clearTimeout(timeout)
      resolve({ stdout: '', stderr: e.message, code: -1 })
    })
  })
}

export async function executeWithConfirmation(cmd, cwd, autoApprove = false) {
  if (autoApprove) {
    return executeCommand(cmd, cwd)
  }
  // In TUI mode, we return the command for user confirmation
  return { needsConfirmation: true, command: cmd }
}
