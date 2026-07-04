/**
 * Unified File Handler — Central entry for all file operations
 * Routes files to appropriate handlers based on type detection
 */

import fs from 'node:fs'
import path from 'node:path'
import { detectFileType, CATEGORIES, getMimeType } from './file-types.js'
import { handleTextFile } from './text-handler.js'
import { readImageBase64 } from '../multimodal/image-handler.js'

// ─── Image Handler ─────────────────────────────────────
function handleImageFile(filePath, cwd) {
  const resolved = path.resolve(cwd, filePath)
  if (!resolved.startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory', type: 'security' }
  }

  try {
    const stat = fs.statSync(resolved)
    if (stat.size > 10 * 1024 * 1024) {
      return { error: 'Image too large (max 10MB)', type: 'error' }
    }

    const base64 = readImageBase64(resolved)
    if (!base64) return { error: 'Failed to read image', type: 'error' }

    return {
      type: 'image',
      base64,
      mimeType: getMimeType(filePath),
      path: filePath,
      size: stat.size,
    }
  } catch (e) {
    return { error: `Failed to read image: ${e.message}`, type: 'error' }
  }
}

// ─── Archive Handler ───────────────────────────────────
function handleArchiveFile(filePath, cwd) {
  const resolved = path.resolve(cwd, filePath)
  if (!resolved.startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory', type: 'security' }
  }

  try {
    const stat = fs.statSync(resolved)
    return {
      type: 'archive',
      path: filePath,
      size: stat.size,
      description: `Archive file: ${(stat.size / 1024).toFixed(1)}KB. Use archive tools to extract.`,
      lastModified: stat.mtime.toISOString(),
    }
  } catch (e) {
    return { error: `Failed to access archive: ${e.message}`, type: 'error' }
  }
}

// ─── Binary/Reject Handler ─────────────────────────────
function handleBinaryFile(filePath, cwd) {
  const resolved = path.resolve(cwd, filePath)
  try {
    const stat = fs.statSync(resolved)
    return {
      type: 'rejected',
      path: filePath,
      size: stat.size,
      reason: 'Binary files cannot be read by Jaicode for safety reasons.',
      lastModified: stat.mtime.toISOString(),
    }
  } catch {
    return { error: 'File not found', type: 'error' }
  }
}

// ─── Main Handler ──────────────────────────────────────
export function handleFile(filePath, cwd, options = {}) {
  // Validate path
  if (!filePath || typeof filePath !== 'string') {
    return { error: 'Invalid file path', type: 'error' }
  }

  const resolved = path.resolve(cwd, filePath)
  if (!resolved.startsWith(cwd)) {
    return { error: 'Access denied: path outside project directory', type: 'security' }
  }

  if (!fs.existsSync(resolved)) {
    return { error: `File not found: ${filePath}`, type: 'error' }
  }

  // Detect type and route
  const fileType = detectFileType(filePath)

  switch (fileType.handler) {
    case 'text':
      return handleTextFile(filePath, cwd, options)
    case 'image':
      return handleImageFile(filePath, cwd)
    case 'pdf':
      return { type: 'pdf', path: filePath, note: 'PDF extraction coming in v0.10.1' }
    case 'office':
      return { type: 'office', path: filePath, note: 'Office extraction coming in v0.10.1' }
    case 'archive':
      return handleArchiveFile(filePath, cwd)
    case 'reject':
      return handleBinaryFile(filePath, cwd)
    default:
      // Unknown type — try as text first
      const textResult = handleTextFile(filePath, cwd, { ...options, maxSize: 1024 * 1024 })
      if (!textResult.error) return textResult
      return handleBinaryFile(filePath, cwd)
  }
}

// ─── Path Detection from User Input ────────────────────
export function detectFilePaths(input) {
  // Match common file path patterns
  const patterns = [
    /(?:^|\s)((?:\/[\w\s\-_.]+)+)/g,          // Unix absolute paths
    /(?:^|\s)(\.{1,2}\/[\w\s\-_.\/]+)/g,      // Relative paths
    /(?:^|\s)(\/tmp\/[\w\s\-_.]+)/g,          // Temp files
    /(?:^|\s)(\/Users\/\w+\/[\w\s\-_.\/]+)/g, // macOS home
    /(?:^|\s)(~[\w\s\-_.\/]*)/g,              // Home shortcut
  ]

  const paths = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(input)) !== null) {
      const p = match[1].trim()
      // Filter for known file extensions
      if (/\.\w{1,10}$/.test(p)) {
        paths.push(p)
      }
    }
  }

  return paths
}

export { detectFileType, CATEGORIES }
