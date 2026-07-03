export type Locale = "zh" | "en"

export interface MessageCatalog {
  locale: Locale
  messages: Record<string, string>
}

export class I18n {
  private currentLocale: Locale = "en"
  private catalogs: Map<Locale, MessageCatalog> = new Map()
  private fallbackLocale: Locale = "en"

  constructor(locale?: Locale) {
    if (locale) this.currentLocale = locale
  }

  static detectLocale(): Locale {
    const envLang = process.env.LANG || process.env.LC_ALL || ""
    const cfgLang = process.env.JAICODE_LANG
    if (cfgLang === "zh" || cfgLang === "en") return cfgLang
    if (envLang.startsWith("zh")) return "zh"
    return "en"
  }

  setLocale(locale: Locale): void {
    this.currentLocale = locale
  }

  getLocale(): Locale {
    return this.currentLocale
  }

  register(catalog: MessageCatalog): void {
    this.catalogs.set(catalog.locale, catalog)
  }

  t(key: string, vars?: Record<string, string>): string {
    let message: string | undefined

    const catalog = this.catalogs.get(this.currentLocale)
    if (catalog) message = catalog.messages[key]

    if (!message) {
      const fallback = this.catalogs.get(this.fallbackLocale)
      message = fallback?.messages[key]
    }

    if (!message) {
      return key
    }

    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        message = message.replaceAll(`{{${name}}}`, value)
      }
    }

    return message
  }
}

export function createI18n(locale?: Locale): I18n {
  return new I18n(locale ?? I18n.detectLocale())
}
