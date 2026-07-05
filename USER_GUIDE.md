# Jaicode 用户使用手册

> 版本：v1.0.0 | 最后更新：2026-07-05

---

## 目录

1. [安装](#1-安装)
2. [首次配置](#2-首次配置)
3. [桌面应用](#3-桌面应用)
4. [终端 CLI](#4-终端-cli)
5. [Agent 模式](#5-agent-模式)
6. [命令参考](#6-命令参考)
7. [快捷键](#7-快捷键)
8. [多 Provider 配置](#8-多-provider-配置)
9. [文件操作](#9-文件操作)
10. [图片分析](#10-图片分析)
11. [Hooks 系统](#11-hooks-系统)
12. [用量统计](#12-用量统计)
13. [故障排除](#13-故障排除)

---

## 1. 安装

### 桌面应用（推荐）

**macOS / Linux:**
```bash
curl -fsSL https://jaicode.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://jaicode.ai/install.ps1 | iex
```

### 终端 CLI

```bash
# Go 二进制（推荐）
curl -LO https://github.com/jonasjiang8972-netizen/jaicode/releases/latest/download/jaicode-$(uname -s)-$(uname -m)
chmod +x jaicode-*
./jaicode

# npm
npm install -g @jaicode/cli

# 源码
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode && bun install
```

---

## 2. 首次配置

启动 Jaicode 后，按引导选择 LLM Provider：

```
⚠ 未检测到 API Key

  选择你的 LLM Provider:
    [1] Anthropic — Claude 官方
    [2] OpenAI — GPT 官方
    [3] 自定义中转 — OpenAI 兼容

  选择 (1-3): _

  输入 API Key: sk-...

  ✓ API Key 验证成功！
```

---

## 3. 桌面应用

### 主界面

```
┌────────────────────────────────────────────────────────────┐
│ ⬡ Jaicode v1.0.0  ● Connected  Mode: AUTO | Provider: xxx│
├──────────┬───────────────────────────────────────────────┤
│ ⬡ Jaicode│  ❯ 你能帮我修复这个 bug 吗？                  │
│          │                                               │
│ [Chat]   │  ⬡ Jaicode · 3.2s                            │
│ [Files]  │  我来分析这个问题...                           │
│ [Git]    │                                               │
│          │  📝 src/auth/login.ts                         │
│          │  + return user?.token?.value ?? null;         │
│          │  - return user.token.value;                   │
│          │                                               │
│          │  Apply this change? [y/N]                     │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│ > Type a task...                                   [Send] │
└────────────────────────────────────────────────────────────┘
```

### 功能面板

| 面板 | 快捷键 | 说明 |
|---|---|---|
| Chat | `Ctrl+1` | 对话模式 |
| Files | `Ctrl+2` | 项目文件树 |
| Git | `Ctrl+3` | Git 状态与操作 |
| Settings | `Ctrl+,` | 配置管理 |
| Stats | `Ctrl+4` | 用量统计 |

---

## 4. 终端 CLI

### 启动

```bash
# 桌面后端模式（连接远程服务器中的 Go 后端）
./jaicode --server

# 模式选择
./jaicode                    # 自动检测
./jaicode --mode plan        # 架构设计
./jaicode --mode code        # 代码编写
./jaicode --mode debug       # 调试修复
./jaicode --mode ask         # 问答模式

# 单次执行
./jaicode code "修复登录接口 bug"
./jaicode debug "npm test"
./jaicode plan "设计认证模块"
```

### 终端快捷键

| 快捷键 | 行为 |
|---|---|
| `Enter` | 发送消息 |
| `Shift+Enter` | 换行 |
| `↑` / `↓` | 浏览历史输入 |
| `Tab` | 自动补全 |
| `Ctrl+C` | 中断操作 |
| `Ctrl+D` | 退出 |

---

## 5. Agent 模式

### Plan 模式（架构设计）

分析需求并生成架构决策记录（ADR）。

```
❯ 设计用户认证的微服务架构

⬡ Jaicode · 5.1s
  生成 ADR:
  1. 方案对比：单体 vs 微服务 vs Serverless
  2. 推荐：微服务 + JWT + Redis Session
  3. 风险评估：网络延迟、一致性问题

  ADR 已保存至 ADR.md
```

### Code 模式（代码编写）

生成代码变更并以 Diff 展示，确认后写入。

```
❯ 修复登录接口的空指针异常

⬡ Jaicode · 2.3s
  📝 Modified: src/auth/login.ts
  + return user?.token?.value ?? null;
  - return user.token.value;

  Apply this change? [y/N]: y
  ✓ Written: src/auth/login.ts (1245 bytes)
```

### Debug 模式（自动修复）

运行命令 → 分析错误 → 生成修复 → 重新运行，循环直至成功。

```
❯ npm test

  第 1/5 次尝试
  ✗ Failed: TypeError: Cannot read property 'id'

  正在生成修复方案...

  第 2/5 次尝试
  ✓ 测试通过！用时 2 次尝试。
```

### Ask 模式（纯问答）

不修改文件，直接回答问题。

---

## 6. 命令参考

### 内置命令

| 命令 | 说明 |
|---|---|
| `/help` | 显示所有命令 |
| `/quit` | 退出 |
| `/clear` | 清屏 |
| `/mode` | 切换模式 |
| `/config` | 配置管理 |
| `/stats` | 用量统计 |
| `/audit` | 审计日志 |
| `/caps` | 能力审计 |

### 文件命令

| 命令 | 说明 |
|---|---|
| `/read <文件>` | 读取文件内容 |
| `/exec <命令>` | 执行 Shell 命令 |
| `/image <路径>` | 分析图片 |
| `/paste` | 读取剪贴板图片 |

### Git 命令

| 命令 | 说明 |
|---|---|
| `/git status` | 查看 Git 状态 |
| `/git log` | 查看提交历史 |
| `/git branch` | 查看分支 |
| `/git commit <msg>` | 提交代码 |

### Hooks / MCP / 系统

| 命令 | 说明 |
|---|---|
| `/hooks` | 查看已配置钩子 |
| `/hooks add <事件> "<命令>"` | 添加钩子 |
| `/mcp` | 查看 MCP 服务器 |
| `/mcp add <名称> <命令>` | 添加 MCP 服务器 |
| `/mcp connect <名称>` | 连接服务器 |
| `/update` | 检查更新 |
| `/sessions` | 历史会话 |
| `/agents <描述>` | 启动子 Agent |

---

## 7. 快捷键

### 桌面应用

| 快捷键 | 行为 |
|---|---|
| `Cmd+Shift+J` | 全局唤起（可自定义） |
| `Ctrl+1-4` | 切换面板 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+N` | 新建会话 |
| `Ctrl+W` | 关闭窗口 |
| `Cmd+Q` | 退出（最小化到托盘） |

### 终端 TUI

| 快捷键 | 行为 |
|---|---|
| `Enter` | 发送 |
| `Shift+Enter` | 换行 |
| `↑↓` | 输入历史 |
| `Tab` | 自动补全 |
| `Ctrl+C` | 中断/退出 |
| `Ctrl+L` | 清屏 |
| `Ctrl+M` | 切换模式 |

---

## 8. 多 Provider 配置

### Anthropic（默认）

```
jaicode config --provider anthropic --api-key sk-ant-xxx
```

### OpenAI

```
jaicode config --provider openai --api-key sk-xxx
```

### 自定义中转

```
jaicode config --provider custom \
  --api-key ak_xxx \
  --base-url https://api.longcat.chat/openai \
  --model LongCat-2.0
```

### 快速切换

```
# 桌面应用
Ctrl+P → Provider 切换

# CLI
jaicode config --provider openai
jaicode config --provider anthropic
```

---

## 9. 文件操作

### 读取文件

```
❯ /read package.json
📄 package.json (json, 45 lines):
{
  "name": "my-project",
  "version": "1.0.0",
  ...
}
```

### 写入文件

```
❯ 添加一个 .gitignore 文件

[Write] .gitignore
Changes: +5 -0

Apply this change? [y/N]: y
✓ Written: .gitignore (128 bytes)
```

### 备份回滚

```
❯ /rollback
发现最近一次变更备份：
  src/auth/login.ts   (2026-07-05 14:22)

是否恢复到变更前状态？ [y/N]: y
✓ 已恢复 1 个文件。
```

---

## 10. 图片分析

### 桌面应用

拖拽图片到窗口或 `Cmd+V` 粘贴：

```
[图片] login-screen.png 已接收
正在分析...

⬡ Jaicode · 4.2s
  这是一个登录页面截图：
  - 顶部导航栏包含 Logo 和用户菜单
  - 中央卡片包含用户名/密码输入框
  - 底部有"记住我"和"忘记密码"链接
  - 检测到潜在问题：密码字段未显示强度提示
```

### CLI

```
❯ /image ./screenshot.png

📸 screenshot.png (245KB)
正在调用 VL 模型分析...

⬡ Jaicode · 3.8s
  [图片描述]
```

---

## 11. Hooks 系统

### 添加 Hook

```
❯ /hooks add post-edit "prettier --write"
✓ Hook added: post-edit → prettter --write

❯ /hooks add pre-commit "npm test"
✓ Hook added: pre-commit → npm test
```

### 事件类型

| 事件 | 触发时机 |
|---|---|
| `pre-edit` | 文件写入前 |
| `post-edit` | 文件写入后 |
| `pre-commit` | Git 提交前 |
| `post-commit` | Git 提交后 |
| `pre-exec` | Shell 命令执行前 |
| `post-exec` | Shell 命令执行后 |
| `session-start` | 会话开始时 |
| `session-end` | 会话结束时 |

---

## 12. 用量统计

```
❯ /stats

Session:  12 requests, 45.2k tokens, 3m 28s
  Rate:   8.3 t/s
  Model:  claude-sonnet-4-20250514

Total:
  APIs:   156 requests
  In:     234.5k prompt tok
  Out:    89.2k completion tok
  Sum:    323.7k tokens
  Avg:    12ms latency
  Errors: 1
```

---

## 13. 故障排除

| 问题 | 解决方案 |
|---|---|
| `command not found: jaicode` | 检查 PATH 或重新运行 install.sh |
| `No API Key` | 运行 `/config` 或 menu > Settings |
| `API error: 401` | 检查 API Key 是否正确 |
| `API error: 429` | 请求过于频繁，等待后重试 |
| `File too large` | 文件超过 5MB，用 `/read` 分段读取 |
| `Context compacted` | 对话过长自动压缩，正常现象 |
| `Image analysis failed` | Provider 不支持图片，切换到 Claude/GPT-4V |
| `进程崩溃` | 日志：`~/.jaicode/logs/` |

### 重置配置

```bash
rm -rf ~/.jaicode/
./jaicode    # 重新初始化
```

### 获取帮助

```
/help                    # 命令列表
/audit                   # 操作日志
/caps                    # 能力审计
```

---

*Jaicode Desktop v1.0.0 — 详见 [https://github.com/jonasjiang8972-netizen/jaicode](https://github.com/jonasjiang8972-netizen/jaicode)*
