/**
 * Hash Index - Content-addressable file tracking
 * Tracks file hashes to determine what's "static" vs "dynamic"
 */

import { createHash } from 'node:crypto'

export class HashIndex {
  constructor() {
    this.indexes = new Map()
    this.sessionStart = Date.now()
  }

  addFile(filePath, content, metadata = {}) {
    const hash = this.computeHash(content)
    this.indexes.set(filePath, {
      hash,
      content,
      timestamp: Date.now(),
      size: content.length,
      ...metadata,
    })
    return hash
  }

  computeHash(content) {
    return createHash('sha256').update(content).digest('hex')
  }

  removeFile(filePath) {
    this.indexes.delete(filePath)
  }

  hasFile(filePath) {
    return this.indexes.has(filePath)
  }

  getHash(filePath) {
    return this.indexes.get(filePath)?.hash
  }

  /**
   * Get all files that haven't changed since the session started
   */
  getStaticPrefix() {
    const staticParts = []
    for (const [filePath, entry] of this.indexes) {
      if (entry.timestamp <= this.sessionStart) {
        staticParts.push({
          path: filePath,
          hash: entry.hash,
          content: entry.content,
        })
      }
    }
    // Sort for character-level consistency
    staticParts.sort((a, b) => a.path.localeCompare(b.path))
    return staticParts
  }

  /**
   * Get files changed after the session started (dynamic suffix)
   */
  getDynamicSuffix() {
    const dynamicParts = []
    for (const [filePath, entry] of this.indexes) {
      if (entry.timestamp > this.sessionStart) {
        dynamicParts.push({
          path: filePath,
          hash: entry.hash,
          content: entry.content,
        })
      }
    }
    dynamicParts.sort((a, b) => a.path.localeCompare(b.path))
    return dynamicParts
  }

  /**
   * Split context into cacheable prefix + dynamic suffix
   */
  splitContext(allFiles, threshold = 1024) {
    const sorted = [...allFiles].sort((a, b) => a.path.localeCompare(b.path))

    const prefix = []
    const suffix = []
    let prefixTokens = 0

    for (const file of sorted) {
      const fileTokens = this.estimateTokens(file.content || '')

      if (prefixTokens + fileTokens < threshold) {
        prefix.push(file)
        prefixTokens += fileTokens
      } else {
        suffix.push(file)
      }
    }

    return {
      prefix,
      suffix,
      prefixTokens,
      suffixTokens: suffix.reduce((sum, f) => sum + this.estimateTokens(f.content || ''), 0),
      useCache: prefixTokens >= threshold,
    }
  }

  estimateTokens(text) {
    if (!text) return 0
    const cjkChars = (text.match(/[一-鿿一-鿿぀-ヿ가-힯]/g) || []).length
    const otherChars = text.length - cjkChars
    return Math.ceil(cjkChars / 2 + otherChars / 4)
  }

  reset() {
    this.indexes.clear()
    this.sessionStart = Date.now()
  }

  getStats() {
    let totalSize = 0
    for (const [_, entry] of this.indexes) {
      totalSize += entry.size
    }
    return {
      totalFiles: this.indexes.size,
      totalSize,
      sessionStart: this.sessionStart,
      staticFiles: this.getStaticPrefix().length,
      dynamicFiles: this.getDynamicSuffix().length,
    }
  }
}
