import { ILLMProvider, LLMMessage, LLMResponse, StreamChunk } from "./interface"

export class AnthropicProvider implements ILLMProvider {
  readonly name = "anthropic"
  readonly model: string
  private apiKey: string
  private baseURL: string

  constructor(config: Record<string, string>) {
    this.apiKey = config.apiKey || ""
    this.model = config.model || "claude-sonnet-4-20250514"
    this.baseURL = config.baseURL || "https://api.anthropic.com/v1"
  }

  async chat(messages: LLMMessage[], tools?: any[]): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: messages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      })),
    }

    if (messages[0]?.role === "system") {
      body.system = messages[0].content
      body.messages = body.messages.slice(1)
    }

    const resp = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Anthropic API error (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const content = data.content?.[0]?.text || ""

    return {
      content,
      model: this.model,
      provider: this.name,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    }
  }

  async *stream(messages: LLMMessage[], tools?: any[]): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      stream: true,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "tool" ? "user" : m.role,
          content: m.content,
        })),
    }

    if (messages[0]?.role === "system") {
      body.system = messages[0].content
    }

    const resp = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.text()
      yield { type: "error", error: `Anthropic API error (${resp.status}): ${err}` }
      return
    }

    const reader = resp.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (data === "[DONE]") {
          yield { type: "done" }
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === "content_block_delta") {
            const delta = parsed.delta?.text
            if (delta) yield { type: "text", content: delta }
          }
        } catch {
          // skip malformed
        }
      }
    }

    yield { type: "done" }
  }
}
