import { Logger } from "./logger"
import { Sandbox, PermissionAction } from "./sandbox"

export interface FileBackup {
  originalPath: string
  backupPath: string
  timestamp: number
  content: string
}

export class FileSystem {
  private static log = new Logger("filesystem")
  private static backupDir = ".jaicode_backup"
  private static maxBackups = 20

  static setBackupDir(dir: string): void {
    FileSystem.backupDir = dir
  }

  static async read(path: string, sandbox?: Sandbox): Promise<string> {
    if (sandbox) {
      const action = sandbox.check("read", path)
      if (action === "deny") throw new Error(`Permission denied: read ${path}`)
    }
    const file = Bun.file(path)
    return file.text()
  }

  static async write(
    path: string,
    content: string,
    sandbox?: Sandbox,
    autoBackup: boolean = true,
  ): Promise<void> {
    if (sandbox) {
      const action = sandbox.check("write", path)
      if (action === "deny") throw new Error(`Permission denied: write ${path}`)
    }

    if (autoBackup) {
      await FileSystem.backup(path)
    }

    await Bun.write(path, content)
  }

  static async backup(path: string): Promise<FileBackup | null> {
    try {
      const file = Bun.file(path)
      const exists = await file.exists()
      if (!exists) return null

      const content = await file.text()
      const timestamp = Date.now()
      const backupPath = `${FileSystem.backupDir}/${timestamp}/${path}`

      // Ensure backup directory
      const dir = backupPath.split("/").slice(0, -1).join("/")
      await Bun.write(`${dir}/.keep`, "")

      await Bun.write(backupPath, content)

      const backupMeta: FileBackup = {
        originalPath: path,
        backupPath,
        timestamp,
        content,
      }

      // Store backup record
      await FileSystem.recordBackup(backupMeta)

      FileSystem.log.info("File backed up", { originalPath: path, backupPath })
      return backupMeta
    } catch (e) {
      FileSystem.log.error("Backup failed", { path, err: String(e) })
      return null
    }
  }

  private static async recordBackup(backup: FileBackup): Promise<void> {
    const recordPath = `${FileSystem.backupDir}/index.jsonl`
    const file = Bun.file(recordPath)
    const existing = (await file.exists()) ? await file.text() : ""
    const lines = existing.split("\n").filter(Boolean)

    // Keep only last N backups
    while (lines.length >= FileSystem.maxBackups) {
      lines.shift()
    }

    lines.push(JSON.stringify({ originalPath: backup.originalPath, backupPath: backup.backupPath, timestamp: backup.timestamp }))
    await Bun.write(recordPath, lines.join("\n"))
  }

  static async rollback(steps: number = 1): Promise<string[]> {
    const recordPath = `${FileSystem.backupDir}/index.jsonl`
    const file = Bun.file(recordPath)
    const exists = await file.exists()
    if (!exists) return []

    const text = await file.text()
    const lines = text.split("\n").filter(Boolean)
    if (lines.length === 0) return []

    const restored: string[] = []
    for (let i = 0; i < steps && lines.length > 0; i++) {
      const lastLine = lines.pop()!
      const record = JSON.parse(lastLine)
      const backupFile = Bun.file(record.backupPath)
      const content = await backupFile.text()
      await Bun.write(record.originalPath, content)
      restored.push(record.originalPath)
    }

    await Bun.write(recordPath, lines.join("\n"))
    return restored
  }

  static async getBackupHistory(): Promise<Array<{ originalPath: string; timestamp: number }>> {
    const recordPath = `${FileSystem.backupDir}/index.jsonl`
    const file = Bun.file(recordPath)
    const exists = await file.exists()
    if (!exists) return []

    const text = await file.text()
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  }
}
