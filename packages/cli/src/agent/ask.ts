import { AgentModeHandler, AgentContext, AgentResult } from "./engine"
import { ILLMProvider, LLMMessage } from "@jaicode/llm"

export class AskHandler implements AgentModeHandler {
  readonly mode = "ask" as const
  private provider: ILLMProvider

  constructor(provider: ILLMProvider) {
    this.provider = provider
  }

  getSystemPrompt(ctx: AgentContext): string {
    const lang = (ctx.userProfile?.outputPreferences as any)?.language || "zh"
    if (lang === "zh") {
      return `你是一个编程助手。用户会向你提问，请用中文回答。回答要简洁、准确、有帮助。
你可以阅读当前项目的文件来更好地回答问题，但不能修改任何文件。`
    }
    return `You are a coding assistant. The user will ask you questions. Respond concisely, accurately, and helpfully.
You may read project files to better answer questions, but you cannot modify any files.`
  }

  async execute(ctx: AgentContext, task: string): Promise<AgentResult> {
    const messages: LLMMessage[] = [
      { role: "system", content: this.getSystemPrompt(ctx) },
      { role: "user", content: task },
    ]

    const response = await this.provider.chat(messages)

    return {
      success: true,
      output: response.content,
      attempts: 1,
      mode: this.mode,
    }
  }
}
