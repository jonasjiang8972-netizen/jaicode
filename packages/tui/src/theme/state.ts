import { theme } from "../theme/colors"

export interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: number
  mode?: string
  isStreaming?: boolean
}

export interface DiffBlock {
  path: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffHunk {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: "add" | "remove" | "context"
  content: number
  text: string
}

export interface AppState {
  screen: "welcome" | "chat" | "settings"
  mode: "plan" | "code" | "debug" | "ask"
  provider: string
  model: string
  lang: "zh" | "en"
  messages: Message[]
  isStreaming: boolean
  currentInput: string
  showDiff: boolean
  currentDiff: DiffBlock | null
}

export function createInitialState(): AppState {
  return {
    screen: "welcome",
    mode: "code",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    lang: detectLang(),
    messages: [],
    isStreaming: false,
    currentInput: "",
    showDiff: false,
    currentDiff: null,
  }
}

function detectLang(): "zh" | "en" {
  const envLang = process.env.LANG || process.env.LC_ALL || ""
  return envLang.startsWith("zh") ? "zh" : "en"
}

let msgCounter = 0
export function createMessage(role: Message["role"], content: string): Message {
  return {
    id: `msg-${++msgCounter}`,
    role,
    content,
    timestamp: Date.now(),
  }
}
