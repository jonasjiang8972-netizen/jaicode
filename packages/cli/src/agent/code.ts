import { AgentModeHandler, AgentContext, AgentResult, ContextBuilder } from "./engine"
import { ILLMProvider, LLMMessage } from "@jaicode/llm"
import { FileDiff, DiffEngine } from "@jaicode/core"
import { FileSystem } from "@jaicode/core"

export interface CodeChange {
  path: string
  oldContent: string
  newContent: string
}

export class CodeHandler implements AgentModeHandler {
  readonly mode = "code" as const
  private provider: ILLMProvider

  constructor(provider: ILLMProvider) {
    this.provider = provider
  }

  getSystemPrompt(ctx: AgentContext): string {
    const lang = ctx.userProfile?.outputPreferences?.language || "zh"
    if (lang === "zh") {
      return `你是一个编程助手。用户描述代码修改需求，你需要：
1. 分析需求
2. 生成代码变更（使用 unified diff 格式，标注文件路径）
3. 展示完整的变更内容

输出格式严格遵循：
FILE: <文件路径>
\`\`\`
<完整的新文件内容>
\`\`\`

一次最多修改 20 个文件。${projectCtx}`
    }
    return `You are a coding assistant. The user describes code changes. You must:
1. Analyze the requirements
2. Generate code changes (using unified diff format, marking file paths)
3. Show the complete changes

Output format (strict):
FILE: <file path>
\`\`\`
<complete new file content>
\`\`\`

Maximum 20 files per task.${projectCtx}`
  }

  async execute(ctx: AgentContext, task: string): Promise<AgentResult> {
    // Read project context
    const structure = await ContextBuilder.readProjectStructure(ctx.cwd, 2)
    const userLang = ctx.userProfile?.outputPreferences?.language || "zh"
    const contextInfo =
      userLang === "zh"
        ? `\n\n当前项目结构:\n${structure}`
        : `\n\nCurrent project structure:\n${structure}`

    const messages: LLMMessage[] = [
      { role: "system", content: this.getSystemPrompt(ctx) },
      { role: "user", content: task + contextInfo },
    ]

    // Stream the response
    let response = ""
    for await (const chunk of this.provider.stream(messages)) {
      if (chunk.type === "text" && chunk.content) {
        response += chunk.content
        process.stdout.write(chunk.content)
      } else if (chunk.type === "error") {
        return {
          success: false,
          output: chunk.error || "Unknown error",
          attempts: 1,
          mode: this.mode,
        }
      }
    }

    process.stdout.write("\n")

    // Parse response to extract file changes
    const changes = this.parseChanges(response)

    if (changes.length === 0) {
      return { success: true, output: response, attempts: 1, mode: this.mode }
    }

    // Show diffs and ask for confirmation
    const applied = await this.applyChanges(changes, ctx.cwd, userLang)

    return {
      success: true,
      output: applied,
      attempts: 1,
      mode: this.mode,
    }
  }

  private parseChanges(response: string): CodeChange[] {
    const changes: CodeChange[] = []
    const filePattern = /FILE:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g
    let match: RegExpExecArray | null

    while ((match = filePattern.exec(response)) !== null) {
      const path = match[1].trim()
      const content = match[2].trim()
      changes.push({ path, oldContent: "", newContent: content })
    }

    // Also try plain diff format
    if (changes.length === 0) {
      const diffPattern = /--- a\/(.+?)\n[\s\S]*?@@[\s\S]*?(?=\n--- |\nFILE:|$)/g
      while ((match = diffPattern.exec(response)) !== null) {
        // Simplified - actual diff parsing would be more complex
      }
    }

    return changes
  }

  private async applyChanges(
    changes: CodeChange[],
    cwd: string,
    lang: string,
  ): Promise<string> {
    if (changes.length === 0) return lang === "zh" ? "无变更需要应用。" : "No changes to apply."

    const applied: string[] = []

    for (const change of changes) {
      // Try to read old content
      try {
        change.oldContent = await FileSystem.read(`${cwd}/${change.path}`)
      } catch {
        // New file
      }

      // Show diff
      const diff = DiffEngine.compute(change.oldContent, change.newContent)
      diff.path = change.path
      console.log(DiffEngine.format(diff))
      console.log()

      // Ask for confirmation
      const confirmed = await this.promptConfirm(
        lang === "zh" ? "是否应用此更改？" : "Apply this change?",
      )

      if (confirmed) {
        await FileSystem.write(`${cwd}/${change.path}`, change.newContent)
        applied.push(change.path)
      }
    }

    return applied.length > 0
      ? (lang === "zh" ? `已应用 ${applied.length} 个文件变更。` : `Applied ${applied.length} file change(s).`)
      : lang === "zh" ? "所有变更已取消。" : "All changes cancelled."
  }

  private async promptConfirm(question: string): Promise<boolean> {
    process.stdout.write(`${question} [y/N]: `)
    return new Promise((resolve) => {
      const stdin = process.stdin
      stdin.setRawMode?.(true)
      stdin.resume()
      stdin.once("data", (data) => {
        stdin.setRawMode?.(false)
        stdin.pause()
        const input = data.toString().trim().toLowerCase()
        resolve(input === "y" || input === "yes")
      })
    })
  }
}
