/**
 * File Reader Skill - Read project files and inject into LLM context
 */

import fs from 'node:fs'
import path from 'node:path'

const MAX_FILE_SIZE = 50 * 1024 // 50KB max per file
const MAX_CONTEXT_CHARS = 8000 // Max total context to inject

// Files/directories to always ignore
const IGNORE_PATTERNS = [
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '.jaicode_backup', '.DS_Store', 'bun.lock', 'package-lock.json',
  '.png', '.jpg', '.gif', '.ico', '.woff', '.ttf',
]

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => filePath.includes(p))
}

export function scanProject(cwd, maxDepth = 3) {
  const result = { files: [], structure: '', totalSize: 0 }

  function walk(dir, depth) {
    if (depth > maxDepth) return
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.relative(cwd, fullPath)

      if (shouldIgnore(relPath)) continue

      if (entry.isDirectory()) {
        result.files.push({ path: relPath + '/', type: 'dir' })
        walk(fullPath, depth + 1)
      } else {
        let size = 0
        try { size = fs.statSync(fullPath).size } catch {}
        result.files.push({ path: relPath, type: 'file', size })
        result.totalSize += size
      }
    }
  }

  walk(cwd, 0)
  result.structure = result.files.map(f => f.path).join('\n')
  return result
}

export function readFile(cwd, filePath) {
  // Handle image files gracefully (don't crash on binary files)
  const ext = path.extname(filePath).toLowerCase()
  const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.ico', '.svg']
  if (IMAGE_EXTS.includes(ext)) {
    return { error: `Image file detected: ${filePath}\nUse /read for text files only. Images require VL model support.`, isImage: true, path: filePath }
  }

  // Security: prevent path traversal
  if (!path.resolve(cwd, filePath).startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory' }
  }

  if (shouldIgnore(filePath)) {
    return { error: `File ignored: ${filePath}` }
  }

  try {
    const stat = fs.statSync(path.resolve(cwd, filePath))
    if (stat.isDirectory()) {
      return { error: `Path is directory: ${filePath}` }
    }
    if (stat.size > MAX_FILE_SIZE) {
      return { error: `File too large (${stat.size} bytes, max ${MAX_FILE_SIZE})` }
    }
    const content = fs.readFileSync(path.resolve(cwd, filePath), 'utf-8')
    return { content, size: stat.size, path: filePath }
  } catch (e) {
    return { error: `Cannot read ${filePath}: ${e.message}` }
  }
}

export function readMultipleFiles(cwd, filePaths) {
  const results = []
  let totalChars = 0

  for (const fp of filePaths) {
    if (totalChars >= MAX_CONTEXT_CHARS) {
      results.push({ path: fp, skipped: true, reason: 'Context limit reached' })
      continue
    }
    const result = readFile(cwd, fp)
    if (result.content) {
      totalChars += result.content.length
    }
    results.push({ ...result, path: fp })
  }

  return results
}

export function buildProjectSummary(cwd) {
  const scan = scanProject(cwd)
  const summary = [
    `Project scan: ${scan.files.length} entries`,
    `Total size: ${(scan.totalSize / 1024).toFixed(1)}KB`,
    `File structure:`,
    scan.structure
  ]
  return summary.join('\n')
}

export function buildFileContext(cwd, filePaths) {
  const results = readMultipleFiles(cwd, filePaths)
  const parts = []

  for (const r of results) {
    if (r.error) {
      parts.push(`[Error reading ${r.path}: ${r.error}]`)
    } else if (r.skipped) {
      parts.push(`[Skipped ${r.path}: ${r.reason}]`)
    } else {
      parts.push(`--- ${r.path} ---\n${r.content}`)
    }
  }

  return parts.join('\n\n')
}
