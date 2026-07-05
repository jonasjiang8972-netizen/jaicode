import { ILLMProvider, LLMMessage, LLMResponse, StreamChunk, LLMTool } from "./interface"

export class OpenAIProvider implements ILLMProvider {
  readonly name = "openai"
  readonly model: string
  private apiKey: string
  private baseURL: string

  constructor(config: Record<string, string>) {
    this.apiKey = config.apiKey || ""
    this.model = config.model || "gpt-4o"
    this.baseURL = config.baseURL || "https://api.openai.com/v1"
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const resp = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role === "tool" ? "user" : m.role,
          content: m.content,
        })),
        max_tokens: 4096,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`OpenAI API error (${resp.status}): ${err}`)
    }

    const data = await resp.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content || ""

    return {
      content,
      model: this.model,
      provider: this.name,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    }
  }

  async *stream(messages: LLMMessage[]): AsyncGenerator<StreamChunk> {
    const resp = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: messages.map((m) => ({
          role: m.role === "tool" ? "user" : m.role,
          content: m.content,
        })),
        max_tokens: 4096,
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      yield { type: "error", error: `OpenAI API error (${resp.status}): ${err}` }
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
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield { type: "text", content: delta }
        } catch {
          // skip malformed
        }
      }
    }

    yield { type: "done" }
  }
}
