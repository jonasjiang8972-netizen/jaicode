/**
 * Jaicode Analytics - Token/Usage tracking
 * Tracks model usage statistics across sessions
 * Stored in ~/.jaicode/analytics.json
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ─── Privacy Sanitization ──────────────────────────────
function sanitizeForLog(text) {
  if (!text) return text
  return text
    .replace(/\b(sk|ak|pk)-[a-zA-Z0-9]{32,}\b/gi, '[API_KEY_REDACTED]')
    .replace(/\b1[3-9]\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{17}[\dXx]\b/g, '[ID_REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/password\s*[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/secret\s*[=:]\s*\S+/gi, 'secret=[REDACTED]')
    .replace(/token\s*[=:]\s*\S+/gi, 'token=[REDACTED]')
    .slice(0, 500) // Truncate long text
}

export class Analytics {
  constructor() {
    this.filePath = path.join(os.homedir(), '.jaicode', 'analytics.json')
    this.data = this._load()
    this._dirty = false
    this._timer = null
    this._ensureSession()
  }

  _load() {
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) }
    catch {
      return {
        total: this._emptyDay('total'),
        daily: {},
        currentSession: { startTime: Date.now(), tokens: { input: 0, output: 0, total: 0 }, requests: 0, model: '' }
      }
    }
  }

  _emptyDay(date) {
    return {
      date, totalTokens: { input: 0, output: 0, total: 0 },
      totalRequests: 0, totalSessions: 0, totalErrors: 0, totalTime: 0, byModel: {}
    }
  }

  _ensureSession() { this._current().totalSessions++; this._getDay().totalSessions++; this._dirty = true; this._save() }

  _current() { return this.data.currentSession }

  _getDay() {
    const today = new Date().toISOString().slice(0, 10)
    if (!this.data.daily[today]) this.data.daily[today] = this._emptyDay(today)
    return this.data.daily[today]
  }

  /** Record an API request with its token usage */
  recordRequest(model, inputTokens, outputTokens, latencyMs, isError = false) {
    const total = inputTokens + outputTokens
    const cur = this._current()
    const day = this._getDay()

    // Update all levels
    for (const stats of [this.data.total, day]) {
      stats.totalTokens.input += inputTokens
      stats.totalTokens.output += outputTokens
      stats.totalTokens.total += total
      stats.totalRequests++
      stats.totalTime += latencyMs
      if (isError) stats.totalErrors++

      if (!stats.byModel[model]) stats.byModel[model] = { input: 0, output: 0, requests: 0, avgLatency: 0 }
      const m = stats.byModel[model]
      m.input += inputTokens
      m.output += outputTokens
      m.requests++
      m.avgLatency = Math.round((m.avgLatency * (m.requests - 1) + latencyMs) / m.requests)
    }

    this._dirty = true
    this._saveDebounced()
  }

  /** Get token rate (tokens/sec) for current session */
  getSessionRateLimit() {
    const cur = this._current()
    const elapsed = (Date.now() - cur.startTime) / 1000
    if (elapsed < 1) return '0 t/s'
    const rate = cur.tokens.output / elapsed
    return rate.toFixed(1) + ' t/s'
  }

  /** Format stats for status bar display */
  getStatusBarStats() {
    const cur = this._current()
    const t = this.data.total

    // Current session
    const curTokens = cur.tokens.total > 0 ? cur.tokens.total : 0
    const curReq = cur.requests
    const rate = this.getSessionRateLimit()
    const current = curReq + 'req ' + curTokens + 'tok ' + rate

    // All-time
    const totalTok = t.totalTokens.total
    const totalReq = t.totalRequests
    const sessions = t.totalSessions
    const total = totalReq + 'req ' + totalTok + 'tok ' + sessions + 'ses'

    return { current, total }
  }

  /** Reset current session */
  resetSession() {
    this.data.currentSession = { startTime: Date.now(), tokens: { input: 0, output: 0, total: 0 }, requests: 0, model: '' }
    this._dirty = true
    this._save()
  }

  /** Get detailed report for /stats command */
  getDetailedReport() {
    const t = this.data.total
    const cur = this._current()
    const avgLatency = t.totalRequests > 0 ? Math.round(t.totalTime / t.totalRequests) : 0
    const curElapsed = Math.round((Date.now() - cur.startTime) / 1000)
    const lines = [
      '--- Jaicode Analytics ---',
      '',
      '  Session:  ' + cur.requests + ' req, ' + cur.tokens.total + ' tok, ' + curElapsed + 's',
      '  Rate:     ' + this.getSessionRateLimit(),
      '',
      '  Total:',
      '    Req:    ' + t.totalRequests,
      '    In:     ' + t.totalTokens.input + ' prompt tok',
      '    Out:    ' + t.totalTokens.output + ' completion tok',
      '    Sum:    ' + t.totalTokens.total + ' tok',
      '    Avg:    ' + avgLatency + 'ms latency',
      '    Errors: ' + t.totalErrors,
      '    Models:',
    ]
    for (const [name, s] of Object.entries(t.byModel)) {
      lines.push('      ' + name + ': ' + s.requests + 'req ' + s.input + '/' + s.output + 'tok ' + s.avgLatency + 'ms')
    }
    return lines
  }

  _saveDebounced() {
    if (this._timer) return
    this._timer = setTimeout(() => { this._save(); this._timer = null }, 5000)
  }

  _save() {
    if (!this._dirty) return
    try { fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2)) } catch {}
    this._dirty = false
  }
}
