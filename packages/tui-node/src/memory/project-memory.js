/**
 * Project Memory — Persistent project context and preferences
 * Stores in .jaicode/memory.yaml (project-level) and ~/.jaicode/user.profile (user-level)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const USER_PROFILE = path.join(os.homedir(), '.jaicode', 'user.profile')

// ─── User Profile ─────────────────────────────────────
export function loadUserProfile() {
  try {
    return JSON.parse(fs.readFileSync(USER_PROFILE, 'utf-8'))
  } catch {
    return {
      version: 1,
      name: process.env.USER || 'developer',
      role: 'fullstack',
      languages: [],
      frameworks: [],
      stylePreferences: { naming: 'camelCase', comments: 'minimal', indentation: '2spaces', lineWidth: 100 },
      outputPreferences: { language: detectLanguage(), verbosity: 'normal', includeExamples: true, explanationLevel: 'intermediate' },
      templates: { commitFormat: '{{type}}: {{description}}', commentFormat: '// {{content}}', adrFormat: 'default' },
      habits: { commonCommands: [], frequentDirs: [], lastUsedProvider: 'anthropic' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
}

export function saveUserProfile(profile) {
  try {
    const dir = path.dirname(USER_PROFILE)
    fs.mkdirSync(dir, { recursive: true })
    profile.updatedAt = new Date().toISOString()
    fs.writeFileSync(USER_PROFILE, JSON.stringify(profile, null, 2))
  } catch { /* ignore */ }
}

// ─── Project Memory ───────────────────────────────────
export function loadProjectMemory(cwd) {
  const memPath = path.join(cwd, '.jaicode', 'memory.yaml')
  try {
    const content = fs.readFileSync(memPath, 'utf-8')
    return parseYAML(content)
  } catch {
    return null
  }
}

export function saveProjectMemory(cwd, memory) {
  try {
    const memDir = path.join(cwd, '.jaicode')
    fs.mkdirSync(memDir, { recursive: true })
    const memPath = path.join(memDir, 'memory.yaml')
    fs.writeFileSync(memPath, stringifyYAML(memory))
  } catch { /* ignore */ }
}

// ─── Auto-Scan Project ────────────────────────────────
export function autoScanProject(cwd) {
  const memory = { project: { techStack: [], directories: [], entryPoints: [] }, preferences: {}, history: [] }

  // Detect tech stack
  try {
    const pkgPath = path.join(cwd, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      memory.project.name = pkg.name || path.basename(cwd)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      memory.project.techStack = detectTechStack(deps)
      memory.project.entryPoints = findEntryPoints(deps)
    } else {
      memory.project.name = path.basename(cwd)
    }
  } catch { memory.project.name = path.basename(cwd) }

  // Detect directories
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true })
    memory.project.directories = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.name)
      .slice(0, 15)
  } catch { /* ignore */ }

  memory.project.lastScan = new Date().toISOString()
  return memory
}

// ─── Helpers ──────────────────────────────────────────
function detectLanguage() {
  const lang = process.env.LANG || process.env.LC_ALL || ''
  return lang.startsWith('zh') ? 'zh' : 'en'
}

function detectTechStack(deps = {}) {
  const stack = []
  const mappings = {
    react: 'react', vue: 'vue', angular: 'angular', svelte: 'svelte',
    typescript: 'typescript', express: 'express', fastify: 'fastify',
    next: 'nextjs', nuxt: 'nuxt', vite: 'vite', webpack: 'webpack',
    tailwindcss: 'tailwind', prisma: 'prisma', drizzle: 'drizzle',
  }
  for (const [dep, name] of Object.entries(mappings)) {
    if (deps[dep]) stack.push(name)
  }
  return stack
}

function findEntryPoints(deps = {}) {
  if (deps.next) return ['pages/', 'app/']
  if (deps.nuxt) return ['pages/']
  if (deps.vite) return ['src/main.ts', 'src/main.tsx']
  if (deps.express) return ['src/index.ts', 'server.ts']
  return ['src/']
}

function parseYAML(content) {
  // Simple YAML parser (no external deps)
  const result = {}
  let current = result
  const stack = [result]

  for (const line of content.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const indent = line.search(/\S/)
    const trimmed = line.trim()

    if (trimmed.includes(':')) {
      const [key, ...rest] = trimmed.split(':')
      const value = rest.join(':').trim()
      if (value === '') {
        current[key.trim()] = {}
        stack.push(current[key.trim()])
        current = stack[stack.length - 1]
      } else {
        current[key.trim()] = value
      }
    } else if (trimmed.startsWith('- ')) {
      // Array item - simplified
      const parent = stack[stack.length - 2]
      if (parent && Array.isArray(parent)) {
        parent.push(trimmed.slice(2))
      }
    }
  }
  return result
}

function stringifyYAML(obj, indent = 0) {
  const lines = []
  const prefix = '  '.repeat(indent)
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${prefix}${key}:`)
      lines.push(stringifyYAML(value, indent + 1))
    } else if (Array.isArray(value)) {
      lines.push(`${prefix}${key}:`)
      for (const item of value) {
        lines.push(`${prefix}  - ${item}`)
      }
    } else {
      lines.push(`${prefix}${key}: ${value}`)
    }
  }
  return lines.join('\n')
}

export { USER_PROFILE }
