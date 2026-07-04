/**
 * Git Integration — Native git operations without shell exec
 */

import { execSync } from 'node:child_process'

// ─── Status ────────────────────────────────────────────
export function gitStatus(cwd) {
  try {
    const output = execSync('git status --porcelain', { cwd, encoding: 'utf-8' })
    const lines = output.trim().split('\n').filter(Boolean)
    const files = lines.map(line => ({
      status: line.slice(0, 2),
      path: line.slice(3),
      staged: line[0] !== ' ' && line[0] !== '?',
      modified: line[1] === 'M',
      untracked: line[0] === '?',
    }))
    return { clean: files.length === 0, files, count: files.length }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Diff ──────────────────────────────────────────────
export function gitDiff(cwd, staged = false, file = null) {
  try {
    const cmd = `git diff${staged ? ' --cached' : ''}${file ? ` -- ${file}` : ''}`
    const output = execSync(cmd, { cwd, encoding: 'utf-8' })
    return { diff: output, hasChanges: output.trim().length > 0 }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Commit ────────────────────────────────────────────
export function gitCommit(cwd, message, files = null) {
  try {
    if (files && files.length > 0) {
      execSync(`git add ${files.map(f => `"${f}"`).join(' ')}`, { cwd })
    } else {
      execSync('git add -A', { cwd })
    }
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd })
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Branch ────────────────────────────────────────────
export function gitBranch(cwd) {
  try {
    const current = execSync('git branch --show-current', { cwd, encoding: 'utf-8' }).trim()
    const branches = execSync('git branch --format="%(refname:short)"', { cwd, encoding: 'utf-8' })
      .trim().split('\n').filter(Boolean)
    return { current, branches }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Create Branch ─────────────────────────────────────
export function gitCreateBranch(cwd, name, base = null) {
  try {
    const cmd = base ? `git checkout -b "${name}" "${base}"` : `git checkout -b "${name}"`
    execSync(cmd, { cwd })
    return { success: true, name }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Log ───────────────────────────────────────────────
export function gitLog(cwd, count = 10) {
  try {
    const output = execSync(
      `git log --oneline --format="%h %s (%cr)" -${count}`,
      { cwd, encoding: 'utf-8' }
    )
    return { commits: output.trim().split('\n').filter(Boolean) }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── PR (via gh CLI) ───────────────────────────────────
export function gitCreatePR(cwd, title, body = '') {
  try {
    execSync(`gh pr create --title "${title}" --body "${body}"`, { cwd })
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Is Git Repository ─────────────────────────────────
export function isGitRepo(cwd) {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' })
    return true
  } catch { return false }
}
