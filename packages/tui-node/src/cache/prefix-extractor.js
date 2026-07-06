/**
 * Prefix Extractor - Split context for Prompt Caching
 * Ensures static prefix has character-level consistency
 */

import { HashIndex } from './hash-index.js'

export class PrefixExtractor {
  constructor(options = {}) {
    this.options = {
      cacheThreshold: 1024, // Minimum tokens to activate cache
      maxPrefixTokens: 8000, // Max tokens for static prefix
      sensitivePatterns: [
        /\.env/,
        /\.env\./,
        /.*\.key$/,
        /.*\.pem$/,
        /.*_secret.*/,
        /.*\.secret$/,
        /node_modules\//,
        /dist\//,
        /build\//,
        /\.cache\//,
      ],
      ...options,
    }
    this.hashIndex = new HashIndex()
  }

  /**
   * Extract static prefix from project context
   * Static prefix = unchanged files + system prompt structure
   */
  extractStaticPrefix(files, systemPrompt) {
    const hashIndex = new HashIndex()

    // Add system prompt as first static part
    const staticParts = []

    if (systemPrompt) {
      staticParts.push({
        role: 'system',
        content: systemPrompt,
        hash: hashIndex.computeHash(systemPrompt),
      })
    }

    // Add unchanged project files
    const sortedFiles = [...files].sort((a, b) =>
      a.path.localeCompare(b.path)
    )

    for (const file of sortedFiles) {
      if (this.isSensitive(file.path)) continue
      if (!file.content) continue

      staticParts.push({
        path: file.path,
        content: file.content,
        hash: hashIndex.computeHash(file.content),
      })
    }

    return staticParts
  }

  /**
   * Extract dynamic suffix (user input + recently changed files)
   */
  extractDynamicSuffix(userInput, changedFiles = []) {
    const dynamicParts = []

    for (const file of changedFiles) {
      if (this.isSensitive(file.path)) continue
      dynamicParts.push({
        path: file.path,
        content: file.content,
        type: 'changed_file',
      })
    }

    if (userInput) {
      dynamicParts.push({
        role: 'user',
        content: userInput,
        type: 'user_input',
      })
    }

    return dynamicParts
  }

  /**
   * Build cache-aware message structure for Anthropic API
   */
  buildAnthropicRequest(staticPrefix, dynamicSuffix) {
    const messages = []
    let currentBlock = []

    // System prompt with cache_control at the end
    const systemBlocks = []
    let systemTokens = 0

    for (const part of staticPrefix) {
      if (part.role === 'system') {
        const tokens = this.estimateTokens(part.content)
        systemTokens += tokens

        // Split system into chunks and mark last as cacheable
        systemBlocks.push({
          type: 'text',
          text: part.content,
        })
      } else {
        // Static file content
        currentBlock.push(`--- ${part.path} ---\n${part.content}`)
      }
    }

    // Add cache_control to last system block if threshold met
    if (systemBlocks.length > 0 && systemTokens >= this.options.cacheThreshold) {
      systemBlocks[systemBlocks.length - 1].cache_control = { type: 'ephemeral' }
    }

    // Add static files as a single user message (prefix)
    if (currentBlock.length > 0) {
      const staticContent = currentBlock.join('\n\n')
      const staticTokens = this.estimateTokens(staticContent)

      if (staticTokens >= this.options.cacheThreshold) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: staticContent },
            { type: 'text', text: '', cache_control: { type: 'ephemeral' } },
          ],
        })
      } else {
        messages.push({
          role: 'user',
          content: staticContent,
        })
      }
    }

    // Add dynamic suffix
    for (const part of dynamicSuffix) {
      if (part.type === 'user_input') {
        messages.push({
          role: 'user',
          content: part.content,
        })
      } else if (part.type === 'changed_file') {
        messages.push({
          role: 'user',
          content: `--- ${part.path} (modified) ---\n${part.content}`,
        })
      }
    }

    return {
      system: systemBlocks,
      messages,
      cacheEnabled: systemTokens >= this.options.cacheThreshold,
      estimatedTokens: {
        system: systemTokens,
        messages: messages.reduce((sum, m) => {
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
          return sum + this.estimateTokens(content)
        }, 0),
      },
    }
  }

  /**
   * Build cache-aware request for OpenAI API
   */
  buildOpenAIRequest(staticPrefix, dynamicSuffix) {
    const messages = []

    // System prompt
    const systemContent = staticPrefix
      .filter(p => p.role === 'system')
      .map(p => p.content)
      .join('\n')

    if (systemContent) {
      messages.push({ role: 'system', content: systemContent })
    }

    // Static files as context message
    const staticFiles = staticPrefix.filter(p => p.role !== 'system')
    if (staticFiles.length > 0) {
      const staticContent = staticFiles
        .map(f => `--- ${f.path} ---\n${f.content}`)
        .join('\n\n')
      messages.push({ role: 'user', content: staticContent })
    }

    // Dynamic suffix
    for (const part of dynamicSuffix) {
      if (part.type === 'user_input') {
        messages.push({ role: 'user', content: part.content })
      } else if (part.type === 'changed_file') {
        messages.push({ role: 'user', content: `--- ${part.path} ---\n${part.content}` })
      }
    }

    return {
      messages,
      cacheEnabled: true, // OpenAI caches automatically
    }
  }

  isSensitive(filePath) {
    return this.options.sensitivePatterns.some(pattern => pattern.test(filePath))
  }

  estimateTokens(text) {
    if (!text) return 0
    const cjkChars = (text.match(/[一-鿿぀-ヿ가-힯]/g) || []).length
    const otherChars = text.length - cjkChars
    return Math.ceil(cjkChars / 2 + otherChars / 4)
  }
}
