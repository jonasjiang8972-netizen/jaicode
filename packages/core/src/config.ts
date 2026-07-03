import { Logger } from "./logger"

export interface AppConfig {
  version: number
  language: "zh" | "en"
  providers: Record<string, ProviderConfig>
  defaultProvider: string
  agent: {
    maxRetries: number
    maxFilesPerTask: number
    verboseByDefault: boolean
  }
  marketplace: {
    localDirs: string[]
    remoteRegistry?: string
    autoUpdate: boolean
  }
  license: {
    provider: string
    key?: string
  }
  tips: {
    enabled: boolean
    triggerCount: number
  }
  updatedAt: string
}

export interface ProviderConfig {
  apiKey?: string
  apiKeyEncrypted?: string
  baseURL?: string
  model: string
  enabled: boolean
}

export class Config {
  private static log = new Logger("config")
  private static readonly CONFIG_FILE = "config.json"

  static getDefault(): AppConfig {
    return {
      version: 1,
      language: Config.detectLanguage(),
      providers: {
        anthropic: {
          model: "claude-sonnet-4-20250514",
          enabled: false,
        },
        openai: {
          model: "gpt-4o",
          enabled: false,
        },
      },
      defaultProvider: "anthropic",
      agent: {
        maxRetries: 5,
        maxFilesPerTask: 20,
        verboseByDefault: false,
      },
      marketplace: {
        localDirs: ["~/.jaicode/extensions", "./.jaicode/extensions"],
        autoUpdate: false,
      },
      license: {
        provider: "noop",
      },
      tips: {
        enabled: true,
        triggerCount: 10,
      },
      updatedAt: new Date().toISOString(),
    }
  }

  private static detectLanguage(): "zh" | "en" {
    const lang = process.env.LANG || process.env.LC_ALL || ""
    if (lang.startsWith("zh")) return "zh"
    return "en"
  }

  static async load(): Promise<AppConfig> {
    const { Storage } = await import("./storage")
    const data = await Storage.read<AppConfig>(Config.CONFIG_FILE)
    if (!data) {
      const defaultConfig = Config.getDefault()
      await Config.save(defaultConfig)
      return defaultConfig
    }
    return data
  }

  static async save(config: AppConfig): Promise<void> {
    const { Storage } = await import("./storage")
    config.updatedAt = new Date().toISOString()
    await Storage.write(config, Config.CONFIG_FILE)
  }

  static async setProvider(
    name: string,
    provider: ProviderConfig,
  ): Promise<AppConfig> {
    const config = await Config.load()
    config.providers[name] = { ...config.providers[name], ...provider }
    config.defaultProvider = name
    await Config.save(config)
    return config
  }

  static async setDefaultProvider(name: string): Promise<AppConfig> {
    const config = await Config.load()
    if (config.providers[name]) {
      config.defaultProvider = name
      await Config.save(config)
    }
    return config
  }

  static async setLanguage(lang: "zh" | "en"): Promise<AppConfig> {
    const config = await Config.load()
    config.language = lang
    await Config.save(config)
    return config
  }
}
