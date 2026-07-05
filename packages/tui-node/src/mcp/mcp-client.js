/**
 * MCP Integration — Model Context Protocol server management
 * Connects Jaicode to external tool servers via MCP
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const MCP_CONFIG = path.join(os.homedir(), '.jaicode', 'mcp.json')

// ─── MCP Server Config ─────────────────────────────────
export function loadMCPServers() {
  try {
    return JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8')).servers || []
  } catch { return [] }
}

export function saveMCPServer(name, config) {
  try {
    const dir = path.dirname(MCP_CONFIG)
    fs.mkdirSync(dir, { recursive: true })
    const data = fs.existsSync(MCP_CONFIG) ? JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8')) : { servers: [] }
    const idx = data.servers.findIndex(s => s.name === name)
    if (idx >= 0) data.servers[idx] = { name, ...config }
    else data.servers.push({ name, ...config })
    fs.writeFileSync(MCP_CONFIG, JSON.stringify({ servers: data.servers }, null, 2))
    return true
  } catch { return false }
}

export function removeMCPServer(name) {
  try {
    if (!fs.existsSync(MCP_CONFIG)) return true
    const data = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8'))
    data.servers = data.servers.filter(s => s.name !== name)
    fs.writeFileSync(MCP_CONFIG, JSON.stringify(data, null, 2))
    return true
  } catch { return false }
}

// ─── MCP Client (JSON-RPC 2.0) ─────────────────────────
export class MCPClient {
  constructor(serverConfig) {
    this.config = serverConfig
    this.process = null
    this.tools = []
  }

  async connect() {
    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Initialize
    const initReq = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'jaicode', version: '0.13.0' },
      },
    }

    this.send(initReq)
    const response = await this.receive()

    // List tools
    const toolsReq = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }

    this.send(toolsReq)
    const toolsResponse = await this.receive()

    if (toolsResponse.result?.tools) {
      this.tools = toolsResponse.result.tools
    }

    return { connected: true, tools: this.tools }
  }

  async callTool(name, args) {
    const req = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args || {} },
    }

    this.send(req)
    const response = await this.receive()

    if (response.error) throw new response.error.message
    return response.result
  }

  send(msg) {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(JSON.stringify(msg) + '\n')
    }
  }

  receive() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MCP timeout')), 30000)
      let buffer = ''

      const handler = (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line)
              clearTimeout(timeout)
              this.process.stdout.off('data', handler)
              resolve(msg)
              return
            } catch { /* wait for more data */ }
          }
        }
      }

      this.process.stdout.on('data', handler)
    })
  }

  disconnect() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

export { MCP_CONFIG }
