// Reserved modules for Phase 2+

export interface ILicenseProvider {
  validate(): Promise<LicenseStatus>
  activate(licenseKey: string): Promise<LicenseStatus>
  getStatus(): LicenseStatus
}

export type LicenseStatus = {
  isValid: boolean
  plan: "trial" | "personal" | "team" | "enterprise" | "unlicensed"
  expiresAt: Date | null
}

export class NoOpLicenseProvider implements ILicenseProvider {
  async validate(): Promise<LicenseStatus> {
    return { isValid: true, plan: "trial", expiresAt: null }
  }

  async activate(_key: string): Promise<LicenseStatus> {
    return { isValid: true, plan: "trial", expiresAt: null }
  }

  getStatus(): LicenseStatus {
    return { isValid: true, plan: "trial", expiresAt: null }
  }
}

// Reserved for Phase 2
export interface IBillingProvider {
  createCheckoutSession(planId: string): Promise<{ url: string }>
  getSubscriptionStatus(): Promise<SubscriptionStatus>
}

export type SubscriptionStatus = {
  active: boolean
  plan: string
  expiresAt: Date | null
}

// Reserved for Phase 2 - Remote Marketplace Registry
export interface IMarketRegistry {
  search(query: string): Promise<MarketExtension[]>
  get(name: string): Promise<MarketExtension | null>
  download(name: string, version?: string): Promise<string>
}

export interface MarketExtension {
  name: string
  type: "agent" | "mcp" | "skill"
  version: string
  description: string
  author: string
  downloads: number
  url: string
}
