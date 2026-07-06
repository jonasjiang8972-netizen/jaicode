/**
 * MessageWindow - Sliding window for conversation history
 * Prevents unbounded memory growth in long sessions
 */

export class MessageWindow {
  constructor(options = {}) {
    this.maxMessages = options.maxMessages || 100
    this.maxTokens = options.maxTokens || 10000
    this.compressThreshold = options.compressThreshold || 80
    this.messages = []
    this.totalTokens = 0
  }

  addMessage(role, content, tokens = 0) {
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      content,
      tokens: tokens || this.estimateTokens(content),
      timestamp: Date.now(),
    }

    this.messages.push(msg)
    this.totalTokens += msg.tokens

    // Evict oldest messages if over limits
    while (
      this.messages.length > this.maxMessages ||
      this.totalTokens > this.maxTokens
    ) {
      const removed = this.messages.shift()
      this.totalTokens -= removed.tokens || 0
    }

    return msg
  }

  getRecent(count = 50) {
    return this.messages.slice(-count)
  }

  getContext(threshold = 5000) {
    const context = []
    let tokens = 0

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i]
      if (tokens + msg.tokens > threshold) break
      context.unshift(msg)
      tokens += msg.tokens
    }

    return context
  }

  estimateTokens(text) {
    if (!text) return 0
    const cjkChars = (text.match(/[一-鿿぀-ヿ가-힯]/g) || []).length
    const otherChars = text.length - cjkChars
    return Math.ceil(cjkChars / 2 + otherChars / 4)
  }

  getStats() {
    return {
      totalMessages: this.messages.length,
      totalTokens: this.totalTokens,
      averageTokens: this.messages.length > 0 ? Math.round(this.totalTokens / this.messages.length) : 0,
    }
  }

  reset() {
    this.messages = []
    this.totalTokens = 0
  }
}
