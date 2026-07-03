import { Logger } from "./logger"

export interface UserProfile {
  version: number
  name: string
  role: "frontend" | "backend" | "fullstack" | "devops" | "data" | "mobile" | "other"
  languages: string[]
  frameworks: string[]
  stylePreferences: {
    naming: "camelCase" | "snake_case" | "PascalCase" | "kebab-case"
    comments: "verbose" | "minimal" | "none"
    indentation: "2spaces" | "4spaces" | "tabs"
    lineWidth: number
  }
  outputPreferences: {
    language: "zh" | "en"
    verbosity: "concise" | "normal" | "detailed"
    includeExamples: boolean
    explanationLevel: "beginner" | "intermediate" | "expert"
  }
  templates: {
    commitFormat: string
    commentFormat: string
    adrFormat: string
  }
  habits: {
    commonCommands: string[]
    frequentDirs: string[]
    lastUsedProvider: string
  }
  createdAt: string
  updatedAt: string
}

export const userProfileSchema = {
  type: "object",
  properties: {
    version: { type: "number" },
    name: { type: "string" },
    role: { type: "string" },
    languages: { type: "array" },
    frameworks: { type: "array" },
    stylePreferences: { type: "object" },
    outputPreferences: { type: "object" },
    templates: { type: "object" },
    habits: { type: "object" },
  },
} as const

export class UserProfileManager {
  private static log = new Logger("user-profile")
  private static readonly PROFILE_FILE = "user.profile"

  static getDefault(): UserProfile {
    const now = new Date().toISOString()
    return {
      version: 1,
      name: process.env.USER || "developer",
      role: "fullstack",
      languages: ["TypeScript"],
      frameworks: [],
      stylePreferences: {
        naming: "camelCase",
        comments: "minimal",
        indentation: "2spaces",
        lineWidth: 100,
      },
      outputPreferences: {
        language: this.detectLanguage(),
        verbosity: "normal",
        includeExamples: true,
        explanationLevel: "intermediate",
      },
      templates: {
        commitFormat: "{{type}}: {{description}}",
        commentFormat: "// {{content}}",
        adrFormat: "default",
      },
      habits: {
        commonCommands: [],
        frequentDirs: [],
        lastUsedProvider: "anthropic",
      },
      createdAt: now,
      updatedAt: now,
    }
  }

  private static detectLanguage(): "zh" | "en" {
    const lang = process.env.LANG || process.env.LC_ALL || ""
    if (lang.startsWith("zh")) return "zh"
    return "en"
  }

  static async load(): Promise<UserProfile> {
    const { Storage } = await import("./storage")
    const data = await Storage.read<UserProfile>(UserProfileManager.PROFILE_FILE)
    if (!data) {
      const defaultProfile = UserProfileManager.getDefault()
      await this.save(defaultProfile)
      return defaultProfile
    }
    return data
  }

  static async save(profile: UserProfile): Promise<void> {
    const { Storage } = await import("./storage")
    profile.updatedAt = new Date().toISOString()
    await Storage.write(profile, UserProfileManager.PROFILE_FILE)
  }

  static async update(
    partial: Partial<Omit<UserProfile, "version" | "createdAt" | "updatedAt">>,
  ): Promise<UserProfile> {
    const current = await UserProfileManager.load()
    const updated = { ...current, ...partial }
    await UserProfileManager.save(updated)
    return updated
  }
}
