#!/bin/bash
set -e

echo "=== Jaicode Deployment Script ==="

# 1. Install Node.js via nvm
if ! command -v node &> /dev/null; then
  echo "[1/6] Installing Node.js..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  echo "Node.js $(node --version) installed"
else
  echo "[1/6] Node.js already installed: $(node --version)"
fi

# 2. Install bun
if ! command -v bun &> /dev/null; then
  echo "[2/6] Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  echo "Bun $(bun --version) installed"
else
  echo "[2/6] Bun already installed: $(bun --version)"
fi

# 3. Clone or update
if [ -d "jaicode" ]; then
  echo "[3/6] Updating existing repo..."
  cd jaicode && git pull
else
  echo "[3/6] Cloning repo..."
  git clone https://github.com/jonasjiang8972-netizen/jaicode.git
  cd jaicode
fi

# 4. Install deps
echo "[4/6] Installing dependencies..."
bun install

# 5. Create config dirs
mkdir -p ~/.jaicode/logs ~/.jaicode/skills ~/.jaicode/extensions

# 6. Start Jaicode in tmux
tmux kill-session -t jaicode 2>/dev/null || true
tmux new -s jaicode -d "cd $HOME/jaicode && node packages/tui-node/src/tui.js"

echo ""
echo "=== Deployment Complete ==="
echo "Node: $(node --version)"
echo "Bun:  $(bun --version 2>/dev/null || echo 'N/A')"
echo ""
echo "Access Jaicode:"
echo "  ssh ubuntu@1.116.253.201 -t 'tmux attach -t jaicode'"
