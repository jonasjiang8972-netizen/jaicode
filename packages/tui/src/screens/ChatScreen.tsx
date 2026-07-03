import { Box, Text, useInput, useApp } from "ink"
import { useCallback, useState } from "react"
import { StatusBar } from "../components/StatusBar"
import { CommandInput } from "../components/CommandInput"
import { MessageList } from "../components/MessageList"
import { DiffRenderer } from "../components/DiffRenderer"
import { Message } from "../theme/state"
import { DiffEngine } from "@jaicode/core"

interface ChatScreenProps {
  mode: "plan" | "code" | "debug" | "ask"
  messages: Message[]
  isStreaming: boolean
  provider: string
  model: string
  lang: "zh" | "en"
  onSendMessage: (content: string) => void
  onModeChange: (mode: "plan" | "code" | "debug" | "ask") => void
  onBack: () => void
}

export function ChatScreen({
  mode,
  messages,
  isStreaming,
  provider,
  model,
  lang,
  onSendMessage,
  onModeChange,
  onBack,
}: ChatScreenProps) {
  const { exit } = useApp()
  const [input, setInput] = useState("")

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit()
    }
    if (key.ctrl && input === "d") {
      onBack()
    }
    if (key.ctrl && input === "m") {
      const modes: Array<"plan" | "code" | "debug" | "ask"> = ["plan", "code", "debug", "ask"]
      const idx = modes.indexOf(mode)
      onModeChange(modes[(idx + 1) % modes.length])
    }
  })

  const handleSubmit = useCallback(
    (value: string) => {
      if (value.trim() && !isStreaming) {
        onSendMessage(value)
        setInput("")
      }
    },
    [isStreaming, onSendMessage],
  )

  // Extract last diff from messages if any
  const lastDiffMessage = [...messages].reverse().find((m) => m.content.includes("FILE:"))

  return (
    <Box flexDirection="column" height="100%">
      <Box paddingX={1}>
        <Text bold color="#00B8D9">⬡ Jaicode</Text>
        <Text dimColor> — {mode.toUpperCase()} mode</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.length === 0 ? (
          <Box flexDirection="column" alignItems="center" marginTop={2}>
            <Text dimColor>
              {lang === "zh"
                ? "↑ 输入任务描述开始 · Ctrl+M 切换模式 · Ctrl+D 返回"
                : "↑ Type a task to begin · Ctrl+M switch mode · Ctrl+D back"}
            </Text>
            <Box marginTop={1}>
              <Text dimColor>
                {lang === "zh" ? "示例: " : "Examples: "}
              </Text>
              <Text color="#00E5C9">
                {mode === "code"
                  ? '"修复登录接口空指针异常"'
                  : mode === "debug"
                    ? '"npm test"'
                    : mode === "plan"
                      ? '"设计用户认证模块"'
                      : '"这段代码做了什么？"'}
              </Text>
            </Box>
          </Box>
        ) : (
          <MessageList messages={messages} />
        )}
      </Box>
      <Box paddingX={1}>
        <CommandInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={
            lang === "zh"
              ? isStreaming ? "处理中..." : "输入任务描述..."
              : isStreaming ? "Processing..." : "Type a task..."
          }
          disabled={isStreaming}
        />
      </Box>
      <StatusBar
        mode={mode}
        provider={provider}
        model={model}
        isStreaming={isStreaming}
        lang={lang}
      />
    </Box>
  )
}
