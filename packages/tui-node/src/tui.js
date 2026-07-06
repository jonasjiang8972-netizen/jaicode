#!/usr/bin/env node
/**
 * Jaicode - Local-first AI Coding Agent
 * Interactive TUI (Claude Code-like experience)
 * Pure Node.js, no Bun required. Compatible with Apple M5.
 */

import readline from 'node:readline'
import { stdin, stdout } from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { JaiMascot, FRAMES, colorize, padFrame, FRAME_WIDTH } from './mascot.js'
import { Analytics } from './analytics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Version ───────────────────────────────────────────
const VERSION = '0.13.0'

// ─── Mascot ────────────────────────────────────────────
const jai = new JaiMascot()

// ─── Analytics ─────────────────────────────────────────
const analytics = new Analytics()

// ─── Skills ─────────────────────────────────────────────
import { scanProject, buildProjectSummary, buildFileContext, readFile } from './skills/file-reader.js'
import { CapabilityManager } from './skills/capability-check.js'
import { Authorization, AuditLogger } from './auth/authorization.js'
import { filterInput } from './security/input-filter.js'
import { filterOutput } from './security/output-filter.js'
import { handleError, formatError } from './errors/error-handler.js'
import { metrics } from './observability/metrics.js'
import { handleFile, detectFilePaths } from './filesystem/file-handler.js'
import { readClipboardImage } from './filesystem/clipboard-monitor.js'
import { loadHistory, saveToHistory, autocomplete } from './input/history.js'
import { loadConstitution, saveUserConstitution, getConstitutionInfo } from './constitution.js'
import { initLogger, info, debug, warn, error, setLevel } from './logging/logger.js'
import { analyzeImageFile } from './multimodal/vl-analyzer.js'
import { decomposeTask, runSubAgent } from './agents/sub-agent.js'
import { startWebTerminal, stopWebTerminal, checkWebTerminal } from './web/web-terminal.js'
import { validateConfig, autoFixConfig } from './config/validation.js'
import { startWithResilience, checkHealth, stopDaemon } from './resilience/daemon.js'
import { detectImagePaths, validateImage, readImageBase64, getMimeType } from './multimodal/image-handler.js'

// ─── P1: Intent & Memory ──────────────────────────────
import { classifyIntent } from './intent/classifier.js'
import { saveSessionMessage, loadRecentContext, compressOldSessions, getContextWindow } from './memory/session-memory.js'
import { loadProjectMemory, saveProjectMemory, autoScanProject, loadUserProfile, saveUserProfile } from './memory/project-memory.js'
import { checkFreshness, getFreshnessPromptModifier, KNOWLEDGE_CUTOFF } from './knowledge/freshness-check.js'
import { parseFileBlocks, computeDiff, formatDiff, applyDiff, writeFile, BACKUP_DIR } from './filesystem/file-writer.js'
import { saveSession, listSessions, restoreSession, cleanSession, cleanStaleSessions } from './session-manager.js'
import { checkForUpdate, selfUpgrade } from './auto-update.js'
import { gitStatus, gitDiff, gitCommit, gitBranch, gitCreateBranch, gitLog, gitCreatePR, isGitRepo } from './git/git-ops.js'
import { countSessionTokens, compactMessages, shouldCompact } from './memory/context-compact.js'
import { loadHooks, addHook, removeHook, executeHooks } from './hooks/hooks-system.js'
import { loadMCPServers, MCPClient } from './mcp/mcp-client.js'

// ─── Auth ───────────────────────────────────────────────
const auth = new Authorization()
const c = {
  primary: chalk.hex('#00B8D9'),
  accent: chalk.hex('#00E5C9'),
  green: chalk.hex('#39d353'),
  red: chalk.hex('#ff5f56'),
  yellow: chalk.hex('#ffbd2e'),
  dim: chalk.hex('#8b949e'),
  bold: chalk.bold,
  bg: chalk.bgHex('#1a1f3a'),
}

// ─── State ─────────────────────────────────────────────
function findProjectRoot(startDir) {
  let dir = startDir
  const { root } = path.parse(dir)
  while (dir !== root) {
    try {
      if (fs.existsSync(path.join(dir, 'package.json')) ||
          fs.existsSync(path.join(dir, '.git'))) {
        return dir
      }
    } catch { /* ignore */ }
    dir = path.dirname(dir)
  }
  return startDir // fallback to cwd
}

const state = {
  cwd: findProjectRoot(process.cwd()),
  mode: 'auto',
  provider: '',
  model: '',
  lang: detectLang(),
  messages: [],
  isStreaming: false,
  isProcessing: false,
  projectSummary: '',
  pendingFile: null,
}

// ─── Helpers ───────────────────────────────────────────
function detectLang() {
  const envLang = process.env.LANG || process.env.LC_ALL || ''
  return envLang.startsWith('zh') ? 'zh' : 'en'
}

function t(zh, en) { return state.lang === 'zh' ? zh : en }

function clearScreen() { stdout.write('\x1B[2J\x1B[0f') }
function hideCursor() { stdout.write('\x1B[?25l') }
function showCursor() { stdout.write('\x1B[?25h') }
function moveTo(row, col) { stdout.write(`\x1B[${row};${col}H`) }

function detectProject() {
  try {
    const files = fs.readdirSync(state.cwd)
    const pkg = files.find(f => f === 'package.json')
    if (pkg) {
      const p = JSON.parse(fs.readFileSync(path.join(state.cwd, pkg), 'utf-8'))
      return { name: p.name || path.basename(state.cwd), type: 'node', deps: Object.keys(p.dependencies || {}).length }
    }
    if (files.includes('Cargo.toml')) return { name: path.basename(state.cwd), type: 'rust' }
    if (files.includes('go.mod')) return { name: path.basename(state.cwd), type: 'go' }
    if (files.includes('pyproject.toml') || files.includes('requirements.txt')) return { name: path.basename(state.cwd), type: 'python' }
    return { name: path.basename(state.cwd), type: 'unknown' }
  } catch {
    return { name: path.basename(state.cwd), type: 'unknown' }
  }
}

function loadConfig() {
  const configPath = path.join(os.homedir(), '.jaicode', 'config.json')
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')) }
  catch (e) { console.error('[WARN] Config load failed, using defaults'); return { providers: {}, defaultProvider: 'anthropic' } }
}

function saveAPIKey(key) {
  const dir = path.join(os.homedir(), '.jaicode')
  fs.mkdirSync(dir, { recursive: true })
  const configPath = path.join(dir, 'config.json')
  let cfg = {}
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch (e) { console.error('[WARN] Config parse failed:', e.message) }
  if (!cfg.providers) cfg.providers = {}
  cfg.providers.anthropic = { model: 'claude-sonnet-4-20250514', apiKey: key, enabled: true }
  cfg.defaultProvider = 'anthropic'
  if (!cfg.agent) cfg.agent = { maxRetries: 5 }
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

// ─── Legacy classifier (replaced by intent/classifier.js) ──

async function validateAPIKey(providerCfg) {
  try {
    const apiKey = providerCfg.apiKey
    const baseURL = providerCfg.baseURL || ''
    const apiFormat = providerCfg.apiFormat || 'anthropic'
    const model = providerCfg.model || 'claude-sonnet-4-20250514'

    let url, headers, body
    const messages = [{ role: 'user', content: 'hi' }]

    if (apiFormat === 'anthropic') {
      url = baseURL || 'https://api.anthropic.com/v1/messages'
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      body = {
        model,
        max_tokens: 10,
        messages,
        system: 'Reply with one word.',
      }
    } else {
      // OpenAI format
      url = baseURL || 'https://api.openai.com/v1/chat/completions'
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      body = {
        model,
        max_tokens: 10,
        messages: [{ role: 'system', content: 'Reply with one word.' }, ...messages],
      }
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (resp.ok) return { success: true }

    const text = await resp.text()
    let errMsg = `HTTP ${resp.status}`
    try {
      const json = JSON.parse(text)
      errMsg = json.error?.message || json.message || errMsg
    } catch {}
    return { success: false, error: errMsg }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ─── Rendering ─────────────────────────────────────────
function renderStartup() {
  clearScreen()
  stdout.write('\n')

  // Load project summary and file context
  try {
    state.projectSummary = buildProjectSummary(state.cwd)
  } catch { state.projectSummary = '(unable to scan project)' }

  // Check P0 capability gaps
  const p0Missing = CapabilityManager.audit().filter(c => c.required === 'P0' && c.status !== 'available')

  // Welcome screen
  const mascotLines = jai.render(false)
  const cyan = chalk.hex('#00B8D9')
  const orange = chalk.hex('#FF8C00')

  // ─── Logo: T-Rex + Jai wordmark ──────────────────────
  const MASCOT_W = 26
  const LOGO_W = 20
  const GAP = 6
  const LOGO_INDENT = 4 // Logo starts 4 lines below mascot top

  // Pad raw mascot lines to fixed width, then colorize
  const rawMascot = mascotLines.map(l => l.padEnd(MASCOT_W))
  const coloredMascot = colorize(rawMascot)

  // Logo content - pixel art "Jai" in a box
  const logoContent = [
    '╔══════════════════╗',
    '║ ██  █████  ██    ║',
    '║  ██ █  █   █     ║',
    '║  ██  ██    █     ║',
    '║  ██ █  █   █     ║',
    '║ ██  █████  ██    ║',
    '╚══════════════════╝',
    `v${VERSION}            `,
    'Local-first AI Agent ',
  ]

  // Build full logo block (14 lines, matching mascot height)
  const emptyLine = ' '.repeat(LOGO_W)
  const logoLines = [
    ...Array(LOGO_INDENT).fill(emptyLine),
    ...logoContent.map(l => l.padEnd(LOGO_W)),
    ...Array(14 - LOGO_INDENT - logoContent.length).fill(emptyLine),
  ]

  // Render: indent + colored mascot + fixed gap + logo
  for (let i = 0; i < 14; i++) {
    const m = coloredMascot[i] || ' '.repeat(MASCOT_W)
    const l = logoLines[i] || emptyLine
    stdout.write(`  ${m}${' '.repeat(GAP)}${l}\n`)
  }
  stdout.write(c.dim('  ' + '─'.repeat(50) + '\n'))

  // Provider status
  const cfg = loadConfig()
  const { name: providerName, cfg: providerCfg } = getProviderConfig(cfg)
  if (providerCfg?.apiKey) {
    state.provider = providerName
    state.model = providerCfg.model || 'claude-sonnet-4-20250514'
    const base = providerCfg.baseURL ? c.dim(` → ${providerCfg.baseURL.slice(0, 35)}...`) : ''
    stdout.write(c.dim('   Provider: ') + c.green(`✓ ${providerName}`) + c.dim(` (${state.model})`) + base + '\n')
  } else {
    stdout.write(c.dim('   Provider: ') + c.red('✗ Not configured') + '\n')
    stdout.write(c.yellow('\n   ⚠ No API Key found.\n'))
  }

  stdout.write(c.dim('\n   ' + '─'.repeat(50) + '\n'))
  stdout.write(c.dim(`   ${t('输入任务描述直接开始 · Ctrl+C 退出 · /help 命令列表', 'Type a task to begin · Ctrl+C exit · /help commands')}\n\n`))

  // Show P0 capability gaps
  if (p0Missing.length > 0) {
    stdout.write(c.yellow(`  ⚠ ${p0Missing.length} P0 能力缺失: /caps 查看 | /fix <ID> 开发`))
  }
}

function renderMessages() {
  if (state.messages.length === 0) {
    stdout.write(c.dim(`   ${t('开始对话吧！例如:', 'Start a conversation:')}\n`))
    stdout.write(c.dim('     "修复登录接口的 bug"\n'))
    stdout.write(c.dim('     "解释这段代码做了什么"\n'))
    stdout.write(c.dim('     "设计用户认证模块架构"\n\n'))
    return
  }

  state.messages.forEach(msg => {
    const time = c.dim(new Date(msg.timestamp).toLocaleTimeString())
    if (msg.role === 'user') {
      stdout.write(`${c.primary('❯')} ${c.bold(t('You', '你'))} ${time}\n`)
      stdout.write(`  ${msg.content}\n\n`)
    } else if (msg.role === 'thinking') {
      // 思考过程 - 折叠展示
      stdout.write(`${c.yellow('⚙')} ${c.dim(t('思考过程', 'Thinking'))} ${time}\n`)
      const lines = msg.content.split('\n')
      lines.forEach(line => {
        stdout.write(c.dim(`  │ ${line}\n`))
      })
      stdout.write('\n')
    } else if (msg.role === 'assistant') {
      stdout.write(`${c.accent('⬡')} ${c.bold('Jaicode')} ${time}`)
      if (msg.processingTime) stdout.write(c.dim(` (${msg.processingTime}ms)`))
      stdout.write('\n')

      const lines = msg.content.split('\n')
      lines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          stdout.write('  ' + c.green(line) + '\n')
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          stdout.write('  ' + c.red(line) + '\n')
        } else {
          stdout.write('  ' + line + '\n')
        }
      })
      stdout.write('\n')
    } else if (msg.role === 'system') {
      stdout.write(c.dim(`  ℹ ${msg.content}\n\n`))
    }
  })
}

function renderStatusBar() {
  const mode = state.mode === 'auto' ? t('自动', 'Auto') : state.mode.toUpperCase()
  const provider = state.provider || t('未设置', 'None')
  const statusColor = state.isProcessing ? c.yellow : c.green
  const statusIcon = state.isProcessing ? '◐' : '●'

  // Get animated small mascot
  const smallMascot = jai.render(true)
  const mascotLine = (smallMascot[0] || '').padEnd(18)
  const coloredMascot = colorize([mascotLine])[0]

  // Get analytics
  const stats = analytics.getStatusBarStats()

  const left = `  ${coloredMascot}  ${statusIcon} ${mode}`
  const right = `${stats.current} | ${stats.total}`
  const padding = ' '.repeat(Math.max(0, process.stdout.columns - left.length - right.length - 4))

  stdout.write('\n' + statusColor(left) + padding + c.dim(right) + '\n')
}

function renderSpinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  return setInterval(() => {
    stdout.write(`\r  ${c.primary(frames[i % frames.length])} ${text}`)
    i++
  }, 80)
}

// P3-4.3: Progress bar for long operations
function renderProgressBar(current, total, text) {
  const width = 30
  const filled = Math.round((current / total) * width)
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  const pct = Math.round((current / total) * 100)
  stdout.write(`\r  [${bar}] ${pct}% ${text}`)
}

// ─── API Endpoint Registry ─────────────────────────────
const API_ENDPOINTS = {
  anthropic: { url: 'https://api.anthropic.com/v1/messages', auth: 'x-api-key', apiVersion: '2023-06-01', apiFormat: 'anthropic' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', auth: 'bearer', apiFormat: 'openai' },
}

function getProviderConfig(cfg) {
  const name = cfg.defaultProvider || 'anthropic'
  const providerCfg = cfg.providers?.[name] || {}
  const endpoint = API_ENDPOINTS[name] || {
    url: providerCfg.baseURL || 'https://api.openai.com/v1/chat/completions',
    auth: providerCfg.baseURL ? 'bearer' : 'x-api-key',
    apiFormat: providerCfg.apiFormat || (providerCfg.baseURL ? 'openai' : 'anthropic'),
  }
  return { name, cfg: providerCfg, endpoint }
}

// ─── LLM API ───────────────────────────────────────────
async function callLLM(messages) {
  const cfg = loadConfig()
  const { name: providerName, cfg: providerCfg, endpoint } = getProviderConfig(cfg)

  if (!providerCfg?.apiKey) {
    return { error: t('未配置 API Key', 'No API Key configured') }
  }

  const apiKey = providerCfg.apiKey
  const model = providerCfg.model || providerCfg.defaultModel || 'claude-sonnet-4-20250514'

  // Inject constitution as the first system message
  const constitution = loadConstitution({
    VERSION: '0.13.0',
    MODE: state.mode,
    LANGUAGE: state.lang === 'zh' ? 'Chinese' : 'English',
    PROJECT_CONTEXT: state.projectSummary || 'No project scan available',
    USER_PREFERENCES: JSON.stringify(loadUserProfile().outputPreferences || {}),
  })

  // Prepend constitution to messages if not already present
  if (messages.length === 0 || messages[0].role !== 'system' || !messages[0].content.includes('Jaicode Constitution')) {
    messages.unshift({ role: 'system', content: constitution })
  }

  const modePrompts = {
    plan: t('你是一个架构设计专家。生成架构决策记录（ADR）。',
            'You are an architecture design expert. Generate ADRs.'),
    code: t('你是一个编程助手。修改代码时使用红色-删除和绿色+新增的 diff 格式展示变更。',
            'You are a coding assistant. Show file changes in diff format with -red and +green.'),
    debug: t('你是一个调试助手。分析错误原因并提供修复方案。',
             'You are a debugging assistant. Analyze errors and provide fixes.'),
    ask: t('你是一个简洁的问答助手。直接回答问题，不要做出代码变更。',
           'You are a concise Q&A assistant. Answer directly without code changes.'),
  }

  const systemPrompt = `${modePrompts[state.mode] || modePrompts.code}
${state.lang === 'zh' ? '用中文回复。' : 'Reply in English.'}
Project: ${detectProject().name}`

  // OpenAI format (default for custom endpoints)
  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ],
  }

  const headers = { 'Content-Type': 'application/json' }
  const isAnthropic = endpoint.apiFormat === 'anthropic'

  if (!isAnthropic) {
    // OpenAI format (includes openAI-compatible)
    headers['Authorization'] = `Bearer ${apiKey}`
  } else {
    // Anthropic format
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = endpoint.apiVersion || '2023-06-01'
    // Convert to Anthropic format: move system to first user message
    body.messages = [
      { role: 'user', content: systemPrompt },
      ...messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    ]
  }

  const resp = await fetch(endpoint.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    let errMsg = `HTTP ${resp.status}`
    try {
      const errJson = JSON.parse(errText)
      errMsg = errJson.error?.message || errJson.message || errMsg
    } catch { /* use default */ }
    return { error: `${providerName}: ${errMsg}`, status: resp.status }
  }

  return { stream: resp.body, apiFormat: endpoint.apiFormat }
}

async function streamResponse(streamRes) {
  const reader = streamRes.stream.getReader()
  const decoder = new TextDecoder()
  let response = ''
  const isAnthropic = streamRes.apiFormat === 'anthropic'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          let content
          if (isAnthropic) {
            // Anthropic SSE: event: content_block_delta, data: {"type":"content_block_delta","delta":{"text":"..."}}
            if (json.type === 'content_block_delta') {
              content = json.delta?.text
            }
          } else {
            // OpenAI SSE: data: {"choices":[{"delta":{"content":"..."}}]}
            content = json.choices?.[0]?.delta?.content
          }
          if (content) {
            response += content
            process.stdout.write(content)
          }
        } catch { /* skip */ }
      } else if (isAnthropic && line.startsWith('event: ')) {
        // Anthropic event marker, skip
        continue
      }
    }
  }

  return response
}

// ─── Input ─────────────────────────────────────────────
async function getInput(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: stdin, output: stdout })
    stdout.write(prompt)
    rl.on('line', line => {
      rl.close()
      resolve(line)
    })
  })
}

async function getRawInput(prompt) {
  return new Promise(resolve => {
    if (!stdin.isTTY) return getInput(prompt)

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    stdout.write(prompt)

    let buffer = ''
    const onData = (key) => {
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        stdout.write('\n')
        resolve(buffer)
      } else if (key === '\u0003') {
        stdin.setRawMode(false)
        stdin.pause()
        showCursor()
        process.exit(0)
      } else if (key === '\u007f') {
        buffer = buffer.slice(0, -1)
      } else if (key === '\t') {
        buffer += '  '
      } else if (!key.startsWith('\x1b')) {
        buffer += key
        stdout.write(key)
      }
    }
    stdin.on('data', onData)
  })
}

// ─── Main Loop ─────────────────────────────────────────
async function processMessage(userInput) {
  const startTime = Date.now()
  const thinking = []

  // P0-1.3: Input security filter
  const inputCheck = filterInput(userInput)
  if (inputCheck.blocked) {
    state.messages.push({
      role: 'system',
      content: `⚠️ 输入被拦截: ${inputCheck.reason}`,
      timestamp: Date.now(),
    })
    AuditLogger.log('input_blocked', 'L0', { reason: inputCheck.reason }, { allowed: false, reason: inputCheck.reason })
    return
  }

  // Use cleaned input (with sensitive data redacted)
  const cleanInput = inputCheck.clean

  // Add user message (use cleaned input)
  state.messages.push({
    role: 'user',
    content: cleanInput,
    timestamp: Date.now(),
  })

  // Save to session memory (use cleaned input)
  saveSessionMessage({ role: 'user', content: cleanInput })

  // Auto-classify intent (async, with LLM fallback)
  const intentResult = state.mode === 'auto'
    ? await classifyIntent(userInput, callLLM)
    : { mode: state.mode, confidence: 1.0 }
  const intent = intentResult.mode
  thinking.push(`[${t('意图识别', 'Intent')}] ${intent.toUpperCase()} (${Math.round(intentResult.confidence * 100)}%)`)

  // Show thinking + animate mascot
  jai.setState('thinking')
  state.isProcessing = true
  state.messages.push({
    role: 'thinking',
    content: thinking.join('\n'),
    timestamp: Date.now(),
  })
  const thinkingIdx = state.messages.length - 1

  try {
    // Load config (thinking step)
    const cfg = loadConfig()
    const { name: providerName, cfg: providerCfg, endpoint } = getProviderConfig(cfg)

    if (!providerCfg?.apiKey) {
      const errTag = t('错误', 'Error')
      const errMsg = t('未配置 API Key', 'No API Key')
      state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') + `\n[${errTag}] ${errMsg}` }
      state.messages.push({ role: 'assistant', content: `❌ ${t('未配置 API Key', 'No API Key configured')}`, timestamp: Date.now() })
      state.isProcessing = false
      return
    }

    thinking.push(`[${t('Provider', '服务')}] ${providerName}`)
    thinking.push(`[${t('模型', 'Model')}] ${providerCfg.model || 'default'}`)
    if (providerCfg.baseURL) thinking.push(`[${t('API地址', 'Endpoint')}] ${providerCfg.baseURL}`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }

    // Build messages
    thinking.push(`[${t('构建请求', 'Request')}] ${t('组装历史消息和系统提示', 'Building messages + system prompt')}...`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }

    const modePrompts = {
      plan: `You are Jaicode (v${VERSION}), an architecture design expert.
You run inside a terminal TUI application.
Important: You have direct terminal access. You can:
- Read project files to understand the current state
- Analyze technical choices and generate ADRs
- Suggest specific executable commands
Do NOT say "I cannot execute". Give actionable steps and commands.
Always respond in the user's language preference.`,
      code: `You are Jaicode (v${VERSION}), a coding assistant with full terminal access.
When the user requests code changes, give specific commands and code diffs.
You can: read files, write files, modify code, run shell commands, install deps, run tests.
Output format: explanation first, then exact commands and diffs.
NEVER say "I cannot execute" — you ARE the executor.
Always respond in the user's language preference.`,
      debug: `You are Jaicode (v${VERSION}), a debugging assistant with full terminal access.
When the user reports errors, perform troubleshooting and fixes:
- Analyze error causes
- Provide fixes in diff format
- Give verification commands
NEVER say "I cannot execute commands".
Always respond in the user's language preference.`,
      ask: `You are Jaicode (v${VERSION}), a concise Q&A assistant.
Answer questions directly and accurately.
If a question requires command execution, provide the exact commands.
Always respond in the user's language preference.`,
    }
    const langNote = state.lang === 'zh' ? '用中文回复。' : 'Reply in English.'

    // Load project memory for context
    const projectMem = loadProjectMemory(state.cwd) || autoScanProject(state.cwd)
    saveProjectMemory(state.cwd, projectMem)

    const projectContext = state.lang === 'zh'
      ? `\n\n当前项目信息:\n- 名称: ${projectMem.project.name || '未知'}\n- 技术栈: ${Array.isArray(projectMem.project.techStack) ? projectMem.project.techStack.join(', ') : '未知'}\n- 目录: ${Array.isArray(projectMem.project.directories) ? projectMem.project.directories.slice(0, 8).join(', '): '无'}`
      : `\n\nProject context:\n- Name: ${projectMem.project.name || 'unknown'}\n- Stack: ${Array.isArray(projectMem.project.techStack) ? projectMem.project.techStack.join(', ') : 'unknown'}\n- Dirs: ${Array.isArray(projectMem.project.directories) ? projectMem.project.directories.slice(0, 8).join(',') : 'none'}`

    // Knowledge freshness check
    const freshnessNote = getFreshnessPromptModifier(userInput)

    // Load session context (recent conversation history)
    const sessionContext = getContextWindow()

    const messages = [
      { role: 'system', content: `${modePrompts[intent] || modePrompts.code} ${langNote}${projectContext}${freshnessNote}` },
      ...sessionContext.map(m => ({ role: m.role, content: m.content })),
      ...state.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userInput },
    ]

    // Call API
    thinking.push(`[${t('连接中', 'Connecting')}] ${t('正在连接 API...', 'Connecting to API...')}`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }

    const result = await callLLM(messages)

    if (result.error) {
      thinking.push(`[${t('错误', 'Error')}] ${result.error}`)
      state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
      state.messages.push({ role: 'assistant', content: `❌ ${result.error}`, timestamp: Date.now(), processingTime: Date.now() - startTime })
      state.isProcessing = false
      return
    }

    thinking.push(`[${t('已连接', 'Connected')}] ${t('开始接收响应...', 'Receiving response...')}`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }

    // Stream response
    if (result.stream || result.body) {
      const streamResult = result.stream ? result : { stream: result.body, apiFormat: result.apiFormat }

      // Print response header + mascot starts talking
      jai.setState('talking')
      process.stdout.write(`${c.accent('⬡')} ${c.bold('Jaicode')} ${c.dim(new Date().toLocaleTimeString())}\n  `)

      // Start async thinking redraw during streaming
      const redrawTimer = setInterval(() => {
        if (state.messages[thinkingIdx]) {
          const content = state.messages[thinkingIdx].content
          const lastLine = content.split('\n').pop()
          if (lastLine && lastLine.includes('[')) {
            process.stdout.write(`\r  ${c.dim(lastLine.slice(-60))}`)
          }
        }
      }, 200)

      const response = await streamResponse(streamResult)
      clearInterval(redrawTimer)
      jai.setState('idle')

      // P0-1.2: Output security filter (redact sensitive data)
      const outputCheck = filterOutput(response)
      const safeResponse = outputCheck.clean

      // Save assistant response to session memory (use safe response)
      saveSessionMessage({ role: 'assistant', content: safeResponse })

      // ─── P0-1: File write from AI response ──────
      const fileBlocks = parseFileBlocks(safeResponse)
      if (fileBlocks.length > 0) {
        for (const file of fileBlocks) {
          const filePath = file.path
          let oldContent = ''
          try { oldContent = fs.readFileSync(path.join(state.cwd, filePath), 'utf-8') } catch {}

          if (file.format === 'block') {
            // Full file replacement
            const diff = computeDiff(oldContent, file.content, filePath)
            const diffText = formatDiff(filePath, diff)
            state.messages.push({
              role: 'system',
              content: `${c.yellow('[Write]')} ${filePath}\n${c.dim('Changes:')} +${diff.reduce((a, h) => a + h.lines.filter(l => l.startsWith('+')).length, 0)} -${diff.reduce((a, h) => a + h.lines.filter(l => l.startsWith('-')).length, 0)}`,
              timestamp: Date.now(),
            })
            // Confirm with user
            state.messages.push({
              role: 'system',
              content: 'Apply this change? [y/N] ',
              timestamp: Date.now(),
            })
            state.pendingFile = { path: filePath, content: file.content }
          }
        }
      }

      if (!safeResponse || safeResponse.trim().length === 0) {
        thinking.push(`[${t('响应为空', 'Empty')}] ${t('对方返回空内容', 'Empty response received')}`)
        state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
        state.messages.push({ role: 'assistant', content: `⚠️ ${t('模型返回空内容，请检查 API Key 或模型名称', 'Model returned empty response. Check API key or model.')}`, timestamp: Date.now(), processingTime: Date.now() - startTime })
      } else {
        thinking.push(`[${t('完成', 'Done')}] ${t('响应长度', 'Response')}: ${safeResponse.length} chars`)
        state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
        state.messages.push({ role: 'assistant', content: safeResponse, timestamp: Date.now(), processingTime: Date.now() - startTime })
      }
    }
  } catch (e) {
    thinking.push(`[${t('异常', 'Exception')}] ${e.message}`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
    state.messages.push({ role: 'assistant', content: `❌ ${e.message}`, timestamp: Date.now(), processingTime: Date.now() - startTime })
  }

  state.isProcessing = false

  // Auto-save session
  saveSession(state)

  // Context compaction check
  if (shouldCompact(state.messages)) {
    const { messages, compacted, tokens } = compactMessages(state.messages)
    if (compacted) {
      state.messages = messages
      state.messages.push({
        role: 'system',
        content: `[Context compacted: ${tokens} tokens remaining]`,
        timestamp: Date.now(),
      })
    }
  }
}

async function main() {
  // Initialize logger
  initLogger({ level: process.env.JAICODE_LOG_LEVEL || 'INFO' })
  info('Jaicode starting', { version: VERSION, cwd: process.cwd() })

  // Check API key if not configured
  const cfg = loadConfig()
  const hasAnyKey = Object.values(cfg.providers || {}).some(p => p.apiKey) ||
                     process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY

  // Validate config
  const validation = validateConfig(cfg)
  if (!validation.valid && hasAnyKey) {
    warn('Config validation failed', { errors: validation.errors })
    for (const err of validation.errors) {
      stdout.write(c.yellow(`  ⚠ ${err}\n`))
    }
  }

  if (!hasAnyKey) {
    clearScreen()
    stdout.write(c.yellow.bold('\n  ⚠ 未检测到 API Key\n\n'))
    stdout.write(c.dim('  选择你的 LLM Provider:\n\n'))

    // Preset provider configs (auto-fill URL and model)
    const presets = {
      '4': { name: 'LongCat', model: 'LongCat-2.0', apiFormat: 'openai', baseURL: 'https://api.longcat.chat/openai/v1/chat/completions', url: 'https://longcat.chat/platform/api_keys' },
      '5': { name: 'DeepSeek', model: 'deepseek-chat', apiFormat: 'openai', baseURL: 'https://api.deepseek.com/v1/chat/completions', url: 'https://platform.deepseek.com/api_keys' },
      '6': { name: '智谱 GLM', model: 'glm-4-flash', apiFormat: 'openai', baseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', url: 'https://open.bigmodel.cn/usercenter/apikeys' },
    }

    const providers = [
      { key: '1', name: 'Anthropic', label: 'Claude 官方', url: 'https://console.anthropic.com/settings/keys', model: 'claude-sonnet-4-20250514', apiFormat: 'anthropic', baseURL: 'https://api.anthropic.com/v1/messages' },
      { key: '2', name: 'OpenAI', label: 'GPT 官方', url: 'https://platform.openai.com/api-keys', model: 'gpt-4o', apiFormat: 'openai', baseURL: 'https://api.openai.com/v1/chat/completions' },
      { key: '3', name: 'LongCat', label: '美团 · LongCat-2.0', url: 'https://longcat.chat/platform/api_keys', model: 'LongCat-2.0', apiFormat: 'openai', baseURL: 'https://api.longcat.chat/openai/v1/chat/completions' },
      { key: '4', name: '其他中转', label: 'OpenAI 兼容', url: '', model: 'gpt-4o', apiFormat: 'openai', baseURL: '' },
    ]

    providers.forEach(p => {
      stdout.write(c.dim(`    [${p.key}] ${p.name} — ${p.label}\n`))
    })

    stdout.write('\n')
    const choice = await getInput(c.primary('  选择 (1-3): '))
    const selected = providers.find(p => p.key === choice) || providers[0]

    // Ask for custom base URL if third-party
    let baseURL = selected.baseURL
    let model = selected.model
    let apiFormat = selected.apiFormat

    if (selected.key === '4') {
      baseURL = await getInput(c.primary('\n  输入中转 API 地址 (如 https://xxx.com/v1 或 .../openai):\n  > '))
      if (!baseURL) {
        stdout.write(c.red('  ✗ 必须提供 API 地址\n\n'))
        process.exit(1)
      }
      // Auto-append /chat/completions if path looks incomplete
      if (!baseURL.includes('/chat/completions')) {
        baseURL = baseURL.replace(/\/+$/, '') + '/chat/completions'
        stdout.write(c.dim(`  → 路径补全: ${baseURL}\n`))
      }
      model = await getInput(c.primary('  输入模型名称: ')) || 'gpt-4o'
      apiFormat = 'openai'
      stdout.write(c.dim(`  ✓ 中转地址: ${baseURL}\n`))
      stdout.write(c.dim(`  ✓ 模型: ${model}\n`))
    } else if (selected.url) {
      stdout.write(c.dim(`\n  获取 Key: ${selected.url}\n`))
    }

    const key = await getInput(c.primary(`\n  输入 ${selected.name} API Key: `))
    if (!key || key.length < 5) {
      stdout.write(c.red('  ✗ 无效的 Key\n\n'))
      process.exit(1)
    }

    // Build config
    const dir = path.join(os.homedir(), '.jaicode')
    fs.mkdirSync(dir, { recursive: true })
    const configPath = path.join(dir, 'config.json')

    // Determine provider key name
    const providerKey = selected.key === '1' ? 'anthropic' : selected.key === '2' ? 'openai' : 'custom'

    const newCfg = {
      version: 1,
      language: state.lang,
      providers: {
        ...(cfg.providers || {}),
        [providerKey]: {
          model,
          apiKey: key,
          enabled: true,
          baseURL: baseURL || undefined,
          apiFormat: apiFormat,
        },
      },
      defaultProvider: providerKey,
      agent: { maxRetries: 5 },
      tips: { enabled: true, triggerCount: 10 },
    }

    // Validate API key before saving
    stdout.write(c.dim('\n  正在验证 API Key...'))
    const valid = await validateAPIKey(newCfg.providers[providerKey])
    if (!valid.success) {
      stdout.write(c.red(`\n  ✗ 验证失败: ${valid.error}\n`))
      stdout.write(c.dim('  请检查 Key 和 API 地址是否正确。\n\n'))
      process.exit(1)
    }

    fs.writeFileSync(configPath, JSON.stringify(newCfg, null, 2))
    stdout.write(c.green(`\n  ✓ API Key 验证成功！已保存为 "${providerKey}"\n\n`))

    await new Promise(r => setTimeout(r, 800))
  }

  // Welcome screen
  renderStartup()

  // Initialize permissions file on first run
  try {
    const permPath = path.join(os.homedir(), '.jaicode', 'permissions.json')
    if (!fs.existsSync(permPath)) {
      fs.mkdirSync(path.dirname(permPath), { recursive: true })
      fs.writeFileSync(permPath, JSON.stringify({
        permissions: {
          L0_read: 'session',
          L1_write: 'ask',
          L2_exec: 'ask',
          L3_extend: 'ask',
          L4_network: 'ask',
          autoApproveReadOnly: true,
          blockedCommands: ['rm -rf', 'sudo', 'chmod 777', 'mkfs', 'dd if='],
          allowedDomains: [],
        }
      }, null, 2))
    }
  } catch { /* ignore */ }

  // Clean up old sessions on startup
  cleanStaleSessions()

  // Auto-update check (background)
  const updateCheck = await checkForUpdate()
  if (updateCheck.hasUpdate && !updateCheck.cached) {
    state.messages.push({
      role: 'system',
      content: `⬡ Update available: v${updateCheck.latestVersion} (current: v${updateCheck.currentVersion}). Run /update to apply.`,
      timestamp: Date.now(),
    })
  }

  // Chat loop
  hideCursor()
  while (true) {
    renderMessages()
    renderStatusBar()
    stdout.write('\n')

    const input = await getInput(c.primary('  ❯ '))
    if (!input.trim()) continue

    // Handle commands
    if (input.startsWith('/')) {
      const cmd = input.slice(1).trim()
      if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') break
      if (cmd === 'clear') {
        state.messages = []
        clearScreen()
        renderStartup()
        continue
      }
      if (cmd === 'help') {
        state.messages.push({
          role: 'system',
           content: t(
            '命令: /quit · /clear · /mode · /stats · · /config · /read <文件> · /exec <命令> · /audit · · /caps · /constitution · /fix <能力> · /paste · /git · · /hooks · · /mcp · · /update · /sessions · · /image · /web · /agents · /daemon',
            'Commands: /quit · /clear · /mode · · /stats · /config · /read <f> · /exec <cmd> · /audit · · /caps · /constitution · · /fix <cap> · · /paste · /git · · /hooks · · /mcp · · /update · /sessions · /image · · /web · /agents · /daemon'
          ),
          timestamp: Date.now(),
        })
        continue
      }
      if (cmd === 'stats') {
        state.messages.push({ role: 'system', content: analytics.getDetailedReport().join('\n'), timestamp: Date.now() })
        continue
      }
      if (cmd === 'mode') {
        const modes = ['auto', 'plan', 'code', 'debug', 'ask']
        const idx = modes.indexOf(state.mode === 'auto' ? 'auto' : state.mode)
        state.mode = state.mode === 'auto' ? 'code' : modes[idx] === 'ask' ? 'auto' : modes[(idx + 1) % modes.length]
        state.messages.push({
          role: 'system',
          content: t(`模式: ${state.mode.toUpperCase()}`, `Mode: ${state.mode.toUpperCase()}`),
          timestamp: Date.now(),
        })
        continue
      }
      if (cmd === 'config') {
        state.messages.push({
          role: 'system',
          content: t('运行 `jaicode config --provider <name> --api-key <key>`', 'Run `jaicode config --provider <name> --api-key <key>`'),
          timestamp: Date.now(),
        })
        continue
      }
      if (cmd === 'read') {
        const filePath = input.slice(5).trim()
        if (!filePath) {
          state.messages.push({ role: 'system', content: t('用法: /read <文件路径>', 'Usage: /read <filepath>'), timestamp: Date.now() })
          continue
        }
        // Check L0 authorization
        const perm = await auth.checkPermission('L0', { path: filePath })
        if (perm.allowed === 'ask') {
          auth.grantSession('L0')
          AuditLogger.log('read', 'L0', { path: filePath }, { allowed: true, reason: 'Session authorized' })
        } else if (perm.allowed === false) {
          AuditLogger.log('read', 'L0', { path: filePath }, perm)
          state.messages.push({ role: 'system', content: perm.reason, timestamp: Date.now() })
          continue
        }
        const result = readFile(state.cwd, filePath)
        if (result.error) {
          state.messages.push({ role: 'system', content: t('读取失败', 'Error') + ': ' + result.error, timestamp: Date.now() })
        } else {
          state.messages.push({ role: 'system', content: '--- ' + filePath + ' ---\n' + result.content, timestamp: Date.now() })
        }
        continue
      }
      if (cmd === 'exec' || cmd === 'run') {
        const execCmd = input.slice(cmd === 'exec' ? 5 : 4).trim()
        if (!execCmd) {
          state.messages.push({ role: 'system', content: t('用法: /exec <命令>', 'Usage: /exec <command>'), timestamp: Date.now() })
          continue
        }
        // Check L2 authorization
        const perm = await auth.checkPermission('L2', { command: execCmd })
        if (perm.allowed === 'ask') {
          state.messages.push({ role: 'system', content: t('需要授权执行: ' + execCmd, 'Auth required: ' + execCmd) + '\n' + t('本次会话授权 [y/N]: ', 'Grant session [y/N]: '), timestamp: Date.now() })
          // Note: In real implementation we'd wait for input. For now auto-grant for non-dangerous.
          const validation = validateCommand(execCmd)
          if (!validation.safe) {
            AuditLogger.log('exec', 'L2', { command: execCmd }, { allowed: false, reason: validation.reason })
            state.messages.push({ role: 'system', content: '⚠️ ' + validation.reason, timestamp: Date.now() })
            continue
          }
          auth.grantSession('L2')
          AuditLogger.log('exec', 'L2', { command: execCmd }, { allowed: true, reason: 'Session granted' })
        } else if (perm.allowed === false) {
          AuditLogger.log('exec', 'L2', { command: execCmd }, perm)
          state.messages.push({ role: 'system', content: perm.reason, timestamp: Date.now() })
          continue
        }
        state.messages.push({ role: 'system', content: '$ ' + execCmd + '\n' + t('执行中...', 'Running...'), timestamp: Date.now() })
        const result = await executeCommand(execCmd, state.cwd)
        const output = (result.stdout + (result.stderr ? '\nSTDERR: ' + result.stderr : '')).slice(0, 3000)
        state.messages.push({ role: 'system', content: (output || t('(无输出)', '(no output)')) + '\n[exit: ' + result.code + ']', timestamp: Date.now() })
        continue
      }
      if (cmd === 'audit') {
        const logs = AuditLogger.readLog(20)
        if (logs.length === 0) {
          state.messages.push({ role: 'system', content: t('暂无审计日志', 'No audit logs'), timestamp: Date.now() })
        } else {
          const lines = logs.map(l => `[${l.ts}] ${l.action}(${l.level}) → ${l.result}`)
          state.messages.push({ role: 'system', content: '--- ' + t('审计日志', 'Security Audit') + ' ---\n' + lines.join('\n'), timestamp: Date.now() })
        }
        continue
      }
      if (cmd === 'capabilities' || cmd === 'caps') {
        const caps = CapabilityManager.audit()
        const report = CapabilityManager.printAudit(caps)
        state.messages.push({ role: 'system', content: report.join('\n'), timestamp: Date.now() })
        continue
      }
      if (cmd === 'constitution') {
        const info = getConstitutionInfo()
        const lines = info.map(l => `[${l.scope}] ${l.path} ${l.exists ? '✓' : '✗'}`)
        state.messages.push({
          role: 'system',
          content: `Jaicode Constitution:\n${lines.join('\n')}\n\nUse /constitution edit to modify.`,
          timestamp: Date.now(),
        })
        continue
      }

      // ─── Image Analysis ────────────────────────────
      if (cmd === 'image' || cmd.startsWith('image ')) {
        const imgPath = cmd === 'image' ? input.slice(6).trim() : input.slice(6).trim()
        if (!imgPath) {
          state.messages.push({ role: 'system', content: 'Usage: /image <file-or-path>', timestamp: Date.now() })
          continue
        }
        state.messages.push({ role: 'system', content: `🖼️ Analyzing ${imgPath}...`, timestamp: Date.now() })
        const cfg = loadConfig()
        const providerCfg = cfg.providers[cfg.defaultProvider]
        const result = await analyzeImageFile(path.resolve(state.cwd, imgPath), {
          provider: cfg.defaultProvider,
          apiKey: providerCfg.apiKey,
          model: providerCfg.model,
          baseURL: providerCfg.baseURL,
        })
        if (result.error) {
          state.messages.push({ role: 'system', content: `✗ ${result.error}`, timestamp: Date.now() })
        } else {
          state.messages.push({ role: 'system', content: `📸 ${result.description}`, timestamp: Date.now() })
        }
        continue
      }

      // ─── Web Terminal ──────────────────────────────
      if (cmd === 'web' || cmd === 'web start') {
        const result = startWebTerminal({ cwd: state.cwd })
        state.messages.push({ role: 'system', content: result.success ? `✓ Web terminal: ${result.url}` : `✗ ${result.error}`, timestamp: Date.now() })
        continue
      }
      if (cmd === 'web stop') {
        const result = stopWebTerminal()
        state.messages.push({ role: 'system', content: result.success ? '✓ Web terminal stopped' : `✗ ${result.error}`, timestamp: Date.now() })
        continue
      }

      // ─── Sub-Agents ────────────────────────────────
      if (cmd === 'agents' || cmd.startsWith('agents ')) {
        const taskDesc = cmd === 'agents' ? input.slice(7).trim() : input.slice(7).trim()
        if (!taskDesc) {
          state.messages.push({ role: 'system', content: 'Usage: /agents <description>', timestamp: Date.now() })
          continue
        }
        state.messages.push({ role: 'system', content: `🤖 Spawning sub-agent: ${taskDesc}...`, timestamp: Date.now() })
        try {
          const result = await runSubAgent(taskDesc, state.cwd, loadConfig().providers[loadConfig().defaultProvider])
          state.messages.push({ role: 'system', content: `✓ Agent result: ${result}`, timestamp: Date.now() })
        } catch (e) {
          state.messages.push({ role: 'system', content: `✗ Agent failed: ${e.message}`, timestamp: Date.now() })
        }
        continue
      }

      // ─── Daemon ───────────────────────────────────
      if (cmd === 'daemon' || cmd.startsWith('daemon ')) {
        const sub = cmd === 'daemon' ? '' : cmd.slice(7).trim()
        if (sub === 'status' || !sub) {
          const health = checkHealth()
          state.messages.push({ role: 'system', content: `Daemon: ${health.healthy ? 'running (PID ' + health.pid + ')' : 'not running'}`, timestamp: Date.now() })
        } else if (sub === 'stop') {
          const result = stopDaemon()
          state.messages.push({ role: 'system', content: result.success ? '✓ Daemon stopped' : `✗ ${result.error}`, timestamp: Date.now() })
        }
        continue
      }

      if (cmd === 'fix') {
        const target = input.slice(4).trim()
        if (!target) {
          state.messages.push({ role: 'system', content: t('用法: /fix <能力ID>，如 /fix cap-file-write', 'Usage: /fix <cap-id>, e.g. /fix cap-file-write'), timestamp: Date.now() })
          continue
        }
        const caps = CapabilityManager.audit()
        const cap = caps.find(c => c.id === target)
        if (!cap) {
          state.messages.push({ role: 'system', content: `未找到能力: ${target}`, timestamp: Date.now() })
          continue
        }
        if (cap.status === 'available') {
          state.messages.push({ role: 'system', content: `✓ ${cap.name} 已可用，无需修复`, timestamp: Date.now() })
          continue
        }
        if (!cap.solution) {
          state.messages.push({ role: 'system', content: `✗ ${cap.name} 暂无自动解决方案`, timestamp: Date.now() })
          continue
        }
        // 用户确认
        state.messages.push({
          role: 'system',
          content: `开发能力: ${cap.name}\n方案: ${cap.solution.description}\n\n确认? [y/N]`,
          timestamp: Date.now(),
        })
        continue
      }

      // ─── Git Commands ──────────────────────────────
      if (cmd === 'git' || cmd.startsWith('git ')) {
        const gitArgs = cmd === 'git' ? '' : cmd.slice(4).trim()
        if (!gitArgs || gitArgs === 'status') {
          const status = gitStatus(state.cwd)
          if (status.error) {
            state.messages.push({ role: 'system', content: `Git: ${status.error}`, timestamp: Date.now() })
          } else if (status.clean) {
            state.messages.push({ role: 'system', content: '✓ Git: Working directory clean', timestamp: Date.now() })
          } else {
            const lines = status.files.map(f => `${f.status} ${f.path}`)
            state.messages.push({ role: 'system', content: `Git status (${status.count} files):\n${lines.join('\n')}`, timestamp: Date.now() })
          }
        } else if (gitArgs === 'log') {
          const log = gitLog(state.cwd)
          state.messages.push({ role: 'system', content: `Git log:\n${log.commits?.join('\n') || log.error}`, timestamp: Date.now() })
        } else if (gitArgs === 'branch') {
          const branch = gitBranch(state.cwd)
          state.messages.push({ role: 'system', content: `Current: ${branch.current}\nAll: ${branch.branches?.join(', ') || branch.error}`, timestamp: Date.now() })
        } else if (gitArgs.startsWith('commit')) {
          const msgArgs = gitArgs.slice(6).trim()
          if (!msgArgs) {
            state.messages.push({ role: 'system', content: 'Usage: /git commit <message>', timestamp: Date.now() })
          } else {
            const result = gitCommit(state.cwd, msgArgs)
            state.messages.push({ role: 'system', content: result.success ? `✓ Committed: ${msgArgs}` : `✗ ${result.error}`, timestamp: Date.now() })
          }
        } else if (gitArgs.startsWith('branch ') && gitArgs.length > 7) {
          const branchName = gitArgs.slice(7).trim()
          const result = gitCreateBranch(state.cwd, branchName)
          state.messages.push({ role: 'system', content: result.success ? `✓ Created branch: ${branchName}` : `✗ ${result.error}`, timestamp: Date.now() })
        } else {
          state.messages.push({ role: 'system', content: 'Git commands: status, log, branch, commit <msg>, branch <name>', timestamp: Date.now() })
        }
        continue
      }

      // ─── Hooks Commands ─────────────────────────────
      if (cmd === 'hooks' || cmd.startsWith('hooks ')) {
        const hookArgs = cmd === 'hooks' ? '' : cmd.slice(6).trim()
        if (!hookArgs) {
          const hooks = loadHooks()
          const lines = []
          for (const [event, cmds] of Object.entries(hooks)) {
            if (cmds.length > 0) lines.push(`${event}: ${cmds.join(', ')}`)
          }
          state.messages.push({ role: 'system', content: lines.length > 0 ? `Hooks:\n${lines.join('\n')}` : 'No hooks configured.', timestamp: Date.now() })
        } else if (hookArgs.startsWith('add ')) {
          // hooks add post-edit "prettier --write"
          const match = hookArgs.slice(4).match(/^(\w+)\s+"(.+)"$/)
          if (match) {
            addHook(match[1], match[2])
            state.messages.push({ role: 'system', content: `✓ Hook added: ${match[1]} → ${match[2]}`, timestamp: Date.now() })
          } else {
            state.messages.push({ role: 'system', content: 'Usage: /hooks add <event> "<command>"', timestamp: Date.now() })
          }
        } else if (hookArgs === 'test') {
          const results = executeHooks('session-start', state.cwd, { mode: state.mode })
          state.messages.push({ role: 'system', content: `Hooks executed: ${results.length}`, timestamp: Date.now() })
        }
        continue
      }

      // ─── MCP Commands ───────────────────────────────
      if (cmd === 'mcp' || cmd.startsWith('mcp ')) {
        const mcpArgs = cmd === 'mcp' ? '' : cmd.slice(4).trim()
        if (!mcpArgs) {
          const servers = loadMCPServers()
          if (servers.length === 0) {
            state.messages.push({ role: 'system', content: 'No MCP servers configured. Use: /mcp add <name> <command>', timestamp: Date.now() })
          } else {
            state.messages.push({ role: 'system', content: `MCP servers: ${servers.map(s => `${s.name} (${s.command})`).join(', ')}`, timestamp: Date.now() })
          }
        } else if (mcpArgs.startsWith('add ')) {
          const parts = mcpArgs.slice(4).split(' ')
          if (parts.length >= 2) {
            const name = parts[0]
            const command = parts.slice(1).join(' ')
            saveMCPServer(name, { command })
            state.messages.push({ role: 'system', content: `✓ MCP server added: ${name}`, timestamp: Date.now() })
          }
        } else if (mcpArgs.startsWith('connect ')) {
          const name = mcpArgs.slice(8).trim()
          const servers = loadMCPServers()
          const server = servers.find(s => s.name === name)
          if (server) {
            const client = new MCPClient(server)
            try {
              const result = await client.connect()
              state.messages.push({ role: 'system', content: `✓ Connected to ${name}: ${result.tools?.length || 0} tools available`, timestamp: Date.now() })
            } catch (e) {
              state.messages.push({ role: 'system', content: `✗ Connection failed: ${e.message}`, timestamp: Date.now() })
            }
          } else {
            state.messages.push({ role: 'system', content: `Server not found: ${name}`, timestamp: Date.now() })
          }
        }
        continue
      }

      // ─── Update Command ─────────────────────────────
      if (cmd === 'update') {
        state.messages.push({ role: 'system', content: 'Checking for updates...', timestamp: Date.now() })
        const update = await checkForUpdate()
        if (update.hasUpdate) {
          state.messages.push({
            role: 'system',
            content: `Update available: ${update.currentVersion} → ${update.latestVersion}\nRun /update apply`,
            timestamp: Date.now(),
          })
        } else {
          state.messages.push({ role: 'system', content: `✓ Up to date (v${update.currentVersion})`, timestamp: Date.now() })
        }
        continue
      }
      if (cmd === 'update apply') {
        const result = await selfUpgrade()
        state.messages.push({ role: 'system', content: result.success ? '✓ Updated. Please restart.' : `✗ ${result.error}`, timestamp: Date.now() })
        continue
      }

      // ─── Session Restore ────────────────────────────
      if (cmd === 'sessions') {
        const sessions = listSessions()
        if (sessions.length === 0) {
          state.messages.push({ role: 'system', content: 'No previous sessions found.', timestamp: Date.now() })
        } else {
          const lines = sessions.map(s => `[${s.pid}] ${s.cwd} (${s.messages?.length || 0} msgs) ${s.active ? '●' : '○'}`)
          state.messages.push({ role: 'system', content: `Sessions:\n${lines.join('\n')}`, timestamp: Date.now() })
        }
        continue
      }
    }

    // ─── File Path Detection ────────────────────────────
    const detectedPaths = detectFilePaths(input)
    for (const filePath of detectedPaths) {
      const fileResult = handleFile(filePath, state.cwd)
      if (fileResult.error) {
        state.messages.push({ role: 'system', content: `⚠️ ${filePath}: ${fileResult.error}`, timestamp: Date.now() })
      } else if (fileResult.type === 'text') {
        state.messages.push({
          role: 'system',
          content: `📄 ${filePath} (${fileResult.language}, ${fileResult.lines} lines)${fileResult.truncated ? ' [truncated]' : ''}:\n\`\`\`${fileResult.language}\n${fileResult.content}\n\`\`\``,
          timestamp: Date.now(),
        })
      } else if (fileResult.type === 'image') {
        state.messages.push({
          role: 'system',
          content: `🖼️ ${filePath} detected (${(fileResult.size / 1024).toFixed(1)}KB). Image analysis requires VL provider.`,
          timestamp: Date.now(),
        })
      } else if (fileResult.type === 'rejected') {
        state.messages.push({
          role: 'system',
          content: `⛔ ${filePath}: ${fileResult.reason}`,
          timestamp: Date.now(),
        })
      } else if (fileResult.type === 'archive') {
        state.messages.push({
          role: 'system',
          content: `📦 ${filePath}: ${fileResult.description}`,
          timestamp: Date.now(),
        })
      }
      continue
    }

    // ─── Clipboard Image Detection ──────────────────────
    if (input.toLowerCase() === '/paste' || input.toLowerCase() === '/clip') {
      const imgPath = readClipboardImage()
      if (imgPath) {
        const fileResult = handleFile(imgPath, state.cwd)
        if (fileResult.type === 'image') {
          state.messages.push({
            role: 'system',
            content: `🖼️ Clipboard image detected (${(fileResult.size / 1024).toFixed(1)}KB). Sending to VL analysis...`,
            timestamp: Date.now(),
          })
          // TODO: Send to VL provider when available
        }
      } else {
        state.messages.push({
          role: 'system',
          content: t('剪贴板中未检测到图片', 'No image found in clipboard'),
          timestamp: Date.now(),
        })
      }
      continue
    }

    // Save input to history
    saveToHistory(input)

    // ─── P0-1: File write confirmation ──────────
    if (state.pendingFile) {
      if (input.trim().toLowerCase() === 'y' || input.trim().toLowerCase() === 'yes') {
        const result = writeFile(state.cwd, state.pendingFile.path, state.pendingFile.content)
        if (result.success) {
          state.messages.push({
            role: 'system',
            content: `✓ Written: ${result.path} (${result.size} bytes)`,
            timestamp: Date.now(),
          })
        } else {
          state.messages.push({
            role: 'system',
            content: `✗ Write failed: ${result.error}`,
            timestamp: Date.now(),
          })
        }
      } else {
        state.messages.push({
          role: 'system',
          content: 'Write cancelled.',
          timestamp: Date.now(),
        })
      }
      state.pendingFile = null
      continue
    }

    // Process natural language input
    await processMessage(input)
    clearScreen()
    renderStartup()
  }

  showCursor()
  clearScreen()
  stdout.write(`\n  ${c.green(t('再见！', 'Bye!'))}\n\n`)
}

main().catch(e => {
  showCursor()
  console.error(c.red('Fatal:'), e.message)
  process.exit(1)
})
