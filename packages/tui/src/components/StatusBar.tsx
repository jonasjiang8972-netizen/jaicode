import { Box, Text } from "ink"
import Spinner from "ink-spinner"

interface StatusBarProps {
  mode: string
  provider: string
  model: string
  isStreaming: boolean
  lang: "zh" | "en"
}

export function StatusBar({ mode, provider, model, isStreaming, lang }: StatusBarProps) {
  return (
    <Box justifyContent="space-between" paddingX={1} borderStyle="single" borderColor="#30363d">
      <Box>
        <Text color="#39d353">●</Text>
        <Text> </Text>
        <Text color="#00B8D9">{mode.toUpperCase()}</Text>
        <Text dimColor> | </Text>
        <Text color="#00E5C9">{provider}</Text>
        <Text dimColor>:</Text>
        <Text dimColor>{model.split("-").slice(0, 2).join("-")}</Text>
      </Box>
      <Box>
        {isStreaming && (
          <>
            <Text color="#00B8D9">
              <Spinner type="dots" />
            </Text>
            <Text> </Text>
          </>
        )}
        <Text color="#8b949e">
          {lang === "zh" ? "中英" : "EN"}
        </Text>
        <Text dimColor> | </Text>
        <Text color="#8b949e">↵ send · ⌃C exit</Text>
      </Box>
    </Box>
  )
}
