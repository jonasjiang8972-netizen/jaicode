/**
 * Error Handler — Graceful error classification and user-friendly messages
 */

// ─── Error Classification ──────────────────────────────
export class AppError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
    this.timestamp = new Date().toISOString()
  }
}

export const ErrorCode = {
  UNKNOWN: 'UNKNOWN',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INPUT_BLOCKED: 'INPUT_BLOCKED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
}

// ─── Error Handler ─────────────────────────────────────
export function handleError(error, lang = 'en') {
  const isZH = lang === 'zh'

  // Network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return {
      level: 'NETWORK_ERROR',
      title: isZH ? '网络连接失败' : 'Network Error',
      message: isZH ? '无法连接到 LLM 服务，请检查网络。' : 'Cannot connect to LLM service. Check your network.',
      suggestion: isZH ? '检查网络后重试，或更换 Provider。' : 'Check your network, then retry or switch Provider.',
      retryable: true,
    }
  }

  // Provider API errors
  if (error.status === 401 || error.status === 403) {
    return {
      level: 'PROVIDER_ERROR',
      title: isZH ? '认证失败' : 'Authentication Failed',
      message: isZH ? 'API Key 无效或已过期。' : 'API key is invalid or expired.',
      suggestion: isZH ? '运行 config 命令重新配置 API Key。' : 'Run config command to reconfigure API key.',
      retryable: false,
    }
  }

  if (error.status === 429) {
    return {
      level: 'PROVIDER_ERROR',
      title: isZH ? '请求过于频繁' : 'Rate Limited',
      message: isZH ? '已超出 API 调用频率限制。' : 'API rate limit exceeded.',
      suggestion: isZH ? '等待片刻后重试，或升级 API 套餐。' : 'Wait and retry, or upgrade your API plan.',
      retryable: true,
    }
  }

  if (error.status >= 500) {
    return {
      level: 'PROVIDER_ERROR',
      title: isZH ? '服务暂时不可用' : 'Service Unavailable',
      message: isZH ? 'LLM 服务暂时不可用。' : 'LLM service is temporarily unavailable.',
      suggestion: isZH ? '稍后重试，或切换到其他 Provider。' : 'Retry later, or switch to another Provider.',
      retryable: true,
    }
  }

  // Default
  return {
    level: 'UNKNOWN',
    title: isZH ? '未知错误' : 'Unknown Error',
    message: error.message || (isZH ? '发生未知错误。' : 'An unknown error occurred.'),
    suggestion: isZH ? '请截图反馈给开发者。' : 'Please screenshot and report to the developer.',
    retryable: false,
  }
}

// ─── Format for Display ────────────────────────────────
export function formatErrorDisplay(errorInfo, lang = 'en') {
  const parts = [`[${errorInfo.level}] ${errorInfo.title}`]
  parts.push(`  ${errorInfo.message}`)
  if (errorInfo.suggestion) {
    parts.push(`  ${lang === 'zh' ? '建议' : 'Suggestion'}: ${errorInfo.suggestion}`)
  }
  if (errorInfo.retryable) {
    parts.push(`  ${lang === 'zh' ? '可重试' : 'Retryable'}: ✓`)
  }
  return parts.join('\n')
}

export { formatErrorDisplay as formatError }
