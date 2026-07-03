import { Box, Text, useInput, useApp } from "ink"
import { useCallback } from "react"

interface CommandInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function CommandInput({ value, onChange, onSubmit, placeholder = "Type a command...", disabled }: CommandInputProps) {
  const { exit } = useApp()

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit()
      return
    }
    if (key.return) {
      if (value.trim()) {
        onSubmit(value)
        onChange("")
      }
      return
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1))
      return
    }
    if (!key.ctrl && !key.meta && input) {
      onChange(value + input)
    }
  })

  return (
    <Box borderStyle="single" borderColor={disabled ? "#30363d" : "#00B8D9"} paddingX={1}>
      <Text color="#00B8D9">❯ </Text>
      {value ? (
        <Text>{value}</Text>
      ) : (
        <Text dimColor>{placeholder}</Text>
      )}
      {!disabled && <Text color="#00B8D9">▌</Text>}
    </Box>
  )
}
