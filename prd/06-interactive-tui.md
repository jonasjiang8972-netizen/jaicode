# AI 编程 Agent CLI 工具 — PRD 补充：可交互终端界面

| 文档信息 | 内容 |
|---|---|
| 产品名称 | Jaicode |
| 文档版本 | V1.1（补充版） |
| 关联文档 | 《市场分析与产品定位PRD》《架构设计PRD》《功能设计PRD》《业务流程设计PRD》 |
| 本版核心调整 | 明确产品形态为类 Claude Code 的**可下载可运行独立交互界面**，而非传统 CLI 工具 |

---

## 1. 产品定位再明确

### 1.1 产品形态

Jaicode 的最终交付物是一个**可下载、可直接运行的独立终端交互应用**，对标 Claude Code 的产品体验：

| 对标产品 | 形态 | 运行方式 |
|---|---|---|
| Claude Code | `npm install -g @anthropic-ai/claude-code` → `claude` | 终端交互式 TUI |
| Codex CLI | `npx @openai/codex` 或二进制下载 | 终端交互式 TUI |
| **Jaicode** | `npm install -g @jaicode/cli` 或二进制下载 | 终端交互式 TUI |

### 1.2 核心体验要求

用户运行 `jaicode`（或双击应用）后，进入**沉浸式终端交互界面**：

1. **启动即进入交互模式** — 不需要输入子命令（如 `jaicode code "..."`）
2. **自然语言即指令** — 用户直接输入意图，AI 自动识别并执行
3. **对话式协作** — 支持后续追问、修正、确认，上下文保持连续性
4. **文件操作可视化** — AI 修改文件后展示 Diff，用户确认后应用
5. **跨会话记忆** — 记住用户偏好、项目上下文、历史操作习惯

---

## 2. TUI 交互界面规格

### 2.1 启动流程

```
用户执行 `jaicode` 或双击应用
      │
      ▼
┌─────────────────────────────────────────┐
│  Jaicode v0.1.0 启动画面                 │
│  ─────────────────────────               │
│  ✓ 检测到项目 /path/to/project           │
│  ✓ 加载项目上下文 (.jaicode/project.yaml) │
│  ✓ 加载用户画像 (user.profile)            │
│  ✓ Provider: Anthropic (claude-sonnet-4)  │
│                                          │
│  输入 /help 查看命令 · Ctrl+C 退出        │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│  交互主界面（对话模式）                    │
│  ─────────────────────────               │
│                                          │
│  [项目上下文摘要]                          │
│                                          │
│  ❯ 用户输入自然语言...                    │
│                                          │
└─────────────────────────────────────────┘
```

### 2.2 主交互界面布局

```
┌──────────────────────────────────────────────────────────┐
│ ⬡ Jaicode v0.1.0 │ /path/to/project │ code mode          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ❯ Fix the login bug where user.token can be undefined   │
│                                                          │
│  ⬡ Jaicode · 2.3s                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Reading src/auth/login.ts...                       │  │
│  │ Found: user.token.value at line 13                 │  │
│  │ Fix: optional chaining + nullish coalescing        │  │
│  │                                                    │  │
│  │ 📝 src/auth/login.ts                              │  │
│  │ + 13 │ return user?.token?.value ?? null;          │  │
│  │ - 13 │ return user.token.value;                   │  │
│  │                                                    │  │
│  │ Apply this change? [y/N/e(dit)]                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ ● READY | plan/code/debug/ask | Anthropic | zh/en | 12ms │
└──────────────────────────────────────────────────────────┘
```

### 2.3 交互行为规格

| 行为 | 说明 |
|---|---|
| **自然语言识别** | 用户输入自动分类为 Plan/Code/Debug/Ask 意图，无需切换模式命令 |
| **文件操作展示** | AI 建议的文件变更以 Diff 形式展示，绿色新增/红色删除 |
| **确认机制** | 写文件前必须用户确认（y/N），支持 `e` 编辑变更内容 |
| **追问支持** | AI 回复后用户可直接追问，保持上下文连续性 |
| **中断操作** | 任意时刻 Ctrl+C 可中断当前操作 |
| **自动模式切换** | 根据输入内容自动推断最佳模式（"修复bug" → debug, "解释代码" → ask） |
| **项目上下文** | 启动时自动读取项目类型、框架、目录结构、已有的 .jaicode/project.yaml |
| **状态栏** | 始终显示：连接状态、当前模式、Provider、语言、响应延迟 |

### 2.4 快捷键定义

| 快捷键 | 行为 |
|---|---|
| `Ctrl+C` | 中断当前操作 / 退出 |
| `Ctrl+D` | 退出会话 |
| `Ctrl+L` | 清屏 |
| `Ctrl+P` | 切换 Provider |
| `Tab` | 自动补全（命令/路径） |
| `↑/↓` | 浏览输入历史 |
| `/` 前缀 | 内置命令（/help, /mode, /clear, /config） |

---

## 3. 自然语言理解（NLU）层

### 3.1 意图分类

用户输入的自然语言将被自动分类：

| 意图类别 | 触发关键词 | 对应模式 |
|---|---|---|
| 设计/方案 | "设计"、"架构"、"方案"、"plan for"、"design" | Architect |
| 代码修改 | "修复"、"添加"、"修改"、"fix"、"add"、"implement"、"write" | Code |
| 调试/修复 | "报错"、"不工作"、"debug"、"broken"、"test failed" | Debug |
| 问答/解释 | "解释"、"什么"、"为什么"、"explain"、"what"、"how" | Ask |
| 自动化 | "批量"、"所有文件"、"refactor all"、"batch" | Plan → Code |

### 3.2 上下文感知

- **当前文件上下文**：打开/编辑过的文件自动加载到上下文
- **项目结构摘要**：启动时扫描项目并构建摘要（不超过 500 行 tokens）
- **会话历史**：当前会话的消息链全部作为上下文传递给 LLM
- **用户偏好**：语言偏好、输出风格、代码风格从 UserProfile 加载

---

## 4. 可下载可运行交付规格

### 4.1 目标平台

| 平台 | 交付格式 | 安装方式 | 文件大小目标 |
|---|---|---|---|
| macOS (Apple Silicon) | 二进制 + .app | 下载直接运行 | <50MB |
| macOS (Intel) | 二进制 + .app | 下载直接运行 | <50MB |
| Windows 10/11 | .exe 可执行文件 | 双击运行 | <60MB |
| Linux x64 | 二进制 | 下载直接运行 | <50MB |

### 4.2 技术方案

由于 Bun 运行时在 Apple M5 芯片上存在兼容性问题，TUI 层采用**纯 Node.js 原生实现**：

| 技术选型 | 说明 |
|---|---|
| 运行时 | Node.js 18+（原生支持所有平台） |
| 终端渲染 | chalk（ANSI 色彩）+ readline（输入处理） |
| TUI 布局 | 自绘终端 UI（不需要 React/Ink） |
| 构建工具 | Node SEA（Single Executable Application）或自包装 |
| 包格式 | macOS 单二进制 + Windows .exe + npm 全局安装 |

### 4.3 运行方式

```bash
# 方式 1：npm 全局安装（推荐）
npm install -g @jaicode/cli
jaicode

# 方式 2：直接下载二进制运行
# macOS
curl -LO https://github.com/jonasjiang8972-netizen/jaicode/releases/download/v0.1.0/jaicode-macos
chmod +x jaicode-macos
./jaicode-macos

# Windows
# 下载 jaicode-win.exe 后双击运行

# 方式 3：macOS .app
# 下载 Jaicode.app.zip → 解压 → 双击运行
```

---

## 5. 与现有功能的保留关系

本期新增的 TUI 交互界面**不替代**现有 CLI 命令能力，而是作为上层封装：

- CLI 命令（`jaicode plan/code/debug/ask`）仍可用于脚本/CI 场景
- TUI 交互界面对应这些模式的终端用户友好版本
- Skills/Marketplace/MCP 能力对 TUI 和 CLI 均可用

---

## 6. 验收标准（TUI 部分）

- [ ] 运行 `jaicode` 直接进入交互界面（无需子命令）
- [ ] 输入自然语言自动识别意图并响应
- [ ] AI 回复流式展示（逐字出现）
- [ ] AI 建议的文件变更有彩色 Diff 展示和确认流程
- [ ] 会话内上下文持续记忆（追问有效）
- [ ] Ctrl+C 可中断任意操作
- [ ] macOS M1/M2/M3/M4/M5 均可运行
- [ ] Windows 10/11 双击 .exe 即可运行
- [ ] API Key 首次未配置时引导用户配置
- [ ] 断网时优雅降级（非 LLM 操作正常）
- [ ] 支持中英文界面根据 UserProfile 自动切换

---

*本补充 PRD 是对已有 PRD 体系的关键修订，将产品定位从"CLI 工具子命令"调整为"可下载可运行的独立交互应用"，与 Claude Code / Codex CLI 在同一竞争品类中。*
