/**
 * Image Handler — Detect and process image files for VL model understanding
 */

import fs from 'node:fs'
import path from 'node:path'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

// ─── Detection ─────────────────────────────────────────
export function detectImagePaths(input) {
  const paths = []
  // Match file paths that look like images
  const regex = /[\/\w\-\.]+\.(?:png|jpg|jpeg|webp|gif|bmp)/gi
  let match
  while ((match = regex.exec(input)) !== null) {
    paths.push(match[0])
  }
  return paths
}

// ─── Validation ────────────────────────────────────────
export function validateImage(imagePath) {
  try {
    const resolved = path.resolve(imagePath)
    const stat = fs.statSync(resolved)

    if (!stat.isFile()) {
      return { valid: false, error: `Not a file: ${imagePath}` }
    }

    if (stat.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `Image too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)` }
    }

    const ext = path.extname(resolved).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `Unsupported format: ${ext}` }
    }

    return { valid: true, path: resolved, size: stat.size }
  } catch (e) {
    return { valid: false, error: `Cannot access image: ${e.message}` }
  }
}

// ─── Read & Encode ─────────────────────────────────────
export function readImageBase64(imagePath) {
  try {
    const buffer = fs.readFileSync(imagePath)
    return buffer.toString('base64')
  } catch (e) {
    return null
  }
}

// ─── Get MIME Type ─────────────────────────────────────
export function getMimeType(imagePath) {
  const ext = path.extname(imagePath).toLowerCase()
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  }
  return map[ext] || 'application/octet-stream'
}

export { IMAGE_EXTENSIONS, MAX_IMAGE_SIZE }
