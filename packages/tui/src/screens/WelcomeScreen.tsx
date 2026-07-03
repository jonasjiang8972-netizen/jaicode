import { Box, Text, useInput } from "ink"
import { Logo } from "../components/Logo"
import { ModeSelector } from "../components/ModeSelector"

interface WelcomeScreenProps {
  mode: "plan" | "code" | "debug" | "ask"
  onModeChange: (mode: "plan" | "code" | "debug" | "ask") => void
  onStart: () => void
}

export function WelcomeScreen({ mode, onModeChange, onStart }: WelcomeScreenProps) {
  useInput((input, key) => {
    if (key.return) {
      onStart()
    }
    if (input === "q" || (key.ctrl && input === "c")) {
      process.exit(0)
    }
  })

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Logo />
      <Box marginY={2} flexDirection="column" alignItems="center">
        <Text color="#8b949e">Select mode:</Text>
        <ModeSelector selected={mode} onSelect={onModeChange} />
      </Box>
      <Box marginY={1} flexDirection="column" alignItems="center">
        <Text color="#8b949e">Quick start:</Text>
        <Box marginY={1}>
          <Box marginX={1} paddingX={1} borderStyle="single" borderColor="#30363d">
            <Text color="#00E5C9">1</Text>
            <Text dimColor> Architect</Text>
          </Box>
          <Box marginX={1} paddingX={1} borderStyle="single" borderColor="#00B8D9">
            <Text color="#00E5C9">2</Text>
            <Text dimColor> Code</Text>
          </Box>
          <Box marginX={1} paddingX={1} borderStyle="single" borderColor="#30363d">
            <Text color="#00E5C9">3</Text>
            <Text dimColor> Debug</Text>
          </Box>
          <Box marginX={1} paddingX={1} borderStyle="single" borderColor="#30363d">
            <Text color="#00E5C9">4</Text>
            <Text dimColor> Ask</Text>
          </Box>
        </Box>
      </Box>
      <Box marginTop={2}>
        <Text color="#39d353">Press ENTER to start · 1-4 select mode · Q quit</Text>
      </Box>
    </Box>
  )
}
