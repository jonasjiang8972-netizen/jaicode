import { Box, Text } from "ink"

interface DiffRendererProps {
  path: string
  additions: number
  deletions: number
  hunks: Array<{
    oldStart: number
    newStart: number
    lines: Array<{ type: "add" | "remove" | "context"; text: string }>
  }>
}

export function DiffRenderer({ path, additions, deletions, hunks }: DiffRendererProps) {
  return (
    <Box flexDirection="column" marginY={1} borderStyle="single" borderColor="#30363d">
      <Box paddingX={1} backgroundColor="#1a1f3a">
        <Text bold color="#00B8D9"> {path} </Text>
        <Text> </Text>
        <Text color="#39d353">+{additions}</Text>
        <Text> </Text>
        <Text color="#ff5f56">-{deletions}</Text>
      </Box>
      {hunks.map((hunk, hi) => (
        <Box key={hi} flexDirection="column">
          <Box paddingX={1}>
            <Text dimColor>
              @@ -{hunk.oldStart}, +{hunk.newStart} @@
            </Text>
          </Box>
          {hunk.lines.map((line, li) => (
            <Box key={li} flexDirection="row">
              <Text color={line.type === "add" ? "#39d353" : line.type === "remove" ? "#ff5f56" : "#8b949e"}>
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </Text>
              <Text color={line.type === "add" ? "#39d353" : line.type === "remove" ? "#ff5f56" : undefined}>
                {line.text}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}
