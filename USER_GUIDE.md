# Jaicode 用户使用手册

> 版本：v0.11.0 | 最后更新：2026-07-04

---

## 目录

1. [产品简介](#1-产品简介)
2. [安装与配置](#2-安装与配置)
3. [快速入门](#3-快速入门)
4. [Agent 模式](#4-agent-模式)
5. [命令参考](#5-命令参考)
6. [文件操作](#6-文件操作)
7. [Git 集成](#7-git-集成)
8. [Hooks 系统](#8-hooks-系统)
9. [MCP 集成](#9-mcp-集成)
10. [多 Provider 配置](#10-多-provider-配置)
11. [个性化配置](#11-个性化配置)
12. [会话管理](#12-会话管理)
13. [安全模型](#13-安全模型)
14. [故障排除](#14-故障排除)

---

## 1. 产品简介

### 1.1 什么是 Jaicode

Jaicode 是一个**本地优先**的终端 AI 编程助手。它运行在你的本地设备上，通过自然语言交互辅助开发者完成代码编写、调试、重构等开发任务。

**核心理念：**
- **代码不出本地** — 除 LLM API 调用外，所有操作均在本地完成
- **模型中立** — 不绑定任何 AI 厂商，支持 BYOK（自带密钥）
- **中英双语** — 终端交互与 AI 回复语言 100% 对齐
- **用户主权** — 所有数据存储于本地，零云端上传

### 1.2 核心能力

| 能力 | 说明 |
|---|---|
| 文件读写 | 读取项目文件、生成代码变更、Diff 确认后写入 |
| Git 集成 | 自动 commit、分支管理、PR 创建 |
| Shell 执行 | 执行终端命令，捕获输出 |
| 调试循环 | 自动运行测试 → 分析错误 → 修复 → 重试 |
| Hooks | 编辑/提交前后自动执行自定义命令 |
| MCP | 连接外部工具服务器扩展能力 |
| 会话恢复 | 断连后自动恢复上下文 |
| 上下文压缩 | 长对话自动摘要，防止 Token 溢出 |

### 1.3 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    用户终端 (TUI)                         │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 输入框   │  │ 消息区   │  │ 状态栏   │  │ 思考面板  │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                    核心引擎                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 意图识别  │ │ 文件处理  │ │ 安全过滤  │ │ 会话管理  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Git 操作  │ │ Hooks    │ │ MCP      │ │ 记忆系统  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  LLM Provider 层                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │Anthropic│ │ OpenAI │ │ 中转API │ │ 本地模型│          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 安装与配置

### 2.1 系统要求

- **Node.js** >= 18.0
- **Bun** >= 1.3（推荐）或 npm
- **操作系统**：macOS / Linux / Windows

### 2.2 安装方式

**方式 1：一键安装（推荐）**

```bash
curl -fsSL https://jaicode.ai/install.sh | bash
```

**方式 2：npm 全局安装**

```bash
npm install -g @jaicode/cli
```

**方式 3：源码安装**

```bash
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode
bun install
```

### 2.3 首次配置

启动 Jaicode 后，首次使用会引导你选择 LLM Provider：

```
⚠ 未检测到 API Key

  选择你的 LLM Provider:

    [1] Anthropic — Claude 官方
    [2] OpenAI — GPT 官方
    [3] LongCat — 美团 · LongCat-2.0
    [4] 其他中转 — OpenAI 兼容

  选择 (1-4): 1

  获取 API Key: https://console.anthropic.com/settings/keys

  输入 Anthropic API Key: sk-ant-...

  正在验证 API Key...
  ✓ API Key 验证成功！已保存为 "anthropic"
```

### 2.4 配置文件

| 文件 | 路径 | 说明 |
|---|---|---|
| 全局配置 | `~/.jaicode/config.json` | Provider、模型、语言偏好 |
| 用户画像 | `~/.jaicode/user.profile` | 编码习惯、输出偏好 |
| 权限配置 | `~/.jaicode/permissions.json` | L0-L4 权限等级 |
| 审计日志 | `~/.jaicode/audit.jsonl` | 操作记录 |
| 会话数据 | `~/.jaicode/sessions/` | 会话持久化 |
| 项目配置 | `.jaicode/project.yaml` | 项目级配置 |

---

## 3. 快速入门

### 3.1 启动 Jaicode

```bash
# 在当前项目目录启动
cd your-project
jaicode

# 或直接运行
node packages/tui-node/src/index.js
```

### 3.2 第一个任务

启动后，在 `❯` 提示符后输入任务描述：

```
❯ 帮我看看这个项目是什么结构

⬡ Jaicode · 3.2s
  这是一个 Node.js + TypeScript 项目，使用 Bun 作为包管理器。
  主要目录：
  - packages/cli: CLI 入口
  - packages/core: 核心模块
  - packages/llm: Provider 适配
```

### 3.3 修改文件

```
❯ 在 README.md 顶部添加一个徽章

[Write] README.md
Changes: +3 -0

Apply this change? [y/N]: y
✓ Written: README.md (1245 bytes)
```

### 3.4 提交代码

```
❯ /git commit "docs: add badge to README"

✓ Committed: docs: add badge to README
```

---

## 4. Agent 模式

Jaicode 支持 4 种 Agent 模式，根据任务自动切换或手动指定。

### 4.1 自动模式（默认）

Jaicode 根据你的输入自动判断意图：

| 输入特征 | 自动选择模式 |
|---|---|
| "设计"、"架构"、"方案" | Plan |
| "修复"、"bug"、"报错" | Debug |
| "解释"、"什么"、"为什么" | Ask |
| 其他（默认） | Code |

### 4.2 手动切换

按 `Ctrl+M` 循环切换模式，或在输入时指定：

```
❯ /mode plan
❯ /mode code
❯ /mode debug
❯ /mode ask
```

### 4.3 模式说明

| 模式 | 权限 | 适用场景 |
|---|---|---|
| **Plan** | 只读 | 技术方案设计、架构分析 |
| **Code** | 读写 | 代码编写、修改、重构 |
| **Debug** | 读写+执行 | Bug 修复、测试运行 |
| **Ask** | 只读 | 技术问答、代码解释 |

---

## 5. 命令参考

### 5.1 内置命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/help` | 显示所有命令 | `/help` |
| `/quit` | 退出 Jaicode | `/quit` |
| `/clear` | 清屏 | `/clear` |
| `/mode` | 切换模式 | `/mode` |
| `/config` | 配置管理 | `/config` |
| `/stats` | 用量统计 | `/stats` |
| `/audit` | 安全审计日志 | `/audit` |
| `/caps` | 能力审计 | `/caps` |
| `/sessions` | 历史会话 | `/sessions` |

### 5.2 文件命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/read <文件>` | 读取文件内容 | `/read package.json` |
| `/exec <命令>` | 执行 Shell 命令 | `/exec ls -la` |
| `/paste` | 读取剪贴板图片 | `/paste` |

### 5.3 Git 命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/git status` | 查看 Git 状态 | `/git status` |
| `/git log` | 查看提交历史 | `/git log` |
| `/git branch` | 查看分支 | `/git branch` |
| `/git commit <msg>` | 提交代码 | `/git commit "fix: bug"` |
| `/git branch <name>` | 创建分支 | `/git branch feature-x` |

### 5.4 Hooks 命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/hooks` | 查看已配置钩子 | `/hooks` |
| `/hooks add <事件> "<命令>"` | 添加钩子 | `/hooks add post-edit "prettier --write"` |
| `/hooks test` | 测试执行钩子 | `/hooks test` |

### 5.5 MCP 命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/mcp` | 查看 MCP 服务器 | `/mcp` |
| `/mcp add <name> <command>` | 添加服务器 | `/mcp add github npx @modelcontextprotocol/server-github` |
| `/mcp connect <name>` | 连接服务器 | `/mcp connect github` |

### 5.6 系统命令

| 命令 | 说明 | 示例 |
|---|---|---|
| `/update` | 检查更新 | `/update` |
| `/update apply` | 应用更新 | `/update apply` |
| `/fix <能力ID>` | 开发缺失能力 | `/fix cap-image-understanding` |

---

## 6. 文件操作

### 6.1 读取文件

直接粘贴文件路径即可自动识别：

```
❯ ./src/index.ts

📄 ./src/index.ts (typescript, 45 lines):
```typescript
import { App } from './App'
...
```
```

或使用 `/read` 命令：

```
❯ /read package.json
```

### 6.2 写入文件

Jaicode 在写入文件前会展示 Diff 并请求确认：

```
❯ 在 index.ts 中添加一个 hello 函数

[Write] index.ts
Changes: +5 -0

Apply this change? [y/N]: y
✓ Written: index.ts (1245 bytes)
```

**安全机制：**
- 写入前自动备份到 `.jaicode_backup/`
- 支持 `y` 确认 / `N` 取消 / `e` 编辑

### 6.3 文件类型识别

Jaicode 自动识别 6 大类文件：

| 类型 | 扩展名 | 处理方式 |
|---|---|---|
| 代码文本 | .ts/.js/.py/.go 等 | 直接读取注入 LLM |
| 配置文件 | .json/.yaml/.toml 等 | 直接读取 |
| 文档 | .md/.txt/.csv 等 | 直接读取 |
| 图片 | .png/.jpg/.webp 等 | VL 模型分析 |
| PDF | .pdf | 文本提取 |
| 归档 | .zip/.tar/.gz 等 | 仅元数据 |

---

## 7. Git 集成

### 7.1 查看状态

```
❯ /git status

Git status (3 files):
 M packages/cli/src/index.ts
 M README.md
?? new-file.ts
```

### 7.2 提交代码

```
❯ /git commit "feat: add new feature"

✓ Committed: feat: add new feature
```

### 7.3 分支管理

```
❯ /git branch

Current: main
All: main, feature-x, hotfix-y

❯ /git branch feature-z

✓ Created branch: feature-z
```

### 7.4 查看历史

```
❯ /git log

Git log:
a1b2c3d feat: add new feature (2 hours ago)
e4f5g6h fix: resolve bug (5 hours ago)
...
```

---

## 8. Hooks 系统

Hooks 允许你在特定事件前后自动执行命令。

### 8.1 事件类型

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

### 8.2 添加 Hook

```
❯ /hooks add post-edit "prettier --write"

✓ Hook added: post-edit → prettier --write
```

### 8.3 查看 Hooks

```
❯ /hooks

Hooks:
post-edit: prettier --write
pre-commit: npm test
```

---

## 9. MCP 集成

MCP（Model Context Protocol）允许 Jaicode 连接外部工具服务器。

### 9.1 添加服务器

```
❯ /mcp add github npx @modelcontextprotocol/server-github

✓ MCP server added: github
```

### 9.2 连接服务器

```
❯ /mcp connect github

✓ Connected to github: 15 tools available
```

### 9.3 查看已配置服务器

```
❯ /mcp

MCP servers: github (npx @modelcontextprotocol/server-github)
```

---

## 10. 多 Provider 配置

### 10.1 支持的 Provider

| Provider | 模型示例 | API 地址 |
|---|---|---|
| Anthropic | claude-sonnet-4-20250514 | api.anthropic.com |
| OpenAI | gpt-4o | api.openai.com |
| LongCat | LongCat-2.0 | api.longcat.chat |
| DeepSeek | deepseek-chat | api.deepseek.com |
| 自定义 | 任意兼容模型 | 任意 OpenAI 兼容 API |

### 10.2 切换 Provider

```
❯ /config --provider openai --api-key sk-xxx
```

### 10.3 自定义中转 API

选择 Provider 时选 `[4] 其他中转`，然后输入：
- API 地址（如 `https://your-proxy.com/v1/chat/completions`）
- 模型名称（如 `gpt-4o`）
- API Key

---

## 11. 个性化配置

### 11.1 用户画像

Jaicode 通过 `~/.jaicode/user.profile` 记录你的偏好：

```json
{
  "name": "developer",
  "role": "fullstack",
  "languages": ["TypeScript", "Python"],
  "frameworks": ["React", "Node.js"],
  "outputPreferences": {
    "language": "zh",
    "verbosity": "normal"
  }
}
```

### 11.2 项目配置

在项目根目录创建 `.jaicode/project.yaml`：

```yaml
project:
  name: my-project
  techStack: [typescript, react]
  conventions:
    namingStyle: camelCase
    indentation: 2spaces
```

### 11.3 语言切换

```
❯ /config --lang zh    # 中文
❯ /config --lang en    # 英文
```

---

## 12. 会话管理

### 12.1 会话持久化

Jaicode 自动保存会话到 `~/.jaicode/sessions/`。断连后重新启动可恢复上下文。

### 12.2 查看历史会话

```
❯ /sessions

Sessions:
[12345] /Users/xxx/project (50 msgs) ●
[12340] /Users/other (20 msgs) ○
```

### 12.3 上下文压缩

当对话过长时，Jaicode 自动压缩历史消息为摘要：

```
[Context compacted: 3200 tokens remaining]
```

---

## 13. 安全模型

### 13.1 权限分级

| 等级 | 操作 | 默认模式 |
|---|---|---|
| **L0** | 读取文件/扫描项目 | 会话授权 |
| **L1** | 写入/修改文件 | 逐次确认 |
| **L2** | 执行 Shell 命令 | 逐次确认 |
| **L3** | 安装 Skill/插件 | 全局授权 |
| **L4** | 外部网络访问 | 按域名确认 |

### 13.2 输入过滤

Jaicode 在发送前检测：
- Prompt 注入攻击
- 敏感数据泄露（API Key、手机号等）
- 危险命令（`rm -rf`、`sudo` 等）

### 13.3 输出过滤

Jaicode 在返回前脱敏：
- API Key → `[API_KEY_REDACTED]`
- 手机号 → `[PHONE_REDACTED]`
- 邮箱 → `[EMAIL_REDACTED]`

### 13.4 审计日志

所有敏感操作记录到 `~/.jaicode/audit.jsonl`：

```
❯ /audit

[2026-07-04T17:30:00] read(L0) → ALLOWED: src/index.ts
[2026-07-04T17:31:00] exec(L2) → ALLOWED: npm test
```

---

## 14. 故障排除

### 14.1 常见问题

| 问题 | 解决方案 |
|---|---|
| `command not found: jaicode` | 检查 PATH 或重新运行 install.sh |
| `No API Key configured` | 运行 `/config` 配置 Provider |
| `API error: 401` | 检查 API Key 是否正确 |
| `API error: 429` | 请求过于频繁，等待后重试 |
| `File too large` | 文件超过大小限制，使用 `/read` 分段读取 |
| `Context compacted` | 对话过长自动压缩，正常现象 |

### 14.2 日志位置

| 日志 | 路径 |
|---|---|
| 审计日志 | `~/.jaicode/audit.jsonl` |
| 会话数据 | `~/.jaicode/sessions/` |
| 备份文件 | `.jaicode_backup/` |

### 14.3 重置配置

```bash
# 重置所有配置
rm -rf ~/.jaicode/

# 重置项目配置
rm -rf .jaicode/
```

### 14.4 获取帮助

```
❯ /help                    # 命令列表
❯ /caps                    # 能力审计
❯ /stats                   # 用量统计
```

---

*Jaicode v0.11.0 — 你的代码，你的 AI，你的选择。*
