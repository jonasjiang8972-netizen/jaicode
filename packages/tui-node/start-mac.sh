#!/bin/bash
# Jaicode TUI Launcher for macOS
# Compatible with Apple M1/M2/M3/M4/M5 and Intel Macs
# Requires only Node.js 18+

export TERM=xterm-256color
export LANG="${LANG:-en_US.UTF-8}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not found."
    echo "Install from https://nodejs.org or run: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ required (found $(node -v))"
    exit 1
fi

echo "  ⬡ Jaicode v0.1.0 — Starting..."
echo ""

node "$SCRIPT_DIR/src/tui.js"
