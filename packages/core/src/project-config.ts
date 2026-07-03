import { Logger } from "./logger"

export interface ProjectConfig {
  version: number
  name: string
  description: string
  techStack: {
    languages: string[]
    frameworks: string[]
    buildTool: string
    testFramework: string
  }
  architecture: {
    style: "monorepo" | "microservice" | "monolith" | "serverless"
    directories: Record<string, string>
    entryPoints: string[]
  }
  conventions: {
    namingStyle: string
    fileOrganization: string
    codeStyle: Record<string, string>
  }
  context: {
    domainModel: string[]
    coreFlows: string[]
    constraints: string[]
  }
  agentInstructions: string[]
  createdAt: string
  updatedAt: string
}

export const projectConfigSchema = {
  type: "object",
  properties: {
    version: { type: "number" },
    name: { type: "string" },
    description: { type: "string" },
    techStack: { type: "object" },
    architecture: { type: "object" },
    conventions: { type: "object" },
    context: { type: "object" },
    agentInstructions: { type: "array" },
  },
} as const

export class ProjectConfigManager {
  private static log = new Logger("project-config")
  private static readonly CONFIG_FILE = ".jaicode/project.yaml"

  static getDefault(projectName: string): ProjectConfig {
    const now = new Date().toISOString()
    return {
      version: 1,
      name: projectName,
      description: "",
      techStack: {
        languages: [],
        frameworks: [],
        buildTool: "",
        testFramework: "",
      },
      architecture: {
        style: "monolith",
        directories: {},
        entryPoints: [],
      },
      conventions: {
        namingStyle: "camelCase",
        fileOrganization: "by-feature",
        codeStyle: {},
      },
      context: {
        domainModel: [],
        coreFlows: [],
        constraints: [],
      },
      agentInstructions: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  static async load(cwd: string = process.cwd()): Promise<ProjectConfig | null> {
    try {
      const filePath = `${cwd}/.jaicode/project.yaml`
      const file = Bun.file(filePath)
      const exists = await file.exists()
      if (!exists) return null
      const text = await file.text()
      return JSON.parse(text) as ProjectConfig
    } catch {
      return null
    }
  }

  static async save(
    config: ProjectConfig,
    cwd: string = process.cwd(),
  ): Promise<void> {
    const dir = `${cwd}/.jaicode`
    const keepFile = Bun.file(`${dir}/.keep`)
    await Bun.write(keepFile, "")
    const filePath = `${cwd}/.jaicode/project.yaml`
    config.updatedAt = new Date().toISOString()
    await Bun.write(filePath, JSON.stringify(config, null, 2))
  }

  static async init(projectName: string, cwd: string = process.cwd()): Promise<ProjectConfig> {
    const config = ProjectConfigManager.getDefault(projectName)
    await ProjectConfigManager.save(config, cwd)
    return config
  }
}
