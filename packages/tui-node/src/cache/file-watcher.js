/**
 * File Watcher - Monitor workspace file changes
 * Uses native fs.watch (zero dependencies)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export class FileWatcher {
  constructor(rootDir, options = {}) {
    this.rootDir = rootDir
    this.options = {
      ignored: [/node_modules/, /\.git/, /\.jaicode_backup/, /dist\//, /build\//, /\.cache/],
      pollInterval: 5000,
      ...options,
    }
    this.watchers = new Map()
    this.fileIndex = new Map()
    this.callbacks = []
  }

  async initialize() {
    const initialFiles = await this.scanDirectory(this.rootDir)
    for (const filePath of initialFiles) {
      const hash = await this.computeHash(filePath)
      if (hash) {
        this.fileIndex.set(filePath, {
          hash,
          mtime: fs.statSync(filePath).mtimeMs,
          size: fs.statSync(filePath).size,
        })
      }
    }
    return initialFiles.length
  }

  async scanDirectory(dir) {
    const files = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.relative(this.rootDir, fullPath)

      if (this.shouldIgnore(relativePath)) continue

      if (entry.isDirectory()) {
        files.push(...(await this.scanDirectory(fullPath)))
      } else if (this.isTextFile(fullPath)) {
        files.push(fullPath)
      }
    }

    return files
  }

  shouldIgnore(filePath) {
    return this.options.ignored.some(pattern => pattern.test(filePath))
  }

  isTextFile(filePath) {
    const textExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.java', '.kt', '.swift',
      '.c', '.cpp', '.h', '.hpp',
      '.md', '.mdx', '.txt', '.json', '.yaml', '.yml',
      '.toml', '.xml', '.html', '.htm', '.css', '.scss',
      '.sh', '.bash', '.zsh', '.fish',
      '.sql', '.graphql', '.proto',
      '.dockerfile', '.gitignore', '.env.example',
    ]
    const ext = path.extName(filePath).toLowerCase()
    return textExtensions.includes(ext) || !ext
  }

  async computeHash(filePath) {
    try {
      const content = await fs.promises.readFile(filePath)
      return createHash('sha256').update(content).digest('hex')
    } catch {
      return null
    }
  }

  watch(callback) {
    if (callback) this.callbacks.push(callback)

    const debouncedCheck = this.debounce(async () => {
      const changes = await this.detectChanges()
      if (changes.length > 0) {
        for (const cb of this.callbacks) cb(changes)
      }
    }, this.options.pollInterval)

    const watcher = fs.watch(this.rootDir, { recursive: true }, () => {
      debouncedCheck()
    })

    this.watchers.set('root', watcher)
    return this
  }

  async detectChanges() {
    const currentFiles = await this.scanDirectory(this.rootDir)
    const changes = []

    const currentSet = new Set(currentFiles)
    for (const [filePath] of this.fileIndex) {
      if (!currentSet.has(filePath)) {
        changes.push({ path: filePath, type: 'deleted' })
        this.fileIndex.delete(filePath)
      }
    }

    for (const filePath of currentFiles) {
      const stat = fs.statSync(filePath)
      const oldEntry = this.fileIndex.get(filePath)

      if (!oldEntry) {
        const hash = await this.computeHash(filePath)
        this.fileIndex.set(filePath, { hash, mtime: stat.mtimeMs, size: stat.size })
        changes.push({ path: filePath, type: 'created', hash })
      } else if (stat.mtimeMs !== oldEntry.mtime) {
        const newHash = await this.computeHash(filePath)
        if (newHash !== oldEntry.hash) {
          this.fileIndex.set(filePath, { hash: newHash, mtime: stat.mtimeMs, size: stat.size })
          changes.push({ path: filePath, type: 'modified', oldHash: oldEntry.hash, newHash })
        }
      }
    }

    return changes
  }

  debounce(fn, delay) {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }
  }

  getUnchangedFiles() {
    return [...this.fileIndex.entries()]
      .filter(([_, entry]) => entry.hash)
      .map(([filePath, entry]) => ({
        path: filePath,
        hash: entry.hash,
        mtime: entry.mtime,
        size: entry.size,
      }))
  }

  getChangedSince(timestamp) {
    return [...this.fileIndex.entries()]
      .filter(([_, entry]) => entry.mtime > timestamp)
      .map(([filePath, _]) => filePath)
  }

  destroy() {
    for (const [_, watcher] of this.watchers) {
      watcher.close()
    }
    this.watchers.clear()
  }
}
