/**
 * Config Validation — JSON Schema validation with helpful errors
 */

// ─── Validation Rules ──────────────────────────────────
const PROVIDER_RULES = {
  anthropic: {
    urlPattern: /^https:\/\/api\.anthropic\.com/,
    keyPattern: /^sk-ant-/,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  openai: {
    urlPattern: /^https:\/\/api\.openai\.com/,
    keyPattern: /^sk-/,
    defaultModel: 'gpt-4o',
  },
}

// ─── Validate Config ───────────────────────────────────
export function validateConfig(config) {
  const errors = []
  const warnings = []

  // Check providers
  if (!config.providers || Object.keys(config.providers).length === 0) {
    errors.push('No providers configured. Run: jaicode config --provider <name> --api-key <key>')
  }

  // Check default provider
  if (config.defaultProvider && !config.providers[config.defaultProvider]) {
    errors.push(`Default provider '${config.defaultProvider}' not found in providers`)
  }

  // Validate each provider
  for (const [name, provider] of Object.entries(config.providers || {})) {
    // API Key check
    if (!provider.apiKey && !provider.apiKeyEncrypted) {
      errors.push(`Provider '${name}': No API key configured`)
    } else if (provider.apiKey && provider.apiKey.length < 10) {
      errors.push(`Provider '${name}': API key appears invalid (too short)`)
    }

    // Provider-specific checks
    const rules = PROVIDER_RULES[name]
    if (rules) {
      if (provider.apiKey && !rules.keyPattern.test(provider.apiKey)) {
        warnings.push(`Provider '${name}': API key format may be invalid (expected ${rules.keyPattern})`)
      }
    }

    // Model check
    if (!provider.model) {
      warnings.push(`Provider '${name}': No model specified, using default`)
    }

    // Base URL check for custom
    if (name === 'custom') {
      if (!provider.baseURL) {
        errors.push(`Provider 'custom': No base URL specified`)
      } else if (!provider.baseURL.includes('/chat/completions')) {
        warnings.push(`Provider 'custom': URL should point to /chat/completions endpoint`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ─── Validate Per-Operation ────────────────────────────
export function validateBeforeCall(config) {
  const result = validateConfig(config)
  if (!result.valid) {
    return {
      allowed: false,
      reason: result.errors[0],
      allErrors: result.errors,
    }
  }
  return { allowed: true, warnings: result.warnings }
}

// ─── Fix Config ────────────────────────────────────────
export function autoFixConfig(config) {
  const fixed = JSON.parse(JSON.stringify(config))

  // Set default models
  for (const [name, provider] of Object.entries(fixed.providers || {})) {
    if (!provider.model) {
      const rules = PROVIDER_RULES[name]
      if (rules) provider.model = rules.defaultModel
    }
    if (provider.enabled === undefined) provider.enabled = !!provider.apiKey
  }

  return fixed
}

export { PROVIDER_RULES }
