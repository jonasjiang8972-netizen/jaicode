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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  if (/^(解释|explain|what|how|为什么|why|描述|describe)/.test(lower)) return 'ask'
  if (/^(修复|fix|debug|bug|报错|错误|not work|broken|test failed)/.test(lower)) return 'debug'
  if (/^(设计|design|架构|architecture|方案|plan for|规划)/.test(lower)) return 'plan'
  if (/^(批量|batch|所有|all files|refactor all)/.test(lower)) return 'plan'
  return 'code'
}

// ─── Rendering ─────────────────────────────────────────
function renderStartup() {
  clearScreen()
  stdout.write('\n')

  // Compact logo
  stdout.write(c.primary.bold('   ⬡ Jaicode') + c.dim(' v0.1.0 — Local-first AI Coding Agent\n'))
  stdout.write(c.dim('   ' + '─'.repeat(50) + '\n\n'))

  // Project context
  const proj = detectProject()
  stdout.write(c.dim('   Project: ') + c.accent(proj.name) + c.dim(` (${proj.type})\n`))
  stdout.write(c.dim('   Path:    ') + c.dim(state.cwd) + '\n')

  // Provider status
  const cfg = loadConfig()
  const providerCfg = cfg.providers?.[cfg.defaultProvider]
  if (providerCfg?.apiKey) {
    state.provider = cfg.defaultProvider
    state.model = providerCfg.model || 'claude-sonnet-4-20250514'
    stdout.write(c.dim('   Provider: ') + c.green(`✓ ${cfg.defaultProvider}`) +
                c.dim(` (${state.model})`) + '\n')
  } else {
    stdout.write(c.dim('   Provider: ') + c.red('✗ Not configured') + '\n')
    stdout.write(c.yellow('\n   ⚠ No API Key found. You can add it via:\n'))
    stdout.write(c.dim('     jaicode config --provider anthropic --api-key sk-xxx\n'))
    stdout.write(c.dim('     Or set ANTHROPIC_API_KEY environment variable.\n'))
  }

  stdout.write(c.dim('\n   ' + '─'.repeat(50) + '\n'))
  stdout.write(c.dim(`   ${t('输入任务描述直接开始 · Ctrl+C 退出 · /help 命令列表', 'Type a task to begin · Ctrl+C exit · /help commands')}\n\n`))
}

function renderMessages() {
  if (state.messages.length === 0) {
    stdout.write(c.dim(`   ${t('💬 开始对话吧！例如:', '💬 Start a conversation:')}\n`))
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
  const col = Math.min(process.stdout.columns || 60, 60)
  const mode = state.mode === 'auto' ? t('自动', 'Auto') : state.mode.toUpperCase()
  const provider = state.provider || t('未设置', 'None')
  const statusColor = state.isProcessing ? c.yellow : c.green
  const statusIcon = state.isProcessing ? '◐' : '●'

  const left = `  ${statusIcon} ${mode} | ${provider}`
  const right = `Ctrl+C ${t('退出', 'exit')} | ${state.lang === 'zh' ? '中' : 'EN'}`
  const padding = ' '.repeat(Math.max(0, col - left.length - right.length - 4))

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

// ─── LLM API ───────────────────────────────────────────
async function callLLM(messages) {
  const cfg = loadConfig()
  const providerCfg = cfg.providers?.[cfg.defaultProvider]
  if (!providerCfg?.apiKey) {
    return { error: t('未配置 API Key', 'No API Key configured') }
  }

  const apiKey = providerCfg.apiKey
  const model = providerCfg.model || 'claude-sonnet-4-20250514'

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
当前项目: ${detectProject().name}
项目路径: ${state.cwd}`

  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    system: systemPrompt,
    messages: messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
  }

  const isAnthropic = cfg.defaultProvider !== 'openai'
  const url = isAnthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions'

  const headers = { 'Content-Type': 'application/json' }
  if (isAnthropic) {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
    delete body.system
    body.messages = [
      { role: 'user', content: systemPrompt },
      ...body.messages
    ]
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return { error: `API ${cfg.defaultProvider} error: ${resp.status}` }
  }

  return { stream: resp.body }
}

async function streamResponse(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let response = ''

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
          if (json.choices) {
            content = json.choices[0]?.delta?.content
          } else if (json.type === 'content_block_delta') {
            content = json.delta?.text
          }
          if (content) {
            response += content
            process.stdout.write(content)
          }
        } catch { /* skip */ }
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

  // Add user message
  state.messages.push({
    role: 'user',
    content: userInput,
    timestamp: Date.now(),
  })

  // Auto-classify intent
  const intent = state.mode === 'auto' ? classifyIntent(userInput) : state.mode

  // Show processing
  state.isProcessing = true
  const spinner = renderSpinner(c.dim(
    intent === 'ask' ? t('思考中...', 'Thinking...') :
    intent === 'plan' ? t('设计方案中...', 'Designing...') :
    intent === 'debug' ? t('分析问题中...', 'Analyzing...') :
    t('处理中...', 'Processing...')
  ))

  try {
    const result = await callLLM(state.messages)
    clearInterval(spinner)
    stdout.write('\r  ' + ' '.repeat(50) + '\r')

    if (result.error) {
      state.messages.push({
        role: 'assistant',
        content: `❌ ${result.error}`,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
      })
    } else if (result.stream) {
      stdout.write(`${c.accent('⬡')} ${c.bold('Jaicode')} ${c.dim(new Date().toLocaleTimeString())}\n  `)
      const response = await streamResponse(result.stream)
      state.messages.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
      })
    }
  } catch (e) {
    clearInterval(spinner)
    stdout.write('\r  ' + ' '.repeat(50) + '\r')
    state.messages.push({
      role: 'assistant',
      content: `❌ ${e.message}`,
      timestamp: Date.now(),
      processingTime: Date.now() - startTime,
    })
  }

  state.isProcessing = false
}

async function main() {
  // Check API key if not configured
  const cfg = loadConfig()
  if (!cfg.providers?.anthropic?.apiKey && !process.env.ANTHROPIC_API_KEY) {
    clearScreen()
    stdout.write(c.yellow.bold('\n  ⚠ No API Key configured\n\n'))
    stdout.write(c.dim('  请选择你的 LLM Provider:\n\n'))

    const providers = [
      { key: '1', name: 'Anthropic (Claude)', prefix: 'sk-ant-', url: 'https://console.anthropic.com/settings/keys', model: 'claude-sonnet-4-20250514' },
      { key: '2', name: 'OpenAI (GPT-4o)', prefix: 'sk-', url: 'https://platform.openai.com/api-keys', model: 'gpt-4o' },
      { key: '3', name: 'DeepSeek', prefix: 'sk-', url: 'https://platform.deepseek.com/api_keys', model: 'deepseek-chat' },
      { key: '4', name: '其他兼容 API', prefix: '', url: '', model: 'claude-sonnet-4-20250514' },
    ]

    providers.forEach(p => {
      stdout.write(c.dim(`    [${p.key}] ${p.name}\n`))
    })

    stdout.write('\n')
    const choice = await getInput(c.primary('  选择 (1-4): '))
    const selected = providers.find(p => p.key === choice) || providers[0]

    if (selected.url) {
      stdout.write(c.dim(`\n  获取 API Key: ${selected.url}\n`))
    }

    const key = await getInput(c.primary(`\n  输入 ${selected.name} API Key: `))

    if (!key || key.length < 10) {
      stdout.write(c.red('  ✗ 无效的 Key\n\n'))
      process.exit(1)
    }

    if (selected.key === '2' || selected.key === '3') {
      // OpenAI / DeepSeek
      const cfg2 = loadConfig()
      cfg2.providers[selected.key === '2' ? 'openai' : selected.key === '3' ? 'deepseek' : 'openai'] = {
        model: selected.model,
        apiKey: key,
        enabled: true,
      }
      cfg2.defaultProvider = selected.key === '2' ? 'openai' : 'deepseek'
      const dir = path.join(os.homedir(), '.jaicode')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg2, null, 2))
      stdout.write(c.green(`\n  ✓ ${selected.name} API Key 已保存\n\n`))
    } else {
      // Anthropic or other (treat as Anthropic-compatible)
      saveAPIKey(key)
      stdout.write(c.green(`\n  ✓ ${selected.name} API Key 已保存\n\n`))
    }

    // Small delay then reload config
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
            '命令: /quit 退出 · /clear 清屏 · /mode 切换模式 · /config 配置\n模式: 自然语言输入自动识别意图（修复=debug, 解释=ask, 设计=plan, 其他=code）',
            'Commands: /quit exit · /clear clear · /mode switch mode · /config\nModes: Natural language input auto-classifies intent'
          ),
          timestamp: Date.now(),
        })
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
