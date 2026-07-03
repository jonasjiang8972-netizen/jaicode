import { Logger } from "./logger"

export interface SkillManifest {
  name: string
  description: string
  version: string
  author: string
  type: "command" | "agent" | "hook"
  triggers?: string[]
  allowedTools?: string[]
  disableModelInvocation?: boolean
}

export interface Skill {
  manifest: SkillManifest
  content: string
  path: string
}

export class SkillLoader {
  private static log = new Logger("skill-loader")
  private static skillsDirs: string[] = [
    "~/.jaicode/skills",
    "./.jaicode/skills",
  ]

  static setSkillsDirs(dirs: string[]): void {
    SkillLoader.skillsDirs = dirs
  }

  static addSkillsDir(dir: string): void {
    SkillLoader.skillsDirs.unshift(dir)
  }

  static getBuiltinSkillsDir(): string {
    return ""
  }

  static async load(name: string): Promise<Skill | null> {
    for (const dir of SkillLoader.skillsDirs) {
      const resolved = dir.replace("~", process.env.HOME || "~")
      const skillPath = `${resolved}/${name}/SKILL.md`
      const manifestPath = `${resolved}/${name}/manifest.json`

      const skillFile = Bun.file(skillPath)
      if (!(await skillFile.exists())) continue

      const content = await skillFile.text()
      let manifest = await SkillLoader.loadManifest(manifestPath, name)

      return { manifest, content, path: skillPath }
    }

    return null
  }

  static async loadAll(): Promise<Skill[]> {
    const skills: Skill[] = []

    for (const dir of SkillLoader.skillsDirs) {
      const resolved = dir.replace("~", process.env.HOME || "~")
      const proc = Bun.spawn(["ls", "-1", resolved], { stdout: "pipe", stderr: "ignore" })
      await proc.exited
      if (proc.exitCode !== 0) continue
      const output = await new Response(proc.stdout).text()
      const entries = output.split("\n").filter(Boolean)

      for (const entry of entries) {
        const skill = await SkillLoader.load(entry)
        if (skill) skills.push(skill)
      }
    }

    return skills
  }

  static async search(query: string): Promise<Skill[]> {
    const all = await SkillLoader.loadAll()
    const lower = query.toLowerCase()
    return all.filter(
      (s) =>
        s.manifest.name.toLowerCase().includes(lower) ||
        s.manifest.description.toLowerCase().includes(lower),
    )
  }

  private static async loadManifest(path: string, defaultName: string): Promise<SkillManifest> {
    const file = Bun.file(path)
    if (await file.exists()) {
      try {
        return JSON.parse(await file.text())
      } catch {
        // fall through
      }
    }

    return {
      name: defaultName,
      description: "",
      version: "1.0.0",
      author: "jaicode",
      type: "command",
    }
  }

  static parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const lines = content.split("\n")
    const frontmatter: Record<string, string> = {}

    if (lines[0]?.trim() !== "---") {
      return { frontmatter, body: content }
    }

    let endIdx = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIdx = i
        break
      }
      const colonIdx = lines[i].indexOf(":")
      if (colonIdx > 0) {
        const key = lines[i].slice(0, colonIdx).trim()
        const value = lines[i].slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "")
        frontmatter[key] = value
      }
    }

    if (endIdx === -1) {
      return { frontmatter, body: content }
    }

    return {
      frontmatter,
      body: lines.slice(endIdx + 1).join("\n").trimStart(),
    }
  }
}
