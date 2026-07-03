import { Logger } from "@jaicode/core/logger"

export interface Extension {
  name: string
  type: "agent" | "mcp" | "skill"
  version: string
  description: string
  path: string
  manifest: Record<string, unknown>
}

export interface ExtensionManifest {
  name: string
  type: "agent" | "mcp" | "skill"
  version: string
  description: string
  main?: string
  config?: Record<string, unknown>
}

export class Marketplace {
  private static log = new Logger("marketplace")
  private static localDirs: string[] = [
    "~/.jaicode/extensions",
    "./.jaicode/extensions",
  ]

  static setLocalDirs(dirs: string[]): void {
    Marketplace.localDirs = dirs
  }

  static async list(): Promise<Extension[]> {
    const extensions: Extension[] = []

    for (const dir of Marketplace.localDirs) {
      const resolved = dir.replace("~", process.env.HOME || "~")
      try {
        const proc = Bun.spawn(["ls", "-1", resolved], {
          stdout: "pipe",
          stderr: "ignore",
        })
        if (proc.exitCode !== 0) continue
        const output = await new Response(proc.stdout).text()
        const entries = output.split("\n").filter(Boolean)

        for (const entry of entries) {
          const extPath = `${resolved}/${entry}`
          const manifestPath = `${extPath}/manifest.json`
          const manifestFile = Bun.file(manifestPath)

          if (await manifestFile.exists()) {
            try {
              const manifest = JSON.parse(await manifestFile.text())
              extensions.push({
                name: manifest.name || entry,
                type: manifest.type || "skill",
                version: manifest.version || "0.0.0",
                description: manifest.description || "",
                path: extPath,
                manifest,
              })
            } catch {
              // skip invalid manifests
            }
          }
        }
      } catch {
        // directory doesn't exist
      }
    }

    return extensions
  }

  static async search(query: string): Promise<Extension[]> {
    const all = await Marketplace.list()
    const lower = query.toLowerCase()
    return all.filter(
      (ext) =>
        ext.name.toLowerCase().includes(lower) ||
        ext.description.toLowerCase().includes(lower),
    )
  }

  static async install(source: string): Promise<Extension | null> {
    // Install from local path or git URL
    const home = process.env.HOME || "~"
    const targetDir = `${home}/.jaicode/extensions/${source.split("/").pop()?.replace(".git", "") || source}`

    // For now, support local directory copy
    const sourcePath = source.replace("~", home)
    const sourceManifest = `${sourcePath}/manifest.json`
    const manifestFile = Bun.file(sourceManifest)

    if (!(await manifestFile.exists())) {
      Marketplace.log.error("Extension manifest not found", { source })
      return null
    }

    try {
      const manifest = JSON.parse(await manifestFile.text())

      // Copy extension to target directory
      const proc = Bun.spawn(["cp", "-r", sourcePath, targetDir])
      await proc.exited

      return {
        name: manifest.name,
        type: manifest.type,
        version: manifest.version,
        description: manifest.description,
        path: targetDir,
        manifest,
      }
    } catch (e) {
      Marketplace.log.error("Failed to install extension", { source, err: String(e) })
      return null
    }
  }

  static async remove(name: string): Promise<boolean> {
    const home = process.env.HOME || "~"
    const extDir = `${home}/.jaicode/extensions/${name}`

    try {
      const proc = Bun.spawn(["rm", "-rf", extDir])
      await proc.exited
      return true
    } catch {
      return false
    }
  }

  static async get(name: string): Promise<Extension | null> {
    const all = await Marketplace.list()
    return all.find((ext) => ext.name === name) || null
  }
}

// Remote Registry interface (reserved for Phase 2)
export interface IRemoteRegistry {
  search(query: string): Promise<Extension[]>
  get(name: string): Promise<Extension | null>
  download(name: string, version?: string): Promise<string>
}
