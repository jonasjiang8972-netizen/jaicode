import { AgentModeHandler, AgentContext, AgentResult, ContextBuilder } from "./engine"
import { ILLMProvider, LLMMessage } from "@jaicode/llm"

export class ArchitectHandler implements AgentModeHandler {
  readonly mode = "plan" as const
  private provider: ILLMProvider

  constructor(provider: ILLMProvider) {
    this.provider = provider
  }

  getSystemPrompt(ctx: AgentContext): string {
    const lang = (ctx.userProfile?.outputPreferences as any)?.language || "zh"
    if (lang === "zh") {
      return `你是一个架构设计助手。用户描述需求，你需要生成架构决策记录（ADR）。

输出格式（Markdown）：
# ADR: [标题]

## 背景
[需求背景和约束]

## 方案对比
| 方案 | 优点 | 缺点 |
|------|------|------|
| 方案A | ... | ... |
| 方案B | ... | ... |

## 推荐方案
[清晰说明推荐方案及理由]

## 实施步骤
1. ...
2. ...

## 风险点
- [风险及缓解措施]

将 ADR 保存到项目目录下的 ADR.md 文件。`
    }
    return `You are an architecture design assistant. The user describes requirements, and you generate an Architecture Decision Record (ADR).

Output format (Markdown):
# ADR: [Title]

## Background
[Context and constraints]

## Alternatives
| Option | Pros | Cons |
|--------|------|------|
| Option A | ... | ... |
| Option B | ... | ... |

## Recommended Approach
[Clear explanation of recommended approach]

## Implementation Steps
1. ...
2. ...

## Risks
- [Risks and mitigations]

Save the ADR as ADR.md in the project directory.`
  }

  async execute(ctx: AgentContext, task: string): Promise<AgentResult> {
    const lang = (ctx.userProfile?.outputPreferences as any)?.language || "zh"
    const structure = await ContextBuilder.readProjectStructure(ctx.cwd, 3)

    const messages: LLMMessage[] = [
      { role: "system", content: this.getSystemPrompt(ctx) },
      {
        role: "user",
        content:
          lang === "zh"
            ? `需求：${task}\n\n当前项目结构：\n${structure}\n\n请生成架构决策记录。`
            : `Requirements: ${task}\n\nCurrent project structure:\n${structure}\n\nPlease generate an Architecture Decision Record.`,
      },
    ]

    let response = ""
    for await (const chunk of this.provider.stream(messages)) {
      if (chunk.type === "text" && chunk.content) {
        response += chunk.content
        process.stdout.write(chunk.content)
      } else if (chunk.type === "error") {
        return { success: false, output: chunk.error || "Error", attempts: 1, mode: this.mode }
      }
    }

    process.stdout.write("\n")

    // Generate ADR filename with version handling
    const adrPath = await this.generateADRPath(ctx.cwd)
    const { FileSystem } = await import("@jaicode/core")
    await FileSystem.write(adrPath, response, undefined, false)

    return {
      success: true,
      output: response,
      attempts: 1,
      mode: this.mode,
    }
  }

  private async generateADRPath(cwd: string): Promise<string> {
    let counter = 1
    while (true) {
      const path = `${cwd}/ADR${counter > 1 ? `_v${counter}` : ""}.md`
      const file = Bun.file(path)
      if (!(await file.exists())) return path
      counter++
    }
  }
}
