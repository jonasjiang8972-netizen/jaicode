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

## 快速开始

```bash
# 克隆项目
git clone https://github.com/jonasjiang8972-netizen/jaicode.git
cd jaicode

# 安装 & 运行
bun install
bun run packages/tui-node/src/index.js

# 首次启动会引导你配置 LLM Provider
```

## 项目结构

```
jaicode/
├── backend-go/          # Go 后端服务（跨平台二进制 <5MB）
├── desktop-app/         # Tauri 桌面应用（Go + SolidJS）
├── consulting/          # 会话纪要与决策记录
├── packages/
│   ├── tui-node/        # TypeScript 终端 TUI
│   ├── core/            # 核心模块（安全/存储/加密/日志）
│   ├── llm/             # LLM Provider 适配（多厂商）
│   ├── i18n/            # 中英双语引擎
│   └── marketplace/     # Skills / MCP / Agents 扩展市场
├── prd/                 # 产品需求文档（14 份）
└── .jai/                # Agent 与命令定义
```

## Agent 模式

| 模式 | 权限 | 适用场景 |
|------|------|----------|
| **Plan** | 只读 | 架构设计与技术方案 |
| **Code** | 读写 | 代码编写与修改 |
| **Debug** | 读写+执行 | Bug 自动修复循环 |
| **Ask** | 只读 | 纯问答 |

## 桌面应用（预览版）

```bash
# 进入桌面应用目录
cd desktop-app

# 安装依赖
bun install

# 开发模式
cargo tauri dev

# 构建发布版
cargo tauri build
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Go 1.22 | 高性能、单二进制、跨平台 |
| 前端 | TypeScript + Ink (终端) / SolidJS (桌面) | 终端与 GUI 双形态 |
| 运行时 | Node.js 18+ / Bun 1.3+ | 快速开发与执行 |
| 通信 | HTTP + SSE 流式 | 实时 AI 响应 |

## 快速启动示例

```bash
# 进入你的项目目录
cd /your/project

# 启动 Jaicode
node /path/to/jaicode/packages/tui-node/src/index.js

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

## 命令参考

| 命令 | 说明 |
|------|------|
| `/help` | 查看所有命令 |
| `/read <文件>` | 读取项目文件 |
| `/exec <命令>` | 执行 Shell 命令 |
| `/git status` | 查看 Git 状态 |
| `/git commit <msg>` | 提交代码 |
| `/image <路径>` | AI 分析图片 |
| `/hooks` | 管理自动化钩子 |
| `/stats` | 用量统计 |
| `/quit` | 退出 |

## 版本策略

`v{major}.{minor}.{patch}` — 每次只递增一位，禁止跳号。

| 分支 | 后端 | 当前版本 |
|------|------|----------|
| `main` | TypeScript TUI | v0.13.0 |
| `feat/go-backend` | Go | v0.15.0 |
| `feat/desktop` | Go + Tauri | v1.0.0（预览） |

## 能力对比

| 能力 | Jaicode | Claude Code | Codex CLI |
|------|---------|-------------|-----------|
| 终端原生 CLI | ✅ | ✅ | ✅ |
| 中文支持 | ✅ 完整 | 部分 | ❌ |
| 离线/本地优先 | ✅ | ❌ | ❌ |
| 多模型自由切换 | ✅ | ❌ | ❌ |
| BYOK（自带密钥） | ✅ | 部分 | ✅ |
| 买断制授权 | ✅ 预留 | ❌ | ❌ |
| 开源 | ✅ Apache 2.0 | ❌ | 部分 |

## 许可证

Apache License 2.0 — 详见 [LICENSE](./LICENSE)

第三方组件声明 — [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt)

## 致谢

本项目在开发过程中参考了 [Kilo Code](https://github.com/Kilo-Org/kiloocode)（现 Anthropic 旗下产品）的架构设计。Jaicode 是一个独立衍生的开源项目，与 Kilo Code / Anthropic 无隶属关系。

---

*Jaicode — 你的代码，你的 AI，你的选择。*

*文档与源码同步维护。详情请参阅 [USER_GUIDE.md](./USER_GUIDE.md)。*
