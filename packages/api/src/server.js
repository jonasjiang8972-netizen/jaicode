/**
 * Jaicode HTTP API Server
 * RESTful API for multi-client access
 * Port: 3002 (configurable)
 */

import http from 'node:http'
import { metrics } from '../tui-node/src/observability/metrics.js'

const PORT = process.env.JAICODE_PORT || 3002
const API_KEY = process.env.JAICODE_API_KEY

if (!API_KEY) {
  console.error('[FATAL] JAICODE_API_KEY environment variable is required')
  process.exit(1)
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost').split(',')

// ─── Rate Limiter ──────────────────────────────────────
const rateLimits = new Map()
const RATE_LIMIT = 60 // requests per minute

function checkRateLimit(clientId) {
  const now = Date.now()
  const window = 60 * 1000 // 1 minute

  if (!rateLimits.has(clientId)) {
    rateLimits.set(clientId, [])
  }

  const requests = rateLimits.get(clientId).filter(t => now - t < window)
  rateLimits.set(clientId, requests)

  if (requests.length >= RATE_LIMIT) {
    return false
  }

  requests.push(now)
  return true
}

// ─── Response Helpers ──────────────────────────────────
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function sendError(res, status, code, message) {
  sendJSON(res, status, { error: { code, message } })
}

// ─── SSE Helper ────────────────────────────────────────

// ─── Routes ────────────────────────────────────────────
const routes = {
  // Health check
  'GET /api/health': (req, res) => {
    sendJSON(res, 200, {
      status: 'ok',
      version: '0.8.0',
      uptime: metrics.data.startTime,
    })
  },

  // Prometheus metrics
  'GET /metrics': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(metrics.toPrometheus())
  },

  // Chat endpoint (streaming)
  'POST /api/chat': async (req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const { message, mode = 'auto', provider } = JSON.parse(body)

        if (!message) {
          return sendError(res, 400, 'INVALID_INPUT', 'Message is required')
        }

        // Real LLM integration
        const cfg = getProviderConfig(provider)
        if (!cfg.apiKey) {
          return sendError(res, 401, 'NO_API_KEY', 'No API key configured. Set ANTHROPIC_API_KEY env var.')
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        sendSSE(res, 'start', { mode, timestamp: Date.now() })

        // Stream from real LLM
        await streamLLM(cfg, message, mode, res)

        sendSSE(res, 'done', { timestamp: Date.now() })
        res.end()
      } catch (e) {
        sendError(res, 400, 'PARSE_ERROR', e.message)
      }
    })
  },

  // List skills
  'GET /api/skills': (req, res) => {
    sendJSON(res, 200, {
      skills: [
        { id: 'commit', name: 'Git Commit', type: 'command' },
        { id: 'code-review', name: 'Code Review', type: 'command' },
        { id: 'spellcheck', name: 'Spellcheck', type: 'command' },
        { id: 'changelog', name: 'Changelog', type: 'command' },
      ],
    })
  },

  // Analytics snapshot
  'GET /api/analytics': (req, res) => {
    sendJSON(res, 200, metrics.toJSON())
  },
}

// ─── Helpers ───────────────────────────────────────────
function getProviderConfig(name) {
  if (!name) {
    name = process.env.JAICODE_PROVIDER || 'custom'
  }
  const apiKey = process.env[stringsToUpper(name + '_api_key')]
    || process.env.ANTHROPIC_API_KEY

  let baseURL, model, format
  switch (name) {
    case 'anthropic':
      baseURL = 'https://api.anthropic.com'
      model = 'claude-sonnet-4-20250514'
      format = 'anthropic'
      break
    case 'openai':
      baseURL = 'https://api.openai.com'
      model = 'gpt-4o'
      format = 'openai'
      break
    default:
      baseURL = process.env.JAICODE_API_URL || 'https://api.longcat.chat/openai'
      model = process.env.JAICODE_MODEL || 'LongCat-2.0'
      format = 'openai'
  }

  return { name, apiKey, baseURL, model, format }
}

function stringsToUpper(s) {
  let result = ''
  for (const c of s) {
    if (c >= 'a' && c <= 'z') {
      result += String.fromCharCode(c.charCodeAt(0) - 32)
    } else {
      result += c
    }
  }
  return result
}

function getSystemPrompt(mode) {
  const prompts = {
    plan: 'You are an architecture design expert. Output Architecture Decision Records (ADR).',
    code: 'You are a coding assistant. Show file changes in diff format with + and - prefixes.',
    debug: 'You are a debugging assistant. Analyze the error and provide a fix.',
    ask: 'You are a concise Q&A assistant. Answer directly.',
  }
  return prompts[mode] || prompts.code
}

async function streamLLM(cfg, message, mode, res) {
  const systemPrompt = getSystemPrompt(mode)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ]

  // Build request body
  let body, url
  if (cfg.format === 'anthropic') {
    body = JSON.stringify({
      model: cfg.model, max_tokens: 4096, stream: true,
      system: systemPrompt, messages: messages.slice(1),
    })
    url = cfg.baseURL + '/v1/messages'
  } else {
    body = JSON.stringify({
      model: cfg.model, max_tokens: 4096, stream: true, messages,
    })
    url = cfg.baseURL + '/v1/chat/completions'
  }

  // Build fetch options
  const headers = { 'Content-Type': 'application/json' }
  if (cfg.format === 'anthropic') {
    headers['x-api-key'] = cfg.apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = 'Bearer ' + cfg.apiKey
  }

  // Retry loop
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body,
      })

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const reader = resp.body
      const decoder = new TextDecoder()
      let buffer = ''

      // Read stream
      const reader2 = reader.getReader()
      while (true) {
        const { done, value } = await reader2.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') return

          try {
            const json = JSON.parse(data)
            let content
            if (json.delta?.text) {
              content = json.delta.text
            } else if (json.choices?.[0]?.delta?.content) {
              content = json.choices[0].delta.content
            } else if (json.content?.[0]?.text) {
              content = json.content[0].text
            }
            if (content) {
              sendSSE(res, 'chunk', { content })
            }
          } catch {
            // skip malformed
          }
        }
      }
      return
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }

  sendSSE(res, 'chunk', { content: `⚠️ LLM error: ${lastErr.message}` })
}


// ─── Server ────────────────────────────────────────────
export function startServer(port = PORT) {
  const server = http.createServer((req, res) => {
    // CORS
    const origin = req.headers.origin
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Auth (except health and metrics)
    const url = req.url.split('?')[0]
    if (url !== '/api/health' && url !== '/metrics') {
      const auth = req.headers.authorization
      if (!auth || auth !== `Bearer ${API_KEY}`) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing API key')
      }

      // Rate limiting
      const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress
      if (!checkRateLimit(clientId)) {
        return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Max 60/min.')
      }
    }

    // Route
    const key = `${req.method} ${url}`
    const handler = routes[key]

    if (handler) {
      handler(req, res)
    } else {
      sendError(res, 404, 'NOT_FOUND', `Route not found: ${key}`)
    }
  })

  server.listen(port, () => {
    console.log(`Jaicode API server running on http://localhost:${port}`)
  })

  return server
}

// ─── Entry ─────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}
