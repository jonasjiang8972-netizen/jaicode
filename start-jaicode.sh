#!/bin/bash
# Jaicode 一键启动脚本
# 用法: bash start-jaicode.sh

set -e

JI_DIR="$HOME/jaicode"
LOG_DIR="/tmp/jaicode-logs"
mkdir -p "$LOG_DIR"

echo "⬡ Jaicode 一键启动"
echo "==================="

# 1. 启动 Go 后端
if curl -s http://localhost:3003/api/health > /dev/null 2>&1; then
    echo "  ✓ Go 后端已运行 (端口 3003)"
else
    echo "  → 启动 Go 后端..."
    tmux kill-session -t go-backend 2>/dev/null || true
    tmux new-session -d -s go-backend "exec $JI_DIR/bin/jaicode-server"
    sleep 2
    if curl -s http://localhost:3003/api/health > /dev/null 2>&1; then
        echo "  ✓ Go 后端就绪 (端口 3003)"
    else
        echo "  ✗ Go 后端启动失败"
        exit 1
    fi
fi

# 2. 启动 TUI
tmux kill-session -t jaicode 2>/dev/null || true
tmux new-session -d -s jaicode "cd $JI_DIR && node packages/tui-node/src/tui.js"

echo "  ✓ Jaicode TUI 就绪"
echo ""
echo "连接命令: tmux attach -t jaicode"
echo "断开: Ctrl+B → D"
