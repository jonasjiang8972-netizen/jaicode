/**
 * Jaicode HTTP API Server
 * RESTful API for multi-client access
 * Port: 3002 (configurable)
 */

import http from 'node:http'
import { metrics } from '../tui-node/src/observability/metrics.js'

const PORT = process.env.JAICODE_PORT || 3002
const API_KEY = process.env.JAICODE_API_KEY || 'jaicode-dev-key'

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
function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

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
    res.writeHead(200, { 'Content-Type: 'text/plain' })
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

        // TODO: Integrate with actual LLM call
        // For now, return a placeholder
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })

        sendSSE(res, 'start', { mode, timestamp: Date.now() })
        sendSSE(res, 'chunk', { content: 'API mode is under development.' })
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

// ─── Server ────────────────────────────────────────────
export function startServer(port = PORT) {
  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
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
