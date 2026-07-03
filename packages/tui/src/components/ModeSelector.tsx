import { Box, Text, useInput } from "ink"

interface ModeSelectorProps {
  selected: "plan" | "code" | "debug" | "ask"
  onSelect: (mode: "plan" | "code" | "debug" | "ask") => void
}

const modes = [
  { key: "plan", label: "Plan", desc: "Architect", icon: "◈" },
  { key: "code", label: "Code", desc: "Modify", icon: "⌘" },
  { key: "debug", label: "Debug", desc: "Auto-fix", icon: "⚡" },
  { key: "ask", label: "Ask", desc: "Q&A", icon: "?" },
] as const

export function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
  useInput((input, key) => {
    if (key.leftArrow) {
      const idx = modes.findIndex((m) => m.key === selected)
      if (idx > 0) onSelect(modes[idx - 1].key)
    }
    if (key.rightArrow) {
      const idx = modes.findIndex((m) => m.key === selected)
      if (idx < modes.length - 1) onSelect(modes[idx + 1].key)
    }
    if (input >= "1" && input <= "4") {
      onSelect(modes[parseInt(input) - 1].key)
    }
  })

  return (
    <Box justifyContent="center" marginY={1}>
      {modes.map((mode) => {
        const isSelected = mode.key === selected
        return (
          <Box
            key={mode.key}
            marginX={2}
            paddingX={2}
            borderStyle={isSelected ? "double" : "single"}
            borderColor={isSelected ? "#00B8D9" : "#30363d"}
            flexDirection="column"
            alignItems="center"
          >
            <Text bold={isSelected} color={isSelected ? "#00B8D9" : "#8b949e"}>
              {isSelected ? "▸" : " "}{mode.icon} {mode.label}
            </Text>
            <Text dimColor>{mode.desc}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
