import { Logger } from "./logger"

export class Storage {
  private static log = new Logger("storage")
  private static basePath = "~/.jaicode"

  static setBasePath(path: string): void {
    Storage.basePath = path
  }

  static resolvePath(...segments: string[]): string {
    const home = process.env.HOME || process.env.USERPROFILE || "~"
    const base = Storage.basePath.replace("~", home)
    return [base, ...segments].join("/")
  }

  static async ensureDir(...segments: string[]): Promise<string> {
    const path = Storage.resolvePath(...segments)
    const proc = Bun.spawn(["mkdir", "-p", path])
    await proc.exited
    return path
  }

  static async read<T>(...segments: string[]): Promise<T | null> {
    const path = Storage.resolvePath(...segments)
    try {
      const file = Bun.file(path)
      const exists = await file.exists()
      if (!exists) return null
      const text = await file.text()
      if (!text.trim()) return null
      return JSON.parse(text) as T
    } catch (e) {
      Storage.log.error("Failed to read file", { path, err: String(e) })
      return null
    }
  }

  static async write(data: unknown, ...segments: string[]): Promise<void> {
    const path = Storage.resolvePath(...segments)
    const dirSegments = segments.slice(0, -1)
    await Storage.ensureDir(...dirSegments)
    await Bun.write(path, JSON.stringify(data, null, 2))
  }

  static async append(text: string, ...segments: string[]): Promise<void> {
    const path = Storage.resolvePath(...segments)
    const dirSegments = segments.slice(0, -1)
    await Storage.ensureDir(...dirSegments)
    const file = Bun.file(path)
    const existing = (await file.exists()) ? await file.text() : ""
    await Bun.write(path, existing + text)
  }

  static async listDir(...segments: string[]): Promise<string[]> {
    const path = Storage.resolvePath(...segments)
    const proc = Bun.spawn(["ls", "-1", path], {
      stdout: "pipe",
      stderr: "ignore",
    })
    if (proc.exitCode !== 0) return []
    const output = await new Response(proc.stdout).text()
    return output.split("\n").filter(Boolean)
  }

  static async exists(...segments: string[]): Promise<boolean> {
    const path = Storage.resolvePath(...segments)
    const file = Bun.file(path)
    return file.exists()
  }

  static async remove(...segments: string[]): Promise<void> {
    const path = Storage.resolvePath(...segments)
    const proc = Bun.spawn(["rm", "-rf", path])
    await proc.exited
  }
}
