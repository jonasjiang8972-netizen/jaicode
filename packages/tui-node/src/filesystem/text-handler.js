/**
 * Text Handler — Read, analyze, and prepare text files for LLM context
 */

import fs from 'node:fs'
import path from 'node:path'

// ─── Encoding Detection ────────────────────────────────
function detectEncoding(buffer) {
  // Check BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'utf-8-bom'
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'utf-16le'
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'utf-16be'

  // Check for binary (NULL bytes in first 1024 bytes)
  const checkLen = Math.min(1024, buffer.length)
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0x00) return 'binary'
  }

  return 'utf-8'
}

// ─── Language Detection ────────────────────────────────
function detectLanguage(filePath, content) {
  const ext = path.extname(filePath).toLowerCase()
  const langMap = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
    '.rb': 'ruby', '.php': 'php', '.scala': 'scala',
    '.md': 'markdown', '.json': 'json', '.yaml': 'yaml',
    '.yml': 'yaml', '.toml': 'toml', '.xml': 'xml',
    '.html': 'html', '.css': 'css', '.scss': 'scss',
    '.sql': 'sql', '.sh': 'bash', '.bash': 'bash',
  }
  return langMap[ext] || 'text'
}

// ─── Smart Truncation ─────────────────────────────────
function smartTruncate(content, maxChars = 8000) {
  if (content.length <= maxChars) return { text: content, truncated: false }

  // Try to truncate at a logical boundary
  const truncated = content.slice(0, maxChars)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxChars * 0.7) {
    return {
      text: truncated.slice(0, lastNewline) + '\n... [truncated]',
      truncated: true,
      originalLength: content.length,
    }
  }

  return {
    text: truncated + '... [truncated]',
    truncated: true,
    originalLength: content.length,
  }
}

// ─── Main Handler ─────────────────────────────────────
export function handleTextFile(filePath, cwd, options = {}) {
  const { maxSize = 5 * 1024 * 1024, maxChars = 8000 } = options

  // Security: path traversal check
  const resolved = path.resolve(cwd, filePath)
  if (!resolved.startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory', type: 'security' }
  }

  try {
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) return { error: 'Path is not a file', type: 'error' }
    if (stat.size > maxSize) {
      return {
        error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max ${maxSize / 1024 / 1024}MB)`,
        type: 'error',
      }
    }
    if (stat.size === 0) return { error: 'File is empty', type: 'error' }

    // Read raw buffer for encoding detection
    const fd = fs.openSync(resolved, 'r')
    const buffer = Buffer.alloc(Math.min(4096, stat.size))
    fs.readSync(fd, buffer, 0, buffer.length, 0)
    fs.closeSync(fd)

    const encoding = detectEncoding(buffer)
    if (encoding === 'binary') {
      return { error: 'File appears to be binary, not text', type: 'error' }
    }

    // Read full content
    const content = fs.readFileSync(resolved, 'utf-8')
    const language = detectLanguage(filePath, content)
    const { text, truncated, originalLength } = smartTruncate(content, maxChars)
    const lines = content.split('\n').length
    const chars = content.length

    return {
      type: 'text',
      content: text,
      language,
      truncated,
      originalLength,
      lines,
      chars,
      path: filePath,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    }
  } catch (e) {
    return { error: `Failed to read: ${e.message}`, type: 'error' }
  }
}

export { detectEncoding, detectLanguage, smartTruncate }
