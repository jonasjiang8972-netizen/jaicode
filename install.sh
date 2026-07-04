#!/bin/bash
# Jaicode Installer - One-click install script
# Usage: curl -fsSL https://jaicode.ai/install.sh | bash

set -e

REPO="jonasjiang8972-netizen/jaicode"
INSTALL_DIR="$HOME/.jaicode"
BIN_DIR="/usr/local/bin"

echo "  ⬡ Jaicode Installer"
echo "  ────────────────────"

# 1. Check prerequisites
echo ""
echo "  [1/4] Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "  ✗ Node.js not found. Please install Node.js 18+ first."
    echo "    brew install node"
    echo "    or visit https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "  ✗ Node.js 18+ required (found $(node -v))"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    echo "  ⚠ Bun not found. Installing..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

echo "  ✓ Node.js $(node -v), Bun $(bun --version 2>/dev/null || echo 'installing...')"

# 2. Clone or update
echo ""
echo "  [2/4] Installing Jaicode..."

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "  → Updating existing installation..."
    cd "$INSTALL_DIR" && git pull --quiet
else
    echo "  → Cloning repository..."
    git clone --quiet "https://github.com/$REPO.git" "$INSTALL_DIR"
fi

# 3. Install dependencies
echo ""
echo "  [3/4] Installing dependencies..."
cd "$INSTALL_DIR"
bun install --silent 2>/dev/null || npm install --silent

# 4. Create symlink
echo ""
echo "  [4/4] Creating command..."
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/packages/tui-node/src/index.js" "$BIN_DIR/jaicode"
chmod +x "$INSTALL_DIR/packages/tui-node/src/index.js" 2>/dev/null || true

echo ""
echo "  ✓ Jaicode installed successfully!"
echo ""
echo "  Start with: jaicode"
echo "  Or: cd your-project && jaicode"
echo ""
