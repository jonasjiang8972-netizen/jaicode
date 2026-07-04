/**
 * File Writer — Safe file writing with diff preview and confirmation
 */

import fs from 'node:fs'
import path from 'node:path'

const BACKUP_DIR = '.jaicode_backup'

// ─── Diff Parser ──────────────────────────────────────
export function parseFileBlocks(response) {
  const files = []

  // Parse FILE: format
  const filePattern = /FILE:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g
  let match
  while ((match = filePattern.exec(response)) !== null) {
    files.push({ path: match[1].trim(), content: match[2].trim(), format: 'block' })
  }

  // Parse unified diff format
  const diffPattern = /--- a\/(.+?)\n\+\+\+ b\/\1\n([\s\S]*?)(?=\n--- |\nFILE:|$)/g
  while ((match = diffPattern.exec(response)) !== null) {
    files.push({ path: match[1].trim(), diff: match[2], format: 'diff' })
  }

  return files
}

// ─── Compute Diff ─────────────────────────────────────
export function computeDiff(oldContent, newContent, filePath) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const hunks = []

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines)
  let oi = 0, ni = 0, li = 0

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni] && li < lcs.length && lcs[li] === oldLines[oi]) {
      oi++; ni++; li++
      continue
    }

    const hunk = { lines: [], oldStart: oi + 1, newStart: ni + 1 }

    while (oi < oldLines.length && !(li < lcs.length && lcs[li] === oldLines[oi])) {
      hunk.lines.push(`-${oldLines[oi]}`)
      oi++
    }
    while (ni < newLines.length && !(li < lcs.length && lcs[li] === newLines[ni])) {
      hunk.lines.push(`+${newLines[ni]}`)
      ni++
    }

    if (hunk.lines.length > 0) hunks.push(hunk)
  }

  return hunks
}

function computeLCS(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const lcs = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { lcs.push(a[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return lcs
}

// ─── Format Diff ──────────────────────────────────────
export function formatDiff(filePath, hunks) {
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`]
  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart}, +${hunk.newStart} @@`)
    for (const line of hunk.lines) lines.push(line)
  }
  return lines.join('\n')
}

// ─── Apply Diff ───────────────────────────────────────
export function applyDiff(oldContent, diffLines) {
  const result = []
  const oldLines = oldContent.split('\n')
  let oi = 0

  for (const line of diffLines) {
    if (line.startsWith('+')) {
      result.push(line.slice(1))
    } else if (line.startsWith('-')) {
      oi++
    } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
      continue
    } else {
      result.push(oldLines[oi])
      oi++
    }
  }

  while (oi < oldLines.length) result.push(oldLines[oi++])
  return result.join('\n')
}

// ─── Write File ───────────────────────────────────────
export function writeFile(cwd, filePath, content) {
  const resolved = path.resolve(cwd, filePath)

  // Security check
  if (!resolved.startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory' }
  }

  // Ensure directory exists
  const dir = path.dirname(resolved)
  fs.mkdirSync(dir, { recursive: true })

  // Backup existing file
  if (fs.existsSync(resolved)) {
    const backupDir = path.join(cwd, BACKUP_DIR, Date.now().toString())
    fs.mkdirSync(backupDir, { recursive: true })
    fs.copyFileSync(resolved, path.join(backupDir, path.basename(filePath)))
  }

  // Write
  fs.writeFileSync(resolved, content, 'utf-8')
  return { success: true, path: filePath, size: Buffer.byteLength(content) }
}

export { BACKUP_DIR }
