# Jaicode

> 面向隐私敏感型企业与中英双语开发团队的本地优先 AI 编程 Agent

Jaicode 是一个开源的本地优先 AI 编程助手，提供终端 TUI、桌面应用和 IDE 扩展三种交互方式。代码不出本地设备，支持中英双语 100% 对齐，不限制 AI 模型来源。

---

## 产品形态

| 形态 | 技术栈 | 平台 | 安装方式 |
|---|---|---|---|
| **桌面应用** | Tauri + Go | macOS / Windows / Linux | 直接下载 .app/.exe |
| **终端 CLI** | Go / TypeScript | 全平台 | 二进制 / npm |
| **IDE 扩展** | TypeScript | VS Code / JetBrains | 扩展市场 |

---

## 核心定位

- **本地优先** — 所有代码与文件操作均在本地完成，除 LLM API 外无外部服务依赖
- **终端原生 CLI** — 不依赖特定 IDE，可在任意终端/CI 流水线中运行
- **多模型开放** — 不限制接入的 AI 大模型来源，支持 BYOK、多 Provider 同任务切换
- **中英双语** — 终端交互与 AI Prompt 语言 100% 对齐
- **跨平台** — Apple Silicon (M1-M5)、Intel Mac、Windows 10/11、Linux 全支持

---

## 快速开始

### 桌面应用（推荐）

```bash
# macOS / Linux
curl -fsSL https://jaicode.ai/install.sh | bash

# Windows
iwr -useb https://jaicode.ai/install.ps1 | iex
```

安装后启动 Jaicode，首次使用引导你配置 LLM Provider。

### 终端 CLI

```bash
# Go 二进制（推荐，<5MB）
curl -LO https://github.com/jonasjiang8972-netizen/jaicode/releases/latest/download/jaicode-macos
chmod +x jaicode-macos
./jaicode-macos

# 源码运行
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode
bun install
node packages/tui-node/src/index.js
```

### 首次启动

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

## 能力总览

### 核心能力

| 能力 | 说明 |
|---|---|
| 4 种 Agent 模式 | Plan（架构）、Code（编写）、Debug（修复）、Ask（问答） |
| 多 Provider | Anthropic / OpenAI / DeepSeek / 智谱 / 自定义中转 |
| 文件安全沙箱 | 写入前自动备份，支持一键回滚 |
| 中英双语 | 终端 UI 与 AI 回复语言自动对齐 |
| 用户画像 | 自动学习编码习惯，个性化 Agent 行为 |
| 项目记忆 | 自动扫描项目结构，持久化上下文 |
| 思考过程 | 实时展示模型推理过程 |

### 开发工具

| 能力 | 说明 |
|---|---|
| Git 集成 | status / diff / commit / branch / log / PR |
| Shell 执行 | 安全执行命令，危险命令黑名单 |
| MCP 协议 | 连接外部工具服务器扩展能力 |
| Hooks | 编辑/提交前后自动执行自定义命令 |
| Marketplace | Skills / Agents / MCP 本地扩展市场 |
| 上下文压缩 | Token 超限时自动摘要，保持对话连贯 |
| 知识时效 | 检测时间敏感问题，提示知识截止日期 |

### 桌面版专属

| 能力 | 说明 |
|---|---|
| 文件拖拽 | 将文件拖入对话自动分析 |
| 图片粘贴 | 截图粘贴后 VL 模型理解 |
| 全局快捷键 | 任意位置唤起 Jaicode |
| 系统托盘 | 最小化到托盘，随时唤醒 |
| 多窗口 | 多项目并行，独立会话 |
| 自动更新 | 后台检测，一键升级 |

---

## Agent 模式

| 模式 | 命令/快捷键 | 权限 | 适用场景 |
|---|---|---|---|
| **Plan** | `plan` / `Ctrl+P` | 只读 | 技术方案设计、架构分析 |
| **Code** | `code` / `Ctrl+C` | 读写 | 代码编写、修改、重构 |
| **Debug** | `debug` / `Ctrl+D` | 读写+执行 | Bug 修复、测试运行 |
| **Ask** | `ask` / `Ctrl+A` | 只读 | 技术问答、代码解释 |

---

## 项目结构

```
jaicode/
├── README.md                    # 本文档
├── LICENSE                      # Apache 2.0
├── USER_GUIDE.md                # 用户使用手册
├── VERSION_POLICY.md            # 版本策略
├── MIGRATION_PLAN.md            # 迁移路线图
├── THIRD_PARTY_NOTICES.txt      # 第三方声明
├── desktop-app/                 # Tauri 桌面应用
│   ├── src/                     # 前端 (SolidJS)
│   ├── src-tauri/               # Tauri (Rust)
│   └── backend/                 # Go 后端 (桌面版)
├── backend-go/                  # Go 后端 (CLI/服务)
│   ├── cmd/jaicode-desktop/     # 入口
│   ├── internal/                # 核心模块
│   └── pkg/                     # 公共库
├── packages/
│   ├── tui-node/                # TypeScript TUI
│   ├── cli/                     # CLI 入口
│   ├── core/                    # 核心模块
│   ├── llm/                     # LLM Provider 适配
│   ├── i18n/                    # 国际化
│   └── marketplace/             # 扩展市场
├── prd/                         # 产品需求文档
├── consulting/                  # 咨询记录
└── .jai/                        # Agent 与命令定义
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 桌面 GUI | Tauri v2 + SolidJS | 轻量原生应用 |
| 后端服务 | Go 1.22 | 单二进制，跨平台 |
| 终端 TUI | Ink (React for CLI) | 终端交互 |
| LLM 适配 | 多 Provider | Anthropic/OpenAI/自定义 |
| 国际化 | 中英双语 | 可扩展至多语言 |
| 构建 | Bun + Go build | 快速编译 |

---

## 版本号规则

```
v{major}.{minor}.{patch}

- patch: bug 修复 (0.15.0 → 0.15.1)
- minor: 新功能   (0.15.0 → 0.16.0)
- major: 架构变更 (0.x.x → 1.0.0)

禁止跳号，每次只递增一个位置。
```

当前版本：**v1.0.0**（桌面版正式发布）

---

## 数据安全与隐私

- 所有用户数据存储于 `~/.jaicode/`，**零云端上传**
- API Key 本地 AES 加密存储
- 日志仅本地留存，不记录用户代码内容
- 断网环境下核心 Agent 功能完整可用（LLM 调用除外）
- 危险命令黑名单 + 写入前确认机制

---

## 路线图

| 阶段 | 目标 | 状态 |
|---|---|---|
| Phase 1 | 核心 Agent 闭环 + 多 Provider + 个性化 | ✅ 完成 |
| Phase 2 | 安全加固 + 文件处理 + 上下文智能 | ✅ 完成 |
| Phase 3 | 桌面应用 (Tauri) + Go 后端 | ✅ 完成 |
| Phase 4 | IDE 扩展 (VS Code / JetBrains) | 🔜 规划中 |
| Phase 5 | 团队协作 + 授权系统 | 🔜 规划中 |

---

## 贡献指南

```bash
# 克隆
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode

# 安装依赖
bun install

# 开发模式
bun run packages/tui-node/src/index.js

# 构建 Go 后端
cd backend-go && go build -o bin/jaicode-server cmd/jaicode-desktop/main.go

# 构建桌面应用
cd desktop-app && cargo tauri build
```

---

## 许可证

Apache License 2.0 — 详见 [LICENSE](./LICENSE)

第三方组件声明 — 详见 [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt)

---

*Jaicode — 你的代码，你的 AI，你的选择。*
