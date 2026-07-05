/**
 * Jaicode Backend Client - TypeScript frontend adapter for Go backend
 * Communicates with Jaicode Go server via HTTP/gRPC
 */

export interface ChatMessage {
  role: string
  content: string
}

export interface StreamChunk {
  type: string
  content?: string
  error?: string
}

export interface FileResponse {
  found: boolean
  content?: string
  language?: string
  lines?: number
  error?: string
}

export interface BackendConfig {
  host: string
  port: number
  provider: string
  apiKey: string
  model: string
}

export class JaicodeBackendClient {
  private baseUrl: string
  private config: BackendConfig

  constructor(config: BackendConfig) {
    this.config = config
    this.baseUrl = `http://${config.host}:${config.port}`
  }

  /** Stream chat with Go backend */
  async *chatStream(messages: ChatMessage[], mode: string): AsyncGenerator<StreamChunk> {
    const resp = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        mode,
        provider: this.config.provider,
      }),
    })

    if (!resp.ok || !resp.body) {
      yield { type: 'error', error: `HTTP ${resp.status}` }
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.startsWith('data: '))

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6))
          yield json as StreamChunk
        } catch { /* skip */ }
      }
    }
  }

  /** Read file via Go backend */
  async readFile(path: string): Promise<FileResponse> {
    const resp = await fetch(`${this.baseUrl}/api/file/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, max_bytes: 5_000_000 }),
    })
    return resp.json()
  }

  /** Write file via Go backend */
  async writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    const resp = await fetch(`${this.baseUrl}/api/file/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    })
    return resp.json()
  }

  /** Health check */
  async health(): Promise<{ status: string; version: string }> {
    const resp = await fetch(`${this.baseUrl}/api/health`)
    return resp.json()
  }

  /** Start Go backend as child process */
  static async startBackend(): Promise<{ pid: number; port: number }> {
    const { spawn } = await import('node:child_process')
    const path = await import('node:path')
    const fs = await import('node:fs')

    const goBinary = path.join(process.cwd(), '..', 'jaicode-go', 'jaicode-server')
    if (!fs.existsSync(goBinary)) {
      return { pid: 0, port: 0 }
    }

    const proc = spawn(goBinary, ['--port', '3003'], {
      detached: true,
      stdio: 'ignore',
    })

    proc.unref()
    return { pid: proc.pid || 0, port: 3003 }
  }
}
