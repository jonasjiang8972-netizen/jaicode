import { AgentMode } from "./engine"
import { AskHandler } from "./ask"
import { CodeHandler } from "./code"
import { DebugHandler } from "./debug"
import { ArchitectHandler } from "./architect"
import { ILLMProvider, ProviderRegistry } from "@jaicode/llm"
import { Config, AppConfig } from "@jaicode/core"
import { FileSystem } from "@jaicode/core"

export class AgentOrchestrator {
  private handlers: Map<AgentMode, any> = new Map()
  private provider: ILLMProvider | null = null
  private config: AppConfig

  constructor(config: AppConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    // Initialize provider
    const providerName = this.config.defaultProvider
    const providerConfig = this.config.providers[providerName]

    if (!providerConfig?.apiKey && !providerConfig?.apiKeyEncrypted) {
      return // No provider configured
    }

    let apiKey = providerConfig.apiKey || ""
    if (providerConfig.apiKeyEncrypted && !apiKey) {
      const { Crypto } = await import("@jaicode/core")
      const deviceKey = Crypto.getDeviceKey()
      apiKey = await Crypto.decrypt(providerConfig.apiKeyEncrypted, deviceKey)
    }

    this.provider = ProviderRegistry.create(providerName, {
      apiKey,
      model: providerConfig.model,
    })

    if (!this.provider) {
      return
    }

    // Register handlers
    this.handlers.set("ask", new AskHandler(this.provider))
    this.handlers.set("code", new CodeHandler(this.provider))
    this.handlers.set("debug", new DebugHandler(this.provider, this.config.agent.maxRetries))
    this.handlers.set("plan", new ArchitectHandler(this.provider))
  }

  getProvider(): ILLMProvider | null {
    return this.provider
  }

  getHandler(mode: AgentMode): AgentModeHandler | undefined {
    return this.handlers.get(mode)
  }

  isReady(): boolean {
    return this.provider !== null
  }

  async switchProvider(name: string): Promise<boolean> {
    const providerConfig = this.config.providers[name]
    if (!providerConfig) return false

    let apiKey = providerConfig.apiKey || ""
    if (providerConfig.apiKeyEncrypted && !apiKey) {
      const { Crypto } = await import("@jaicode/core")
      const deviceKey = Crypto.getDeviceKey()
      apiKey = await Crypto.decrypt(providerConfig.apiKeyEncrypted, deviceKey)
    }

    const provider = ProviderRegistry.create(name, {
      apiKey,
      model: providerConfig.model,
    })

    if (!provider) return false

    this.provider = provider
    this.config.defaultProvider = name

    // Re-register handlers with new provider
    this.handlers.set("ask", new AskHandler(this.provider))
    this.handlers.set("code", new CodeHandler(this.provider))
    this.handlers.set("debug", new DebugHandler(this.provider, this.config.agent.maxRetries))
    this.handlers.set("plan", new ArchitectHandler(this.provider))

    return true
  }
}
