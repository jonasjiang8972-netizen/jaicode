export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  provider: string
}

export interface LLMTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface StreamChunk {
  type: "text" | "tool_call" | "done" | "error"
  content?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  error?: string
}

export interface ILLMProvider {
  readonly name: string
  readonly model: string
  chat(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse>
  stream(messages: LLMMessage[], tools?: LLMTool[]): AsyncGenerator<StreamChunk>
}

export type ProviderConstructor = new (config: Record<string, string>) => ILLMProvider

export class ProviderRegistry {
  private static providers: Map<string, ProviderConstructor> = new Map()

  static register(name: string, ctor: ProviderConstructor): void {
    ProviderRegistry.providers.set(name, ctor)
  }

  static get(name: string): ProviderConstructor | undefined {
    return ProviderRegistry.providers.get(name)
  }

  static list(): string[] {
    return [...ProviderRegistry.providers.keys()]
  }

  static create(name: string, config: Record<string, string>): ILLMProvider | null {
    const ctor = ProviderRegistry.providers.get(name)
    if (!ctor) return null
    return new ctor(config)
  }
}
