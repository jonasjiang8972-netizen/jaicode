/**
 * Jaicode Analytics - Token/Usage tracking
 * Tracks model usage statistics across sessions
 * Stored in ~/.jaicode/analytics.json
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

interface DailyStats {
  date: string
  totalTokens: { input: number; output: number; total: number }
  totalRequests: number
  totalSessions: number
  totalErrors: number
  totalTime: number // ms
  byModel: Record<string, { input; output; requests; avgLatency }>
}

interface AnalyticsData {
  total: DailyStats
  daily: Record<string, DailyStats>
  currentSession: {
    startTime: number
    tokens: { input; output; total }
    requests: number
    model: string
  }
}

class Analytics {
  private data: AnalyticsData
  private filePath: string
  private _dirty = false

  constructor() {
    this.filePath = path.join(os.homedir(), '.jaicode', 'analytics.json')
    this.data = this._load()
    this._ensureSession()
  }

  private _load(): AnalyticsData {
    try { return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) }
    catch {
      return {
        total: this._emptyDay('total'),
        daily: {},
        currentSession: { startTime: Date.now(), tokens: { input: 0, output: 0, total: 0 }, requests: 0, model: '' }
      }
    }
  }

  private _emptyDay(date: string): DailyStats {
    return {
      date, totalTokens: { input: 0, output: 0, total: 0 },
      totalRequests: 0, totalSessions: 0, totalErrors: 0, totalTime: 0, byModel: {}
    }
  }

  private _ensureSession() { this._current().totalSessions++; this._getDay().totalSessions++; this._dirty = true; this._save() }

  private _current() { return this.data.currentSession }

  private _getDay(): DailyStats {
    const today = new Date().toISOString().slice(0, 10)
    if (!this.data.daily[today]) this.data.daily[today] = this._emptyDay(today)
    return this.data.daily[today]
  }

  /** Record an API request with its token usage */
  recordRequest(model: string, inputTokens: number, outputTokens: number, latencyMs: number, isError = false) {
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
  getSessionRateLimit(): string {
    const cur = this._current()
    const elapsed = (Date.now() - cur.startTime) / 1000
    if (elapsed < 1) return '0 t/s'
    const rate = cur.tokens.output / elapsed
    return `${rate.toFixed(1)} t/s`
  }

  /** Format stats for status bar display */
  getStatusBarStats(): { current: string; total: string } {
    const cur = this._current()
    const t = this.data.total

    // Current session: tokens + requests + rate
    const curTokens = cur.tokens.total > 0 ? cur.tokens.total : 0
    const curReq = cur.requests
    const rate = this.getSessionRateLimit()
    const current = `${curReq}req ${curTokens}tok ${rate}`

    // All-time: total tokens + sessions
    const totalTok = t.totalTokens.total
    const totalReq = t.totalRequests
    const sessions = t.totalSessions
    const total = `${totalReq}req ${totalTok}tok ${sessions}ses`

    return { current, total }
  }

  /** Reset current session */
  resetSession() {
    this.data.currentSession = { startTime: Date.now(), tokens: { input: 0, output: 0, total: 0 }, requests: 0, model: '' }
    this._dirty = true
    this._save()
  }

  /** Get detailed report for /stats command */
  getDetailedReport(): string[] {
    const t = this.data.total
    const day = this._getDay()
    const cur = this._current()
    const avgLatency = t.totalRequests > 0 ? Math.round(t.totalTime / t.totalRequests) : 0
    const curElapsed = Math.round((Date.now() - cur.startTime) / 1000)

    return [
      '--- Jaicode Analytics ---',
      '',
      `Session:  ${cur.requests} requests, ${cur.tokens.total} tokens, ${curElapsed}s`,
      `  Rate:   ${this.getSessionRateLimit()}`,

      '', 'Total:',
      `  APIs:  ${t.totalRequests} requests`,
      `  In:     ${t.totalTokens.input} prompt tokens`,
      `  Out:    ${t.totalTokens.output} completion tokens`,
      `  Total:  ${t.totalTokens.total} tokens`,
      `  Avg:    ${avgLatency}ms per request`,
      `  Errors: ${t.totalErrors}`,

      '', `Models:` ,
      ...Object.entries(t.byModel).map(([name, s]) => `  ${name}: ${s.requests}req ${s.in}/${s.out}tok ${s.avgLatency}ms`),
    ]
  }

  private _saveDebounced() {
    if (this._timer) return
    this._timer = setTimeout(() => { this._save(); this._timer = null }, 5000)
  }
  private _timer: any = null

  private _save() {
    if (!this._dirty) return
    try { fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2)) } catch {}
    this._dirty = false
  }
}

export { Analytics, AnalyticsData }
