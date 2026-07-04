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
import { JaiMascot } from './mascot.js'
import { Analytics } from './analytics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Version ───────────────────────────────────────────
const VERSION = '0.3.0'

// ─── Mascot ────────────────────────────────────────────
const jai = new JaiMascot()

// ─── Analytics ─────────────────────────────────────────
const analytics = new Analytics()

// ─── Theme ─────────────────────────────────────────────
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
const state = {
  cwd: process.cwd(),
  mode: 'auto',
  provider: '',
  model: '',
  lang: detectLang(),
  messages: [],
  isStreaming: false,
  isProcessing: false,
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
  catch { return { providers: {}, defaultProvider: 'anthropic' } }
}

function saveAPIKey(key) {
  const dir = path.join(os.homedir(), '.jaicode')
  fs.mkdirSync(dir, { recursive: true })
  const configPath = path.join(dir, 'config.json')
  let cfg = {}
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch {}
  if (!cfg.providers) cfg.providers = {}
  cfg.providers.anthropic = { model: 'claude-sonnet-4-20250514', apiKey: key, enabled: true }
  cfg.defaultProvider = 'anthropic'
  if (!cfg.agent) cfg.agent = { maxRetries: 5 }
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

function classifyIntent(input) {
  const lower = input.toLowerCase()
  // 检测执行意图
  if (/^(执行|运行|run|exec|部署|deploy|安装|install|启动|start|构建|build|测试|test)/.test(lower)) return 'code'
  if (/^(解释|explain|what|how|为什么|why|描述|describe|是什么)/.test(lower)) return 'ask'
  if (/^(修复|fix|debug|bug|报错|错误|not work|broken|test failed)/.test(lower)) return 'debug'
  if (/^(设计|design|架构|architecture|方案|plan for|规划)/.test(lower)) return 'plan'
  if (/^(批量|batch|所有|all files|refactor all)/.test(lower)) return 'plan'
  return 'code'
}

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

  // Jai pixel dinosaur + wordmark side by side
  const mascotLines = jai.render(false)
  const cyan = chalk.hex('#00B8D9')
  const orange = chalk.hex('#FF8C00')

  // Build the wordmark block
  const logoBlock = [
    orange.bold('  ╔══════════════════╗'),
    orange.bold('  ║  ██  █████ ██    ║'),
    orange.bold('  ║  ██  ██    ██ ██ ║'),
    orange.bold('  ║  ██  █████ ██   ║'),
    orange.bold('  ║██ ██  ██    ██  ║'),
    orange.bold('  ║ ████  █████ ██  ║'),
    orange.bold('  ╚══════════════════╝'),
    cyan(`  v${VERSION}`),
    c.dim('  Local-first AI Agent'),
  ]

  // Strip ANSI codes to measure visible length
  const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[mK]/g, '')

  // Render mascot + logo side by side
  const maxLines = Math.max(mascotLines.length, logoBlock.length)
  const padLen = 32 // Fixed visible width for mascot column
  for (let i = 0; i < maxLines; i++) {
    const mLine = (mascotLines[i] || '')
    const lLine = logoBlock[i] || ''
    // Colorize the dinosaur AFTER measuring width
    const coloredMascot = mLine
      .replace(/▓/g, orange('▓'))
      .replace(/[◉★✦]/g, cyan('◉'))
      .replace(/[◎◯○]/g, chalk.yellow('○'))
    // Pad based on visible (uncolored) length
    const visLen = stripAnsi(mLine).length
    const pad = ' '.repeat(Math.max(0, padLen - visLen))
    stdout.write(`  ${coloredMascot}${pad} ${lLine}\n`)
  }

  stdout.write('\n')
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
  const mascotLine = smallMascot[0] || ''
  const orange = chalk.hex('#8B5E3C')
  const coloredMascot = mascotLine.replace(/▓/g, orange('▓')).replace(/[◉★✦]/g, chalk.cyan('◉'))

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

  // Add user message
  state.messages.push({
    role: 'user',
    content: userInput,
    timestamp: Date.now(),
  })

  // Auto-classify intent
  const intent = state.mode === 'auto' ? classifyIntent(userInput) : state.mode
  thinking.push(`[${t('意图识别', 'Intent')}] ${intent.toUpperCase()}`)

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
      plan: `你是 Jaicode 架构设计专家。
重要：你具备直接操作终端的能力。你可以：
- 读取项目文件了解现状
- 分析技术选型并给出 ADR
- 建议具体可执行的命令
不要说"我无法执行"，直接给出操作步骤和命令。`,
      code: `你是 Jaicode 编程助手。具备完整的终端命令执行能力。
当用户提出编码需求时，直接给出可以执行的具体命令和代码变更。
你可以：读文件、写文件、修改代码、执行 shell 命令、安装依赖、运行测试。
输出格式：先给出说明，然后给出准确命令和 diff。
绝对不要说"我无法执行"——你就是执行者。`,
      debug: `你是 Jaicode 调试助手。具备完整的终端命令执行能力。
当用户报告错误时，直接执行排查和修复：
- 分析错误原因
- 给出修复方案（diff 格式）
- 提供验证命令
绝对不要说"我无法执行命令"。`,
      ask: `你是 Jaicode 问答助手。简洁、准确地回答技术问题。
如果问题需要通过命令排查，直接给出可以执行的命令。`,
    }
    const langNote = state.lang === 'zh' ? '用中文回复。' : 'Reply in English.'

    const messages = [
      { role: 'system', content: `${modePrompts[intent] || modePrompts.code} ${langNote}\nProject: ${detectProject().name}` },
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
        // Move cursor up and redraw thinking area to show live updates
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

      if (!response || response.trim().length === 0) {
        thinking.push(`[${t('响应为空', 'Empty')}] ${t('对方返回空内容', 'Empty response received')}`)
        state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
        analytics.recordRequest(state.model || 'unknown', 0, 0, Date.now() - startTime, true)
        state.messages.push({ role: 'assistant', content: `⚠️ ${t('模型返回空内容，请检查 API Key 或模型名称', 'Model empty. Check API key or model.')}`, timestamp: Date.now(), processingTime: Date.now() - startTime })
      } else {
        thinking.push(`[${t('完成', 'Done')}] ${t('响应长度', 'Response')}: ${response.length} chars`)
        state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
        // Record analytics: estimate tokens (rough: chars/4 input for prompt, chars/3 for output)
        const promptTokens = Math.ceil(userInput.length / 4)
        const outputTokens = Math.ceil(response.length / 3)
        analytics.recordRequest(state.model || 'unknown', promptTokens, outputTokens, Date.now() - startTime, false)
        state.messages.push({ role: 'assistant', content: response, timestamp: Date.now(), processingTime: Date.now() - startTime })
      }
    }
  } catch (e) {
    thinking.push(`[${t('异常', 'Exception')}] ${e.message}`)
    state.messages[thinkingIdx] = { ...state.messages[thinkingIdx], content: thinking.join('\n') }
    state.messages.push({ role: 'assistant', content: `❌ ${e.message}`, timestamp: Date.now(), processingTime: Date.now() - startTime })
  }

  state.isProcessing = false
}

async function main() {
  // Check API key if not configured
  const cfg = loadConfig()
  const hasAnyKey = Object.values(cfg.providers || {}).some(p => p.apiKey) ||
                     process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY

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
            '命令: /quit 退出 · /clear 清屏 · /mode 切换模式 · /stats 用量统计 · /config 配置\n模式: 自然语言输入自动识别意图（修复=debug, 解释=ask, 设计=plan, 其他=code）',
            'Commands: /quit exit · /clear clear · /mode switch mode · /stats usage · /config'
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

      state.messages.push({
        role: 'system',
        content: t(`未知命令: /${cmd}（输入 /help 查看帮助）`, `Unknown command: /${cmd} (type /help for help)`),
        timestamp: Date.now(),
      })
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
