/**
 * Observability — Prometheus-compatible metrics
 */

class Metrics {
  constructor() {
    this.data = {
      requests: { total: 0, byMode: {}, byProvider: {}, errors: 0 },
      tokens: { input: 0, output: 0, total: 0 },
      latency: { count: 0, sum: 0, avg: 0, p50: 0, p95: 0, p99: 0, buckets: [] },
      sessions: { total: 0, active: 0 },
      startTime: Date.now(),
    }
  }

  /** Record an API request */
  recordRequest(mode, provider, inputTokens, outputTokens, latencyMs, isError = false) {
    this.data.requests.total++
    this.data.requests.byMode[mode] = (this.data.requests.byMode[mode] || 0) + 1
    this.data.requests.byProvider[provider] = (this.data.requests.byProvider[provider] || 0) + 1
    if (isError) this.data.requests.errors++

    this.data.tokens.input += inputTokens
    this.data.tokens.output += outputTokens
    this.data.tokens.total += inputTokens + outputTokens

    this.data.latency.count++
    this.data.latency.sum += latencyMs
    this.data.latency.avg = Math.round(this.data.latency.sum / this.data.latency.count)
    this.data.latency.buckets.push(latencyMs)
    // Keep only last 1000 latency measurements
    if (this.data.latency.buckets.length > 1000) {
      this.data.latency.buckets = this.data.latency.buckets.slice(-1000)
    }
    this._calculatePercentiles()
  }

  /** Record session start */
  recordSessionStart() {
    this.data.sessions.total++
    this.data.sessions.active++
  }

  /** Record session end */
  recordSessionEnd() {
    this.data.sessions.active = Math.max(0, this.data.sessions.active - 1)
  }

  _calculatePercentiles() {
    const sorted = [...this.data.latency.buckets].sort((a, b) => a - b)
    const len = sorted.length
    if (len === 0) return

    const pct = (p) => {
      const idx = Math.ceil(len * p / 100) - 1
      return sorted[Math.max(0, idx)]
    }

    this.data.latency.p50 = pct(50)
    this.data.latency.p95 = pct(95)
    this.data.latency.p99 = pct(99)
  }

  /** Export in Prometheus text format */
  toPrometheus() {
    const lines = []
    const prefix = 'jaicode'

    lines.push(`# HELP ${prefix}_requests_total Total API requests`)
    lines.push(`# TYPE ${prefix}_requests_total counter`)
    lines.push(`${prefix}_requests_total ${this.data.requests.total}`)

    lines.push(`# HELP ${prefix}_request_errors_total Total request errors`)
    lines.push(`# TYPE ${prefix}_request_errors_total counter`)
    lines.push(`${prefix}_request_errors_total ${this.data.requests.errors}`)

    for (const [mode, count] of Object.entries(this.data.requests.byMode)) {
      lines.push(`${prefix}_requests_by_mode{mode="${mode}"} ${count}`)
    }

    for (const [provider, count] of Object.entries(this.data.requests.byProvider)) {
      lines.push(`${prefix}_requests_by_provider{provider="${provider}"} ${count}`)
    }

    lines.push(`# HELP ${prefix}_tokens_total Total tokens consumed`)
    lines.push(`# TYPE ${prefix}_tokens_total counter`)
    lines.push(`${prefix}_tokens_input_total ${this.data.tokens.input}`)
    lines.push(`${prefix}_tokens_output_total ${this.data.tokens.output}`)
    lines.push(`${prefix}_tokens_total ${this.data.tokens.total}`)

    lines.push(`# HELP ${prefix}_request_duration_ms Request latency`)
    lines.push(`# TYPE ${prefix}_request_duration_ms summary`)
    lines.push(`${prefix}_request_duration_ms_avg ${this.data.latency.avg}`)
    lines.push(`${prefix}_request_duration_ms_p50 ${this.data.latency.p50}`)
    lines.push(`${prefix}_request_duration_ms_p95 ${this.data.latency.p95}`)
    lines.push(`${prefix}_request_duration_ms_p99 ${this.data.latency.p99}`)

    lines.push(`# HELP ${prefix}_sessions_total Total sessions`)
    lines.push(`# TYPE ${prefix}_sessions_total counter`)
    lines.push(`${prefix}_sessions_total ${this.data.sessions.total}`)

    lines.push(`# HELP ${prefix}_sessions_active Active sessions`)
    lines.push(`# TYPE ${prefix}_sessions_active gauge`)
    lines.push(`${prefix}_sessions_active ${this.data.sessions.active}`)

    return lines.join('\n')
  }

  /** Get JSON snapshot */
  toJSON() {
    return { ...this.data, uptime: Date.now() - this.data.startTime }
  }
}

// ─── Singleton ─────────────────────────────────────────
export const metrics = new Metrics()
export { Metrics }
