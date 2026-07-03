import { Logger } from "./logger"

export enum ErrorCode {
  UNKNOWN = "UNKNOWN",
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  STORAGE_ERROR = "STORAGE_ERROR",
  CRYPTO_ERROR = "CRYPTO_ERROR",
  LLM_ERROR = "LLM_LLM",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  FS_ERROR = "FS_ERROR",
  MARKET_ERROR = "MARKET_ERROR",
  LICENSE_ERROR = "LICENSE_ERROR",
  PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

export class AppError extends Error {
  public code: ErrorCode
  public details?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.details = details
  }
}
