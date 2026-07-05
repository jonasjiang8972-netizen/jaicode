/**
 * VL Image Analysis — Full pipeline for visual content understanding
 * Connects Provider VL APIs (Claude Vision, GPT-4V, etc.)
 */

import fs from 'node:fs'
import path from 'node:path'
import { info, error, debug } from '../logging/logger.js'

// ─── Provider VL Configs ───────────────────────────────
const VL_ENDPOINTS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    authHeader: 'x-api-key',
    apiVersion: '2023-06-01',
    format: 'anthropic',
    maxTokens: 4096,
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    authHeader: 'Authorization',
    bearerToken: true,
    format: 'openai',
    maxTokens: 4096,
  },
  custom: {
    url: '', // Set dynamically
    authHeader: 'Authorization',
    bearerToken: true,
    format: 'openai',
    maxTokens: 4096,
  },
}

// ─── Analyze Image ─────────────────────────────────────
export async function analyzeImage(imageBase64, mimeType, prompt, providerConfig) {
  try {
    info('VL analysis requested', { mimeType, promptLength: prompt.length })

    const config = VL_ENDPOINTS[providerConfig.provider] || VL_ENDPOINTS.custom

    // Override URL for custom providers
    if (providerConfig.provider === 'custom' && providerConfig.baseURL) {
      config.url = providerConfig.baseURL
    }

    const body = buildVLBody(imageBase64, mimeType, prompt, config)
    const headers = buildVLHeaders(providerConfig, config)

    debug('Sending VL request', { url: config.url })

    const resp = await fetch(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      error('VL API error', { status: resp.status, error: errText })
      return { error: `VL API error: ${resp.status}` }
    }

    const data = await resp.json()
    const description = parseVLResponse(data, config.format)

    info('VL analysis complete', { descriptionLength: description?.length })
    return { description, raw: data }
  } catch (e) {
    error('VL analysis failed', { error: e.message })
    return { error: e.message }
  }
}

// ─── Build Request Body ────────────────────────────────
function buildVLBody(imageBase64, mimeType, prompt, config) {
  if (config.format === 'anthropic') {
    return {
      model: config.model || 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt || 'Describe this image in detail. Focus on code, architecture, and technical content.',
          },
        ],
      }],
    }
  }

  // OpenAI format (default for custom)
  return {
    model: config.model || 'gpt-4o',
    max_tokens: config.maxTokens,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: prompt || 'Describe this image in detail. Focus on code, architecture, and technical content.',
        },
      ],
    }],
  }
}

// ─── Build Headers ─────────────────────────────────────
function buildVLHeaders(providerConfig, config) {
  const headers = { 'Content-Type': 'application/json' }

  if (config.bearerToken) {
    headers['Authorization'] = `Bearer ${providerConfig.apiKey}`
  } else {
    headers[config.authHeader] = providerConfig.apiKey
    if (config.apiVersion) headers['anthropic-version'] = config.apiVersion
  }

  return headers
}

// ─── Parse Response ────────────────────────────────────
function parseVLResponse(data, format) {
  if (format === 'anthropic') {
    return data.content?.[0]?.text || ''
  }
  // OpenAI format
  return data.choices?.[0]?.message?.content || ''
}

// ─── Analyze Image File ────────────────────────────────
export async function analyzeImageFile(filePath, providerConfig) {
  try {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
    }
    const mimeType = mimeTypes[ext]
    if (!mimeType) return { error: `Unsupported image format: ${ext}` }

    const buffer = fs.readFileSync(filePath)
    const base64 = buffer.toString('base64')

    return await analyzeImage(base64, mimeType, undefined, providerConfig)
  } catch (e) {
    return { error: e.message }
  }
}

// ─── Check Provider VL Support ─────────────────────────
export function providerSupportsVL(provider) {
  const vlProviders = ['anthropic', 'openai', 'google', 'custom']
  return vlProviders.includes(provider)
}

export { VL_ENDPOINTS }
