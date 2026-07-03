# Jaicode

> 面向隐私敏感型企业与中英双语开发团队的本地优先终端 AI 编程 Agent

Jaicode 是一个 CLI-first 的 AI 编程工具，通过自然语言交互辅助开发者完成代码编写、调试、重构等开发任务。代码不出本地设备，授权可离线激活，中英文体验完全对等。

---

## 核心定位

- **本地优先** — 所有代码与文件操作均在本地完成，除 LLM API 外无外部服务依赖
- **终端原生 CLI** — 不依赖特定 IDE，可在任意终端/CI 流水线中运行
- **多模型开放** — 不限制接入的 AI 大模型来源，支持 BYOK、多 Provider 同任务切换
- **中英双语** — 终端交互与 AI Prompt 语言 100% 对齐
- **AI Marketplace** — 本地 agents/MCP/skills 扩展市场，增强 Agent 能力

---

## 快速开始

```bash
# 安装
brew install jaicode/tap/jaicode        # macOS
npm install -g @jaicode/cli             # 通用

# 初始化配置（首次使用引导）
jaicode init

# 设置 API Key（支持多 Provider）
jaicode config --provider anthropic --api-key sk-xxx
jaicode config --provider openai --api-key sk-xxx

# 执行任务
jaicode code "修复登录接口空指针异常"
jaicode debug "npm test"
jaicode plan "设计用户认证模块"
jaicode ask "解释这段代码的作用"

# Marketplace
jaicode market list                    # 查看已安装扩展
jaicode market search code-review      # 搜索扩展
jaicode market install my-skill        # 安装扩展
```

---

## 用户信息与个性化

Jaicode 通过本地用户画像实现个性化体验，所有数据存储在 `~/.jaicode/` 中，**不上传任何云端**。

### 用户信息档案（~/.jaicode/user.profile）

记录用户的基本信息、编码习惯和偏好，使 Agent 输出更贴合个人风格：

- **基本信息** — 开发者角色、技术栈、常用语言
- **编码习惯** — 命名风格、注释偏好、代码组织结构
- **工具偏好** — 框架选择、测试方式、构建工具
- **输出风格** — 回复详略程度、语言（中/英）、技术深度

### 项目级配置（.jaicode/project.yaml）

针对单个项目的特定要求和上下文信息：

- **项目架构** — 技术栈、目录约定、核心模块说明
- **编码规范** — Lint 规则、命名约定、文件组织方式
- **业务上下文** — 领域模型、核心流程、关键约束
- **自定义指令** — 项目特定的 Agent 行为要求

### 可自定义文档输出

- **ADR 模板** — 自定义架构决策记录格式
- **Commit 模板** — 代码提交信息格式规范
- **注释模板** — 文件头/函数注释的生成格式
- **输出详略** — 控制 AI 回复的信息密度

### 习惯学习

Jaicode 在使用过程中自动积累偏好数据：
- 常修改的文件类型和模式
- 常用的命令和工具链
- 偏好的代码风格和重构方式
- 高频技术问题和解决方案

---

## Agent 模式

| 模式 | 命令 | 权限 | 说明 |
|---|---|---|---|
| Architect | `plan` | 只读 | 生成技术方案、架构决策记录 |
| Code | `code` | 读写 | 代码修改 + Diff 确认 |
| Debug | `debug` | 读写+执行 | 自动修复循环（含重试上限） |
| Ask | `ask` | 只读 | 纯问答，无文件权限 |

---

## AI Marketplace

### 本地市场

扫描和管理本地已安装的扩展：

- **Agents** — 自定义 Agent 模式（如 `security-audit`、`api-designer`）
- **MCP Servers** — 工具服务扩展（如 `github`、`database`、`docker`）
- **Skills** — 技能包（如 `commit-message`、`code-review`、`changelog`）

### 远程市场（二期预留接口）

架构已预留远程 Registry 接口，未来可接入第三方扩展源而无需修改核心代码。

---

## LLM Provider 支持

Jaicode **不限制 AI 大模型来源**，开放接入任意兼容 API：

| Provider | 说明 |
|---|---|
| Anthropic | Claude 系列 |
| OpenAI | GPT 系列 |
| Google | Gemini 系列 |
| DeepSeek | DeepSeek 系列 |
| 智谱 AI | GLM 系列 |
| 本地模型 | Ollama / vLLM 等私有部署 |
| 其他 | OpenAI-compatible API 均可 |

---

## 跨平台支持

| 平台 | 安装方式 |
|---|---|
| macOS | `brew install` |
| Windows | 直接下载 exe |
| Linux | npm / 直接下载二进制 |

---

## 项目结构

```
jaicode/
├── .jaicode/              # 项目级配置
│   ├── project.yaml       # 项目特定配置
│   └── agents/            # 项目级自定义 Agent
├── .kilo/                 # Kilo 配置目录
│   ├── agent/             # Agent 定义
│   ├── command/           # 自定义命令
│   └── skill/             # 技能包
├── prd/                   # 产品需求文档归档
├── src/                   # 源代码
├── docs/                  # 开发文档
└── tests/                 # 测试文件
```

---

## 数据安全与隐私

- 所有用户数据存储于 `~/.jaicode/`，**零云端上传**
- API Key 本地 AES 加密存储，不依赖授权令牌
- 日志仅本地留存，不记录用户代码内容全文
- 断网环境下核心 Agent 功能完整可用（LLM 调用除外）

---

## 路线图

| 阶段 | 目标 | 状态 |
|---|---|---|
| Phase 1 | 核心 Agent 闭环 + 多 Provider + Marketplace（本地）+ 个性化 | 本期开发 |
| Phase 2 | 远程 Marketplace + 授权系统 + Web 控制台 | 二期 |
| Phase 3 | 离线企业私有化 + 团队授权 | 三期 |

---

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **架构**: Effect（函数式 Effect 系统）
- **TUI**: SolidJS + OpenTUI
- **包管理**: Bun workspaces + Turborepo

---

*Jaicode — 你的代码，你的 AI，你的选择。*
