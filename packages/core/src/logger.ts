export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  private service: string
  private level: LogLevel
  private static globalLevel: LogLevel = LogLevel.INFO
  private static logDir: string = "~/.jaicode/logs"

  constructor(service: string, level?: LogLevel) {
    this.service = service
    this.level = level ?? Logger.globalLevel
  }

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level
  }

  static setLogDir(dir: string): void {
    Logger.logDir = dir
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  private format(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level,
      service: this.service,
      msg,
      ...data,
    })
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.error(this.format(LogLevel.DEBUG, msg, data))
    }
  }

  info(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.format(LogLevel.INFO, msg, data))
    }
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format(LogLevel.WARN, msg, data))
    }
  }

  error(msg: string, data?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.format(LogLevel.ERROR, msg, data))
    }
  }

  toFile(entry: string): void {
    // Append to log file (delegated to Storage)
    // Implementation in CLI entry after Storage is initialized
  }
}
