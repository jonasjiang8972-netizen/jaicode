import { AgentModeHandler, AgentContext, AgentResult, ContextBuilder } from "./engine"
import { ILLMProvider, LLMMessage } from "@jaicode/llm"
import { FileSystem } from "@jaicode/core"

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+\*/,
  /sudo\s+/,
  /chmod\s+777/,
  /mkfs/,
  /dd\s+if=/,
  />\s*\/dev\//,
  /curl.*\|.*sh/,
  /wget.*\|.*sh/,
  />:*\s*\/etc\//,
]

export class DebugHandler implements AgentModeHandler {
  readonly mode = "debug" as const
  private provider: ILLMProvider
  private maxRetries: number

  constructor(provider: ILLMProvider, maxRetries: number = 5) {
    this.provider = provider
    this.maxRetries = maxRetries
  }

  getSystemPrompt(ctx: AgentContext): string {
    const lang = (ctx.userProfile?.outputPreferences as any)?.language || "zh"
    if (lang === "zh") {
      return `你是一个调试助手。用户提供一个命令，你需要：
1. 执行该命令
2. 如果失败，分析错误原因
3. 生成修复方案
4. 应用修复并重新执行
5. 循环直到成功或达到最大重试次数

输出格式：分析错误原因，给出修复代码（FILE: 格式同 code 模式）。`
    }
    return `You are a debugging assistant. The user provides a command. You must:
1. Execute the command
2. If it fails, analyze the error
3. Generate a fix
4. Apply the fix and re-run
5. Loop until success or max retries reached

Output format: Analyze the error, provide fixes (FILE: format same as code mode).`
  }

  async execute(ctx: AgentContext, task: string): Promise<AgentResult> {
    const lang = (ctx.userProfile?.outputPreferences as any)?.language || "zh"

    // Safety check
    if (this.isDangerous(task)) {
      return {
        success: false,
        output:
          lang === "zh"
            ? `命令因安全原因被阻止：${task}`
            : `Command blocked for safety: ${task}`,
        attempts: 0,
        mode: this.mode,
      }
    }

    const structure = await ContextBuilder.readProjectStructure(ctx.cwd, 2)

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(
        lang === "zh"
          ? `\n第 ${attempt}/${this.maxRetries} 次尝试`
          : `\nAttempt ${attempt}/${this.maxRetries}`,
      )
      console.log(lang === "zh" ? `执行：${task}` : `Running: ${task}`)

      // Execute the command
      const result = this.executeCommand(task, ctx.cwd)

      if (result.success) {
        console.log(
          lang === "zh"
            ? `✓ 已修复，用时 ${attempt} 次尝试！`
            : `✓ Fixed in ${attempt} attempt(s)!`,
        )
        return {
          success: true,
          output: result.stdout,
          attempts: attempt,
          mode: this.mode,
        }
      }

      console.log(
        lang === "zh" ? `✗ 失败：${result.stderr}` : `✗ Failed: ${result.stderr}`,
      )

      if (attempt >= this.maxRetries) {
        console.log(
          lang === "zh"
            ? `已达最大重试次数 (${this.maxRetries})，请人工排查。`
            : `Max retries (${this.maxRetries}) reached. Manual investigation needed.`,
        )
        return {
          success: false,
          output: result.stderr,
          attempts: attempt,
          mode: this.mode,
        }
      }

      console.log(lang === "zh" ? "正在生成修复方案..." : "Generating fix...")

      // Ask LLM for fix
      const messages: LLMMessage[] = [
        { role: "system", content: this.getSystemPrompt(ctx) },
        {
          role: "user",
          content:
            lang === "zh"
              ? `命令 \`${task}\` 失败\n错误输出：\n${result.stderr}\n\n项目结构：\n${structure}\n\n请分析错误并提供修复方案。用 FILE: 格式输出变更文件。`
              : `Command \`${task}\` failed\nError output:\n${result.stderr}\n\nProject structure:\n${structure}\n\nAnalyze the error and provide fixes. Output changed files in FILE: format.`,
        },
      ]

      let fixResponse = ""
      for await (const chunk of this.provider.stream(messages)) {
        if (chunk.type === "text" && chunk.content) {
          fixResponse += chunk.content
          process.stdout.write(chunk.content)
        }
      }
      process.stdout.write("\n")

      // Apply fixes (simplified - would parse FILE: format and apply fixes)
      // In a full implementation, we'd parse and patch files
    }

    return { success: false, output: "Max retries reached", attempts: this.maxRetries, mode: this.mode }
  }

  private isDangerous(cmd: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(cmd))
  }

  private executeCommand(cmd: string, cwd: string): { success: boolean; stdout: string; stderr: string } {
    const proc = Bun.spawnSync(cmd.split(" "), {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60000,
    })

    return {
      success: proc.exitCode === 0,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString(),
    }
  }
}
