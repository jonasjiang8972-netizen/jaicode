import { Box, Text, Static } from "ink"
import { Message } from "../theme/state"

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Static items={messages.filter((m) => m.role !== "system")}>
        {(msg) => (
          <Box key={msg.id} flexDirection="column" marginBottom={0}>
            <Box>
              <Text
                bold
                color={msg.role === "user" ? "#00B8D9" : msg.role === "assistant" ? "#00E5C9" : "#8b949e"}
              >
                {msg.role === "user" ? "❯ You" : msg.role === "assistant" ? "⬡ Jaicode" : "⚙ System"}
              </Text>
              <Text dimColor>  {new Date(msg.timestamp).toLocaleTimeString()}</Text>
            </Box>
            <Box marginLeft={2} marginBottom={1}>
              <Text wrap="wrap">{msg.content}</Text>
            </Box>
          </Box>
        )}
      </Static>
    </Box>
  )
}
