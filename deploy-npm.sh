#!/bin/bash
set -euo pipefail

echo "=== Jaicode Deployment (npm mode, no bun) ==="

# 1. Install Node.js via apt
if ! command -v node &> /dev/null; then
  echo "[1/4] Installing Node.js..."
  sudo apt update -qq
  sudo apt install -y -qq nodejs npm
  echo "Node.js $(node --version) installed"
else
  echo "[1/4] Node.js already installed: $(node --version)"
fi

# 2. Clone or update
if [ -d "jaicode" ]; then
  echo "[2/4] Updating repo..."
  cd jaicode && git pull --quiet
else
  echo "[2/4] Cloning repo..."
  git clone --quiet https://github.com/jonasjiang8972-netizen/jaicode.git
  cd jaicode
fi

# 3. Install deps (use npm, no bun)
echo "[3/4] Installing dependencies via npm..."
npm install --silent 2>/dev/null || npm install

# 4. Create config dirs and start
mkdir -p ~/.jaicode/logs ~/.jaicode/skills ~/.jaicode/extensions
tmux kill-session -t jaicode 2>/dev/null || true
tmux new -s jaicode -d "cd $HOME/jaicode && node packages/tui-node/src/tui.js"

echo ""
echo "=== Done ==="
echo "Node: $(node --version)"
echo "Access: ssh ubuntu@1.116.253.201 -t 'tmux attach -t jaicode'"
