# Jaicode

> 面向隐私敏感企业与中英双语开发团队的 **本地优先 AI 编程 Agent** — 代码不出本地，模型自由选择

Jaicode 是一个开源的本地优先 AI 编程助手，类似于 Claude Code / Codex CLI，但更加开放和自由。代码不出本地设备，支持中英双语 100% 对齐，**不限制 AI 模型来源**。

---

## 核心特性

- **终端原生 CLI** — 不依赖 IDE，在任意终端运行，支持流式输出和 Diff 确认
- **多模型开放** — 不绑定任何 AI 厂商，Anthropic / OpenAI / DeepSeek / 智谱 / 自定义中转均可
- **中英双语** — 终端交互与 AI Prompt 自适应语言
- **本地优先** — 代码零出域，所有数据本地存储
- **Git 集成** — commit / branch / PR / diff 一键操作
- **文件安全** — 写入前自动备份 + 一键回滚

## 安装

### 方式 1：终端 TUI（推荐）

```bash
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode
bun install

# 启动
node packages/tui-node/src/tui.js
```

### 方式 2：Go 后端（独立服务）

```bash
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode/backend-go

# 构建
go build -o jaicode-server cmd/jaicode-desktop/main.go

# 运行（默认端口 3004）
./jaicode-server
```

### 方式 3：macOS 本地二进制

```bash
cd jaicode/backend-go
go build -ldflags="-linkmode=external" -o jaicode-macos cmd/jaicode-desktop/main.go
codesign -s - jaicode-macos
./jaicode-macos
```

### 方式 4：桌面应用（需要 Rust 工具链）

```bash
cd jaicode/desktop-app
bun install
cargo tauri dev      # 开发模式
cargo tauri build    # 构建发布版
```

> **注意：** 一键安装脚本（install.sh）、GitHub Release 下载、npm 包尚未发布。当前仅支持从源码构建。

---

## 首次配置

启动 Jaicode 后，首次使用会引导你选择 LLM Provider：

```
⚠ 未检测到 API Key

  选择你的 LLM Provider:

    [1] Anthropic — Claude 官方
    [2] OpenAI — GPT 官方
    [3] 自定义中转 — OpenAI 兼容

  选择 (1-3): 1

  输入 Anthropic API Key: sk-ant-...

  正在验证 API Key...
  ✓ API Key 验证成功！已保存为 "anthropic"
```

---

## Agent 模式

| 模式 | 权限 | 适用场景 |
|------|------|----------|
| **Plan** | 只读 | 架构设计与技术方案 |
| **Code** | 读写 | 代码编写与修改 |
| **Debug** | 读写+执行 | Bug 自动修复循环 |
| **Ask** | 只读 | 纯问答 |

---

## 快速启动示例

```bash
# 进入你的项目目录后启动
cd /your/project
node /path/to/jaicode/packages/tui-node/src/tui.js

# 输入任务
❯ 修复登录接口的空指针异常

# Jaicode 分析代码并生成 Diff
⬡ Jaicode · 2.3s
  📝 Modified: src/auth/login.ts
  + return user?.token?.value ?? null;
  - return user.token.value;

  Apply this change? [y/N]: y
  ✓ Written: src/auth/login.ts
```

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `/help` | 查看所有命令 |
| `/read <文件>` | 读取项目文件 |
| `/exec <命令>` | 执行 Shell 命令 |
| `/git status` | 查看 Git 状态 |
| `/git commit <msg>` | 提交代码 |
| `/hooks` | 管理自动化钩子 |
| `/stats` | 用量统计 |
| `/quit` | 退出 |

---

## 项目结构

```
jaicode/
├── backend-go/          # Go 后端服务（跨平台二进制 <5MB）
├── desktop-app/         # Tauri 桌面应用（Go + SolidJS）
├── packages/
│   ├── tui-node/        # TypeScript 终端 TUI
│   ├── core/            # 核心模块（安全/存储/加密/日志）
│   ├── llm/             # LLM Provider 适配（多厂商）
│   ├── i18n/            # 中英双语引擎
│   └── marketplace/     # Skills / MCP / Agents 扩展市场
├── prd/                 # 产品需求文档（14 份）
└── .jai/                # Agent 与命令定义
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Go 1.22 | 高性能、单二进制、跨平台 |
| 前端 | TypeScript + Ink (终端) | 终端交互 |
| 运行时 | Node.js 18+ / Bun 1.3+ | 快速开发与执行 |
| 通信 | HTTP + SSE 流式 | 实时 AI 响应 |

---

## 版本策略

`v{major}.{minor}.{patch}` — 每次只递增一位，禁止跳号。

| 分支 | 后端 | 当前版本 |
|------|------|----------|
| `main` | TypeScript TUI | v0.15.2 |
| `feat/go-backend` | Go | v0.15.2 |

---

## 数据安全与隐私

- 所有用户数据存储于 `~/.jaicode/`，**零云端上传**
- API Key 本地 AES-256-GCM 加密存储（HKDF-SHA256 密钥派生）
- 日志仅本地留存，不记录用户代码内容
- 断网环境下核心 Agent 功能完整可用（LLM 调用除外）
- 危险命令黑名单 + 写入前确认机制

---

## 许可证

Apache License 2.0 — 详见 [LICENSE](./LICENSE)

第三方组件声明 — [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt)

---

*Jaicode — 你的代码，你的 AI，你的选择。*
