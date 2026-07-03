#!/usr/bin/env node
/**
 * Jaicode TUI - Node.js Native Terminal UI
 * Compatible with Apple M5 / macOS 26 / Node.js 20+
 * No Bun required.
 */

import readline from 'node:readline'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import chalk from 'chalk'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Config ───────────────────────────────────────────────────────
const VERSION = '0.1.0'
const BG = chalk.bgHex('#0a0f1a')
const DIM = chalk.hex('#8b949e')
const PRIMARY = chalk.hex('#00B8D9')
const ACCENT = chalk.hex('#00E5C9')
const SUCCESS = chalk.hex('#39d353')
const WARN = chalk.hex('#ffbd2e')
const ERR = chalk.hex('#ff5f56')
const BOLD = chalk.bold

// ─── State ────────────────────────────────────────────────────────
const state = {
  screen: 'welcome',
  mode: 'code',
  provider: '',
  model: '',
  lang: detectLang(),
  messages: [],
  isStreaming: false,
}

// ─── Helpers ──────────────────────────────────────────────────────
function detectLang() {
  const envLang = process.env.LANG || process.env.LC_ALL || ''
  return envLang.startsWith('zh') ? 'zh' : 'en'
}

function t(zh, en) {
  return state.lang === 'zh' ? zh : en
}

// ─── Rendering ────────────────────────────────────────────────────
function clearScreen() {
  stdout.write('\x1B[2J\x1B[0f')
}

function hideCursor() {
  stdout.write('\x1B[?25l')
}

function showCursor() {
  stdout.write('\x1B[?25h')
}

function renderHeader() {
  const title = BOLD.hex('#00B8D9')('⬡ Jaicode')
  const ver = DIM(` v${VERSION}`)
  const mode = state.screen === 'chat'
    ? `  ${PRIMARY(`▸ ${state.mode.toUpperCase()}`)}`
    : ''
  stdout.write(`${title}${ver}${mode}\n`)
  stdout.write(DIM('─'.repeat(Math.min(process.stdout.columns || 60, 60))) + '\n')
}

function renderWelcomeScreen() {
  clearScreen()
  stdout.write('\n')

  // ASCII Logo
  const logo = [
    '\x1B[38;2;0;184;217m   ██╗ █████╗ ██╗ ██████╗ ██████╗ ██████╗ ███████╗',
    '   ██║██╔══██╗██║██╔════╝██╔══██╗██╔══██╗██╔════╝',
    '   ██║███████║██║██║     ██║  ██║██║  ██║█████╗  ',
    '   ██║██╔══██║██║██║     ██║  ██║██║  ██║██╔══╝  ',
    '   ██║██║  ██║██║╚██████╗██████╔╝██████╔╝███████╗',
    '   ╚═╝╚═╝  ╚═╝╚═╝ ╚═════╝╚═════╝ ╚═════╝ ╚══════╝\x1B[0m',
  ]
  logo.forEach(line => stdout.write('  ' + line + '\n'))

  stdout.write(`\n  ${DIM(t('本地优先 AI 编程助手', 'Local-first AI Coding Agent'))}\n`)
  stdout.write(`  ${DIM('─'.repeat(40))}\n\n`)

  // Mode selection
  const modes = [
    { key: '1', name: t('架构', 'Plan'), desc: 'Architect', icon: '◈' },
    { key: '2', name: t('代码', 'Code'), desc: 'Modify', icon: '⌘' },
    { key: '3', name: t('调试', 'Debug'), desc: 'Fix', icon: '⚡' },
    { key: '4', name: t('问答', 'Ask'), desc: 'Q&A', icon: '?' },
  ]

  modes.forEach(m => {
    const isActive = ['plan', 'code', 'debug', 'ask'][parseInt(m.key) - 1] === state.mode
    const color = isActive ? PRIMARY : DIM
    const marker = isActive ? '▸' : '·'
    const line = `    ${marker} [${m.key}] ${color(m.icon + ' ' + m.name.padEnd(6))} ${DIM(m.desc)}`
    stdout.write(line + '\n')
  })

  stdout.write(`\n  ${DIM('─'.repeat(40))}\n`)
  stdout.write(`  ${SUCCESS(t('Enter 开始 · 1-4 选择模式 · Q 退出', 'Enter start · 1-4 mode · Q quit'))}\n`)
}

// ─── Interactive Chat Screen ──────────────────────────────────────
async function renderChatScreen() {
  clearScreen()
  renderHeader()
  stdout.write('\n')

  if (state.messages.length === 0) {
    const hint = t(
      '  ↑ 输入任务描述开始 · Ctrl+M 切换模式 · Ctrl+C 退出\n  示例: ',
      '  ↑ Type a task to begin · Ctrl+M switch mode · Ctrl+C exit\n   Example: '
    )
    stdout.write(DIM(hint) + ACCENT(
      state.mode === 'code' ? '"修复登录接口空指针异常"' :
      state.mode === 'debug' ? '"npm test"' :
      state.mode === 'plan' ? '"设计用户认证模块"' :
      '"这段代码做了什么？"'
    ) + '\n\n')
  } else {
    state.messages.forEach(msg => {
      const prefix = msg.role === 'user'
        ? `${PRIMARY('❯')} ${BOLD(t('你', 'You'))}`
        : `${ACCENT('⬡')} ${BOLD('Jaicode')}`
      const time = DIM(new Date(msg.timestamp).toLocaleTimeString())
      stdout.write(`  ${prefix} ${time}\n`)

      const lines = msg.content.split('\n')
      lines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          stdout.write('  ' + SUCCESS(line) + '\n')
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          stdout.write('  ' + ERR(line) + '\n')
        } else {
          stdout.write('  ' + line + '\n')
        }
      })
      stdout.write('\n')
    })
  }

  // Status bar
  const statusBar = state.isStreaming
    ? `  ${SUCCESS('●')} ${PRIMARY(state.mode.toUpperCase())} ${DIM('|')} ${WARN('⣿ streaming...')}`
    : `  ${SUCCESS('●')} ${PRIMARY(state.mode.toUpperCase())} ${DIM('|')} ${DIM(state.lang === 'zh' ? '中英' : 'EN')} ${DIM('|')} ${DIM('Ctrl+C 退出')}`
  stdout.write('\n' + statusBar + '\n')
}

// ─── LLM API Call ─────────────────────────────────────────────────
async function callLLM(messages, provider, model) {
  const cfg = loadConfig()
  const providerCfg = cfg.providers?.[cfg.defaultProvider]
  if (!providerCfg?.apiKey) {
    return t('❌ 未配置 API Key，请运行：jaicode config --provider anthropic --api-key sk-xxx',
             '❌ No API Key configured. Run: jaicode config --provider anthropic --api-key sk-xxx')
  }

  const apiKey = providerCfg.apiKey
  const modelName = providerCfg.model || 'claude-sonnet-4-20250514'

  const body = {
    model: modelName,
    max_tokens: 4096,
    messages: messages.map(m => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    })),
    stream: true,
  }

  if (messages[0]?.role === 'system') {
    body.system = messages[0].content
    body.messages = body.messages.slice(1)
  }

  const controller = new AbortController()

  if (cfg.defaultProvider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!resp.ok) return `❌ OpenAI API error: ${resp.status}`
    return resp.body
  }

  // Anthropic (default)
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  if (!resp.ok) return `❌ Anthropic API error: ${resp.status}`
  return resp.body
}

function loadConfig() {
  const configPath = path.join(os.homedir(), '.jaicode', 'config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return { providers: {}, defaultProvider: 'anthropic' }
  }
}

// ─── Readline Input ───────────────────────────────────────────────
async function getInput(prompt) {
  return new Promise(resolve => {
    const rl = createInterface({ input: stdin, output: stdout })
    stdout.write(prompt)
    rl.on('line', line => {
      rl.close()
      resolve(line)
    })
  })
}

// ─── Cleanup ──────────────────────────────────────────────────────
function cleanup() {
  try { stdin.setRawMode(false); stdin.pause() } catch { /* not a TTY */ }
  showCursor()
}

// ─── Welcome Raw Mode ─────────────────────────────────────────────
let resolveWelcome

function onWelcomeKey(key) {
  if (key === '\u0003') { cleanup(); process.exit(0) }
  if (key === '\r' || key === '\n') { resolveWelcome(); return }
  if (key === 'q' || key === 'Q') { cleanup(); process.exit(0) }
  if (key >= '1' && key <= '4') {
    const modes = ['plan', 'code', 'debug', 'ask']
    state.mode = modes[parseInt(key) - 1]
    renderWelcomeScreen()
  }
}

function rawModeWelcome() {
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')
  return new Promise(resolve => {
    resolveWelcome = () => {
      stdin.setRawMode(false)
      stdin.pause()
      state.screen = 'chat'
      runChatLoop()
    }
    stdin.on('data', onWelcomeKey)
  })
}

// ─── Fallback Non-TTY Welcome ─────────────────────────────────────
async function fallbackWelcome() {
  renderWelcomeScreen()
  stdout.write(`\n  ${DIM(t('输入数字 (1-4) 选择模式后回车', 'Enter mode number (1-4) then Enter'))}: `)
  const input = await getInput('')
  const num = parseInt(input)
  if (num >= 1 && num <= 4) {
    state.mode = ['plan', 'code', 'debug', 'ask'][num - 1]
  }
  state.screen = 'chat'
  await runChatLoop()
}

// ─── Main Loop ────────────────────────────────────────────────────
async function main() {
  renderWelcomeScreen()

  // Check if stdin is an interactive TTY
  if (stdin.isTTY) {
    await rawModeWelcome()
  } else {
    await fallbackWelcome()
  }
}

async function runChatLoop() {
  hideCursor()

  while (true) {
    await renderChatScreen()

    const userInput = await getInput(PRIMARY('❯ '))

    if (!userInput.trim()) continue

    // Handle commands
    if (userInput.startsWith('/')) {
      if (userInput === '/quit' || userInput === '/exit') break
      if (userInput === '/mode') {
        const modes = ['plan', 'code', 'debug', 'ask']
        const idx = modes.indexOf(state.mode)
        state.mode = modes[(idx + 1) % modes.length]
        state.messages.push({
          role: 'system',
          content: t(`已切换到 ${state.mode.toUpperCase()} 模式`, `Switched to ${state.mode.toUpperCase()} mode`),
          timestamp: Date.now(),
        })
        continue
      }
      if (userInput === '/help') {
        state.messages.push({
          role: 'system',
          content: t(
            '命令: /quit 退出 · /mode 切换模式 · /help 帮助',
            'Commands: /quit exit · /mode switch mode · /help'
          ),
          timestamp: Date.now(),
        })
        continue
      }
    }

    // Add user message
    state.messages.push({ role: 'user', content: userInput, timestamp: Date.now() })

    // Call LLM
    state.isStreaming = true
    await renderChatScreen()

    const modePrompts = {
      plan: 'You are an architecture design assistant. Generate Architecture Decision Records (ADR).',
      code: 'You are a coding assistant. Output changed files in FILE: format with complete code.',
      debug: 'You are a debugging assistant. Analyze errors and provide fixes.',
      ask: 'You are a Q&A assistant. Answer concisely and accurately.',
    }
    const langNote = state.lang === 'zh' ? 'Reply in Chinese.' : 'Reply in English.'

    const messages = [
      { role: 'system', content: `${modePrompts[state.mode]} ${langNote}` },
      ...state.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      const result = await callLLM(messages, state.provider, state.model)

      if (typeof result === 'string') {
        // Plain text (likely error)
        state.messages.push({ role: 'assistant', content: result, timestamp: Date.now() })
      } else {
        // Read stream
        let response = ''
        const reader = result.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            // Anthropic format: event: content_block_delta / data: {...}
            // OpenAI format: data: {...}
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue
              try {
                const json = JSON.parse(data)
                // OpenAI
                let content = json.choices?.[0]?.delta?.content
                // Anthropic
                if (!content && json.type === 'content_block_delta') {
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

        state.messages.push({ role: 'assistant', content: response, timestamp: Date.now() })
      }
    } catch (e) {
      state.messages.push({
        role: 'assistant',
        content: `❌ ${e.message}`,
        timestamp: Date.now(),
      })
    }

    state.isStreaming = false
  }

  showCursor()
  clearScreen()
  stdout.write(`\n  ${SUCCESS(t('再见！', 'Bye!'))}\n\n`)
}
      if (userInput === '/help') {
        state.messages.push({
          role: 'system',
          content: t(
            '命令: /quit 退出 · /mode 切换模式 · /help 帮助',
            'Commands: /quit exit · /mode switch mode · /help'
          ),
          timestamp: Date.now(),
        })
        continue
      }
    }

    // Add user message
    state.messages.push({ role: 'user', content: userInput, timestamp: Date.now() })

    // Call LLM
    state.isStreaming = true
    await renderChatScreen()

    const modePrompts = {
      plan: 'You are an architecture design assistant. Generate Architecture Decision Records (ADR).',
      code: 'You are a coding assistant. Output changed files in FILE: format with complete code.',
      debug: 'You are a debugging assistant. Analyze errors and provide fixes.',
      ask: 'You are a Q&A assistant. Answer concisely and accurately.',
    }
    const langNote = state.lang === 'zh' ? 'Reply in Chinese.' : 'Reply in English.'

    const messages = [
      { role: 'system', content: `${modePrompts[state.mode]} ${langNote}` },
      ...state.messages.filter(m => !m.isStreaming).map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      const result = await callLLM(messages, state.provider, state.model)

      if (typeof result === 'string') {
        // Plain text (likely error)
        state.messages.push({ role: 'assistant', content: result, timestamp: Date.now() })
      } else {
        // Read stream
        let response = ''
        const reader = result.getReader()
        const decoder = new TextDecoder()

        if (state.provider === 'openai' || result.constructor.name === 'ReadableStream') {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value)
            const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]')

            for (const line of lines) {
              try {
                const json = JSON.parse(line.slice(6))
                const content = json.choices?.[0]?.delta?.content ||
                               json.content_block?.text ||
                               json.delta?.text || ''
                if (content) {
                  response += content
                  process.stdout.write(content)
                }
              } catch { /* skip */ }
            }
          }
        }

        state.messages.push({ role: 'assistant', content: response, timestamp: Date.now() })
      }
    } catch (e) {
      state.messages.push({
        role: 'assistant',
        content: `❌ ${e.message}`,
        timestamp: Date.now(),
      })
    }

    state.isStreaming = false
  }

  showCursor()
  clearScreen()
  stdout.write(`\n  ${SUCCESS(t('再见！', 'Bye!'))}\n\n`)
}

// ─── Entry ────────────────────────────────────────────────────────
main().catch(e => {
  showCursor()
  console.error(ERR('Fatal:'), e.message)
  process.exit(1)
})
