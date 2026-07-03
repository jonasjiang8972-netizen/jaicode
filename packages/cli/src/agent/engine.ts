export type AgentMode = "plan" | "code" | "debug" | "ask"

export interface AgentContext {
  mode: AgentMode
  cwd: string
  projectConfig: Record<string, unknown> | null
  userProfile: Record<string, unknown> | null
  messages: Array<{ role: string; content: string }>
}

export interface AgentResult {
  success: boolean
  output: string
  attempts: number
  mode: AgentMode
}

export interface AgentModeHandler {
  readonly mode: AgentMode
  execute(ctx: AgentContext, task: string): Promise<AgentResult>
  getSystemPrompt(ctx: AgentContext): string
}

export class ContextBuilder {
  static async build(
    mode: AgentMode,
    cwd: string,
  ): Promise<Pick<AgentContext, "mode" | "cwd" | "projectConfig" | "userProfile">> {
    let projectConfig: Record<string, unknown> | null = null
    let userProfile: Record<string, unknown> | null = null

    try {
      // Load project config
      const projectFile = Bun.file(`${cwd}/.jaicode/project.yaml`)
      if (await projectFile.exists()) {
        projectConfig = JSON.parse(await projectFile.text())
      }
    } catch {
      // ignore
    }

    try {
      // Load user profile
      const home = process.env.HOME || "~"
      const profileFile = Bun.file(`${home}/.jaicode/user.profile`)
      if (await profileFile.exists()) {
        userProfile = JSON.parse(await profileFile.text())
      }
    } catch {
      // ignore
    }

    return { mode, cwd, projectConfig, userProfile, messages: [] }
  }

  static async readProjectStructure(cwd: string, maxDepth: number = 3): Promise<string> {
    const ignoreDirs = new Set(["node_modules", ".git", "dist", "build", ".jaicode_backup"])
    const lines: string[] = []

    function walk(dir: string, depth: number): void {
      if (depth > maxDepth) return
      const proc = Bun.spawnSync(["ls", "-1", dir], { cwd: dir })
      if (proc.exitCode !== 0) return
      const entries = proc.stdout.toString().split("\n").filter(Boolean)

      for (const entry of entries) {
        if (entry.startsWith(".") && entry !== ".jaicode") continue
        if (ignoreDirs.has(entry)) continue

        const fullPath = `${dir}/${entry}`
        const indent = "  ".repeat(depth)
        const isDir = require("fs")?.statSync?.(fullPath)?.isDirectory?.() ?? false

        if (isDir) {
          lines.push(`${indent}${entry}/`)
          walk(fullPath, depth + 1)
        } else {
          lines.push(`${indent}${entry}`)
        }
      }
    }

    try {
      walk(cwd, 0)
    } catch {
      lines.push("(unable to read project structure)")
    }

    return lines.slice(0, 200).join("\n")
  }

  static async readRelevantFiles(cwd: string, filePaths: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    for (const fp of filePaths.slice(0, 10)) {
      try {
        const file = Bun.file(`${cwd}/${fp}`)
        const content = await file.text()
        result.set(fp, content.slice(0, 5000))
      } catch {
        // skip
      }
    }
    return result
  }
}

export class ModeRouter {
  private handlers: Map<AgentMode, AgentModeHandler> = new Map()

  register(handler: AgentModeHandler): void {
    this.handlers.set(handler.mode, handler)
  }

  get(mode: AgentMode): AgentModeHandler | undefined {
    return this.handlers.get(mode)
  }

  list(): AgentMode[] {
    return [...this.handlers.keys()]
  }
}

export class TaskLoop {
  private maxRetries: number

  constructor(maxRetries: number = 5) {
    this.maxRetries = maxRetries
  }

  async run(
    handler: AgentModeHandler,
    ctx: AgentContext,
    task: string,
  ): Promise<AgentResult> {
    return handler.execute(ctx, task)
  }

  setMaxRetries(n: number): void {
    this.maxRetries = n
  }
}
