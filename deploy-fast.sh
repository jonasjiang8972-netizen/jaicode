#!/bin/bash
set -e

echo "=== Jaicode Deployment (Fast Mode) ==="

# 1. Install Node.js via apt (fast, no download timeout)
if ! command -v node &> /dev/null; then
  echo "[1/5] Installing Node.js via apt..."
  sudo apt update -qq
  sudo apt install -y -qq nodejs npm
  echo "Node.js $(node --version) installed"
else
  echo "[1/5] Node.js already installed: $(node --version)"
fi

# 2. Install bun (quick binary download)
if ! command -v bun &> /dev/null; then
  echo "[2/5] Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo "Bun $(bun --version) installed"
else
  echo "[2/5] Bun already installed: $(bun --version)"
fi

# 3. Clone or update
if [ -d "jaicode" ]; then
  echo "[3/5] Updating repo..."
  cd jaicode && git pull --quiet
else
  echo "[3/5] Cloning repo..."
  git clone --quiet https://github.com/jonasjiang8972-netizen/jaicode.git
  cd jaicode
fi

# 4. Install deps
echo "[4/5] Installing dependencies..."
bun install --silent 2>/dev/null || npm install --silent

# 5. Create config dirs and start
mkdir -p ~/.jaicode/logs ~/.jaicode/skills ~/.jaicode/extensions
tmux kill-session -t jaicode 2>/dev/null || true
tmux new -s jaicode -d "cd $HOME/jaicode && node packages/tui-node/src/tui.js"

echo ""
echo "=== Done ==="
echo "Node: $(node --version)"
echo "Access: ssh ubuntu@1.116.253.201 -t 'tmux attach -t jaicode'"
