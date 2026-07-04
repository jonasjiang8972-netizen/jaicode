/**
 * Hooks System — Pre/post action shell commands
 * Similar to Claude Code hooks: run commands before/after file edits, commits, etc.
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HOOKS_FILE = path.join(os.homedir(), '.jaicode', 'hooks.json')

// ─── Default Hooks ─────────────────────────────────────
const DEFAULT_HOOKS = {
  'pre-edit': [],      // Before writing a file
  'post-edit': [],     // After writing a file
  'pre-commit': [],    // Before git commit
  'post-commit': [],   // After git commit
  'pre-exec': [],      // Before executing shell command
  'post-exec': [],     // After executing shell command
  'session-start': [], // When session begins
  'session-end': [],   // When session ends
}

// ─── Load/Save Hooks ───────────────────────────────────
export function loadHooks() {
  try {
    return { ...DEFAULT_HOOKS, ...JSON.parse(fs.readFileSync(HOOKS_FILE, 'utf-8')) }
  } catch { return { ...DEFAULT_HOOKS } }
}

export function saveHooks(hooks) {
  try {
    const dir = path.dirname(HOOKS_FILE)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(HOOKS_FILE, JSON.stringify(hooks, null, 2))
    return true
  } catch { return false }
}

export function addHook(event, command) {
  const hooks = loadHooks()
  if (!hooks[event]) hooks[event] = []
  hooks[event].push(command)
  return saveHooks(hooks)
}

export function removeHook(event, index) {
  const hooks = loadHooks()
  if (hooks[event]) hooks[event].splice(index, 1)
  return saveHooks(hooks)
}

// ─── Execute Hooks ─────────────────────────────────────
export function executeHooks(event, cwd, context = {}) {
  const hooks = loadHooks()
  const commands = hooks[event] || []
  const results = []

  for (const cmd of commands) {
    try {
      // Replace variables in command
      const resolved = cmd
        .replace(/\$FILE/g, context.file || '')
        .replace(/\$CWD/g, cwd)
        .replace(/\$MODE/g, context.mode || '')

      const output = execSync(resolved, { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 30000 })
      results.push({ command: cmd, success: true, output: output.trim() })
    } catch (e) {
      results.push({ command: cmd, success: false, error: e.message })
    }
  }

  return results
}

export { HOOKS_FILE, DEFAULT_HOOKS }
