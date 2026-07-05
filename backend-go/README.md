# Jaicode Go Backend

Go implementation of Jaicode's core backend services. Replaces Node.js backend with:

- **Single binary deployment** (no runtime dependencies)
- **Native M5/ARM64 support** (no Bun compatibility issues)
- **True concurrency** (goroutines vs event loop)
- **Smaller & faster** (15-20MB binary, <50ms cold start)

## Architecture

```
┌──────────────────────────────────────────┐
│  TUI Frontend (TypeScript/Ink)            │
└──────────────┬───────────────────────────┘
               │ HTTP/gRPC
┌──────────────┴───────────────────────────┐
│  Go Backend Server                        │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ files  │ │ llm    │ │ git    │      │
│  └────────┘ └────────┘ └────────┘      │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ mcp    │ │session │ │ hooks  │      │
│  └────────┘ └────────┘ └────────┘      │
└──────────────────────────────────────────┘
```

## Quick Start

```bash
# Build
make build

# Run
make run

# Build for all platforms
make build-all

# Test
make test
```

## Module Overview

| Module | Package | Description |
|--------|---------|-------------|
| File Operations | `internal/files/` | Safe read/write with path traversal protection |
| LLM Routing | `internal/llm/` | Multi-provider (Anthropic/OpenAI/custom) with streaming |
| Session | `internal/session/` | Cross-session persistence |
| MCP Client | `internal/mcp/` | JSON-RPC 2.0 protocol client |
| Git Operations | `internal/git/` | Git status/commit/branch/log |
| Hooks | `internal/hooks/` | Pre/post action automation |
| Security | `pkg/security/` | API key encryption, input/output filtering |
| Config | `pkg/config/` | Configuration management |
| Logger | `pkg/logger/` | Structured logging with Zap |

## Cross-Compilation

```bash
# For macOS M5
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o bin/jaicode-server-darwin-arm64

# For Linux
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/jaicode-server-linux-amd64
```

## Version Policy

- Increment ONE position at a time
- Patch: bug fixes (0.13.0 → 0.13.1)
- Minor: new features (0.13.0 → 0.14.0)
- Major: architecture change (0.x → 1.0.0)
- Never skip version numbers
