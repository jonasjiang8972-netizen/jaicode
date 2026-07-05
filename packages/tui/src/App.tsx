import { Box, Text, useInput, useApp } from "ink"
import { useState, useCallback, useEffect } from "react"
import { WelcomeScreen } from "./screens/WelcomeScreen"
import { ChatScreen } from "./screens/ChatScreen"
import { createInitialState, createMessage, AppState } from "./theme/state"
import { ProviderRegistry } from "@jaicode/llm"
import { Config } from "@jaicode/core"
import { ILLMProvider } from "@jaicode/llm"

export function App() {
  const { exit } = useApp()
  const [state, setState] = useState<AppState>(createInitialState())

  // Initialize provider
  useEffect(() => {
    async function init() {
      try {
        const config = await Config.load()
        if (config.providers && config.providers[config.defaultProvider]?.apiKey) {
          const providerConfig = config.providers[config.defaultProvider]
          const provider = ProviderRegistry.create(config.defaultProvider, {
            apiKey: providerConfig.apiKey,
            model: providerConfig.model,
          })
          if (provider) {
            setState((s) => ({ ...s, provider: config.defaultProvider, model: providerConfig.model }))
          }
        }
      } catch {
        // No config yet
      }
    }
    init()
  }, [])

  const handleModeChange = useCallback((mode: AppState["mode"]) => {
    setState((s) => ({ ...s, mode }))
  }, [])

  const handleStartChat = useCallback(() => {
    setState((s) => ({
      ...s,
      screen: "chat",
      messages: [
        createMessage(
          "assistant",
          s.lang === "zh"
            ? `👋 欢迎使用 Jaicode！当前模式: ${s.mode.toUpperCase()}。请描述你的任务。`
            : `👋 Welcome to Jaicode! Mode: ${s.mode.toUpperCase()}. Describe your task.`,
        ),
      ],
    }))
  }, [])

  const handleBack = useCallback(() => {
    setState((s) => ({ ...s, screen: "welcome", messages: [] }))
  }, [])

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMsg = createMessage("user", content)
      const assistantMsg = createMessage("assistant", "")
      assistantMsg.isStreaming = true

      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg, assistantMsg],
        isStreaming: true,
      }))
      const config = await Config.load()
      const providerConfig = config.providers?.[config.defaultProvider]
      if (!providerConfig?.apiKey) {
        setState((s) => ({
          ...s,
          isStreaming: false,
          messages: [
            ...s.messages.slice(0, -1),
            createMessage(
              "assistant",
              s.lang === "zh"
                ? "❌ 未配置 LLM Provider。请运行:\n  jaicode config --provider anthropic --api-key sk-xxx"
                : "❌ No LLM Provider configured. Run:\n  jaicode config --provider anthropic --api-key sk-xxx",
            ),
          ],
        }))
        return
      }

      const provider = ProviderRegistry.create(config.defaultProvider, {
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
      })

      if (!provider) {
        setState((s) => ({
          ...s,
          isStreaming: false,
          messages: [
            ...s.messages.slice(0, -1),
            createMessage("assistant", `❌ Provider "${config.defaultProvider}" not found.`),
          ],
        }))
        return
      }
      // Build system prompt based on mode
      const modePrompts: Record<string, string> = {
        plan: "You are an architecture design assistant. Generate Architecture Decision Records (ADR).",
        code: "You are a coding assistant. Generate code changes in FILE: format with complete file content.",
        debug: "You are a debugging assistant. Analyze errors and provide fixes.",
        ask: "You are a Q&A assistant. Answer questions concisely.",
      }

      const langNote =
        state.lang === "zh" ? "Reply in Chinese." : "Reply in English."

      const messages = [
        { role: "system" as const, content: `${modePrompts[state.mode]} ${langNote}` },
        ...state.messages
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content },
      ]

      let response = ""
      try {
        for await (const chunk of provider.stream(messages)) {
          if (chunk.type === "text" && chunk.content) {
            response += chunk.content
            setState((s) => ({
              ...s,
              messages: s.messages.map((m, i) =>
                i === s.messages.length - 1 ? { ...m, content: response } : m
              ),
            }))
          }
        }
      } catch (e) {
        console.error('[Jaicode] Stream error:', e instanceof Error ? e.message : String(e))
      }
      setState((s) => ({
        ...s,
        isStreaming: false,
        messages: s.messages.map((m, i) =>
          i === s.messages.length - 1 ? { ...m, content: response, isStreaming: false } : m
        ),
      }))
    },
    [state.mode, state.lang, state.messages],
  )

  if (state.screen === "welcome") {
    return (
      <Box flexDirection="column" width="100%">
        <WelcomeScreen mode={state.mode} onModeChange={handleModeChange} onStart={handleStartChat} />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width="100%">
      <ChatScreen
        mode={state.mode}
        messages={state.messages}
        isStreaming={state.isStreaming}
        provider={state.provider}
        model={state.model}
        lang={state.lang}
        onSendMessage={handleSendMessage}
        onModeChange={handleModeChange}
        onBack={handleBack}
      />
    </Box>
  )
}
