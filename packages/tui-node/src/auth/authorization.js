/**
 * Authorization Framework - Permission Manager
 * Handles L0-L4 permission checks and user prompts
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const PERMISSIONS_FILE = path.join(os.homedir(), '.jaicode', 'permissions.json')
const AUDIT_FILE = path.join(os.homedir(), '.jaicode', 'audit.jsonl')

const DEFAULT_PERMISSIONS = {
  permissions: {
    L0_read: 'session',
    L1_write: 'ask',
    L2_exec: 'ask',
    L3_extend: 'ask',
    L4_network: 'ask',
    autoApproveReadOnly: true,
    blockedCommands: ['rm -rf', 'sudo', 'chmod 777', 'mkfs', 'dd if='],
    allowedDomains: [],
    sessionAutoExpire: 3600,
  },
}

export class Authorization {
  constructor() {
    this.data = this._load()
    this.sessionGrants = new Set() // Track session-level grants
  }

  _load() {
    try { return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8')) }
    catch { return { ...DEFAULT_PERMISSIONS } }
  }

  _save() {
    const dir = path.dirname(PERMISSIONS_FILE)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(this.data, null, 2))
  }

  /** Check if an operation is allowed */
  async checkPermission(level, details = {}) {
    const perm = this.data.permissions
    const key = `${level}_${this._getActionName(level)}`
    const policy = perm[key] || 'ask'

    // Always deny
    if (policy === 'deny') {
      return { allowed: false, reason: `Permission denied by policy: ${key}` }
    }

    // Always allow
    if (policy === 'always') {
      return { allowed: true, reason: 'Auto-approved by policy' }
    }

    // Session: already granted this session?
    if (policy === 'session') {
      if (this.sessionGrants.has(key)) {
        return { allowed: true, reason: 'Session pre-authorized' }
      }
      return { allowed: 'ask', reason: `L${this._getLevelNum(level)} ${this._getActionName(level)} requires session authorization`, level, details }
    }

    // ask: always prompt
    if (policy === 'ask') {
      return { allowed: 'ask', reason: `L${this._getLevelNum(level)} ${this._getActionName(level)} requires confirmation`, level, details }
    }

    return { allowed: false, reason: 'Unknown permission policy' }
  }

  /** Grant a session-level permission */
  grantSession(level) {
    const key = `${level}_${this._getActionName(level)}`
    this.sessionGrants.add(key)
  }

  /** Grant a specific domain for L4 */
  grantDomain(domain) {
    if (!this.data.permissions.allowedDomains.includes(domain)) {
      this.data.permissions.allowedDomains.push(domain)
      this._save()
    }
  }

  /** Update a permission setting */
  setPermission(level, value) {
    const key = `${level}_${this._getActionName(level)}`
    if (this.data.permissions.hasOwnProperty(key)) {
      this.data.permissions[key] = value
      this._save()
    }
  }

  _getActionName(level) {
    return { L0: 'read', L1: 'write', L2: 'exec', L3: 'extend', L4: 'network' }[level] || 'unknown'
  }

  _getLevelNum(level) { return level.replace('L', '') }

  /** Add a blocked command pattern */
  blockCommand(pattern) {
    if (!this.data.permissions.blockedCommands.includes(pattern)) {
      this.data.permissions.blockedCommands.push(pattern)
      this._save()
    }
  }
}

/** Audit logger - records all sensitive operations */
export class AuditLogger {
  static log(action, level, details, result) {
    const entry = {
      ts: new Date().toISOString(),
      action,
      level,
      details,
      result: result.allowed ? 'ALLOWED' : 'DENIED',
      reason: result.reason,
    }
    try {
      const dir = path.dirname(AUDIT_FILE)
      fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n')
    } catch { /* ignore write errors */ }
  }

  static readLog(limit = 50) {
    try {
      const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n').filter(Boolean)
      return lines.slice(-limit).map(l => JSON.parse(l))
    } catch { return [] }
  }
}
