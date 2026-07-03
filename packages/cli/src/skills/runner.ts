import { SkillLoader, Skill } from "@jaicode/core"
import { Logger } from "@jaicode/core/logger"
import { ILLMProvider } from "@jaicode/llm"
import { DiffEngine } from "@jaicode/core"

export interface SkillContext {
  cwd: string
  lang: "zh" | "en"
  provider: ILLMProvider | null
  userProfile: Record<string, unknown> | null
  projectConfig: Record<string, unknown> | null
  args: string[]
}

export class SkillRunner {
  private static log = new Logger("skill-runner")

  static async listSkills(): Promise<void> {
    const skills = await SkillLoader.loadAll()
    if (skills.length === 0) {
      console.log("No skills installed.")
      console.log("Place SKILL.md files in ./.jaicode/skills/<name>/ to install.")
      return
    }

    console.log("Installed skills:")
    for (const skill of skills) {
      console.log(`  ${skill.manifest.name} - ${skill.manifest.description}`)
    }
  }

  static async invoke(name: string, ctx: SkillContext): Promise<boolean> {
    const skill = await SkillLoader.load(name)
    if (!skill) {
      console.log(`Skill not found: ${name}`)
      return false
    }

    const { frontmatter, body } = SkillLoader.parseFrontmatter(skill.content)

    // Replace placeholders in skill body
    let prompt = body
    if (ctx.args.length > 0) {
      prompt = prompt.replace(/\$ARGUMENTS/g, ctx.args.join(" "))
      ctx.args.forEach((arg, i) => {
        prompt = prompt.replace(new RegExp(`\\$${i}`, "g"), arg)
      })
    }

    // Inject dynamic context (execute shell commands in !`cmd` blocks)
    prompt = await SkillRunner.injectDynamicContext(prompt, ctx.cwd)

    console.log(`[skill:${name}] Executing...`)
    console.log()

    // Execute the skill via LLM
    if (ctx.provider) {
      const messages = [
        {
          role: "system" as const,
          content: `You are running the "${name}" skill in Jaicode CLI. Follow the instructions exactly. Output in ${ctx.lang === "zh" ? "Chinese" : "English"}.`,
        },
        { role: "user" as const, content: prompt },
      ]

      try {
        for await (const chunk of ctx.provider.stream(messages)) {
          if (chunk.type === "text" && chunk.content) {
            process.stdout.write(chunk.content)
          } else if (chunk.type === "error") {
            console.error(`\n[skill:${name}] Error: ${chunk.error}`)
            return false
          }
        }
        process.stdout.write("\n")
        return true
      } catch (e: any) {
        console.error(`\n[skill:${name}] Execution failed: ${e.message}`)
        return false
      }
    } else {
      // No provider - output the prompt for the user to see
      console.log(prompt)
      console.log()
      console.log("[skill] No LLM provider configured. Set one with: jaicode config --provider <name> --api-key <key>")
      return false
    }
  }

  private static async injectDynamicContext(prompt: string, cwd: string): Promise<string> {
    const inlinePattern = /!`([^`]+)`/g
    const blockPattern = /```!\n([\s\S]*?)```/g

    let result = prompt

    // Inline: !`command`
    let match: RegExpExecArray | null
    while ((match = inlinePattern.exec(prompt)) !== null) {
      const cmd = match[1]
      const output = await SkillRunner.execCommand(cmd, cwd)
      result = result.replace(match[0], output.trim())
    }

    // Block: ```!\ncommands\n```
    while ((match = blockPattern.exec(prompt)) !== null) {
      const cmds = match[1].trim()
      const outputs: string[] = []
      for (const line of cmds.split("\n")) {
        if (line.trim()) {
          const out = await SkillRunner.execCommand(line.trim(), cwd)
          outputs.push(out.trim())
        }
      }
      result = result.replace(match[0], outputs.join("\n"))
    }

    return result
  }

  private static async execCommand(cmd: string, cwd: string): Promise<string> {
    try {
      const proc = Bun.spawn(cmd.split(" "), {
        cwd,
        stdout: "pipe",
        stderr: "ignore",
        timeout: 30000,
      })
      return await new Response(proc.stdout).text()
    } catch {
      return ""
    }
  }
}
