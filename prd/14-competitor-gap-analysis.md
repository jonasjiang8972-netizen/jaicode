# Jaicode vs Codex CLI vs Claude Code 差距分析

## 一、产品形态对比

| 维度 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| **运行时** | Node.js | Rust | Node.js + Ink |
| **分发方式** | npm / bun | 单二进制 (curl 安装) | npm / 原生安装器 |
| **多端支持** | 终端 TUI | 终端 TUI | 终端 + IDE + 桌面 + Web + 移动 |
| **安装体验** | `bun install` 后手动运行 | `curl | sh` 一键安装 | `curl | sh` 一键安装 |
| **自动更新** | ❌ 手动 git pull | ✅ 原生自动更新 | ✅ 原生自动更新 |
| **首次启动** | 需手动配置 Provider | 登录 ChatGPT 账户 | 登录 Anthropic 账户 |

---

## 二、核心能力差距

### 文件操作

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| 读取文件 | ✅ 路径检测 + 直接读取 | ✅ 自动读取 | ✅ 自动读取 |
| 写入文件 | ❌ 仅建议 | ✅ 自动写入 | ✅ 自动写入 + Diff 确认 |
| 编辑文件 | ❌ 仅建议 | ✅ 精准编辑 | ✅ 精准编辑 |
| Diff 展示 | ✅ 基础彩色 Diff | ✅ 高级 Diff | ✅ 行内 Diff |
| 多文件并行 | ❌ 单文件 | ✅ 多文件并行 | ✅ 多文件并行 |
| 图片理解 | 🟡 框架无 Provider | ✅ GPT-4V | ✅ Claude Vision |
| PDF/Office | 🟡 框架无解析器 | ❌ 不支持 | ✅ 部分支持 |

### Git 集成

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| git status/diff | ✅ 通过 exec 执行 | ✅ 原生集成 | ✅ 原生集成 |
| git commit | ✅ 通过 Skill 建议 | ✅ 自动提交 | ✅ 自动提交 |
| git branch | ❌ 不支持 | ✅ 原生集成 | ✅ 原生集成 |
| Pull Request | ❌ 不支持 | ✅ gh CLI 集成 | ✅ gh CLI 集成 |
| Merge Conflict | ❌ 不支持 | ✅ 自动解决 | ✅ 自动解决 |
| Code Review | 🟡 手动 Skill | ✅ Review 模式 | ✅ Review 配置 |

### LLM 能力

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| 流式输出 | ✅ 逐字符 | ✅ 逐字符 | ✅ 逐字符 |
| 模型切换 | ✅ 多 Provider | ✅ 多模型 | ✅ 多模型 |
| 上下文窗口 | ⚠️ 无限制（易溢出） | ✅ 智能压缩 | ✅ 智能压缩 |
| 思考链 | ✅ 显示中 | ✅ 高级显示 | ✅ 高级显示 |
| Prompt 缓存 | ❌ 无 | ✅ 内置 | ✅ 内置 |
| 多 Provider | ✅ 核心优势 | ❌ 仅 OpenAI | ⚠️ Anthropic + 第三方 |

### 交互体验

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| 终端 TUI | ✅ 基础 | ✅ 高级 | ✅ 高级 |
| 输入历史 | ✅ 已实现 | ✅ 完整 | ✅ 完整 |
| Tab 补全 | 🟡 基础 | ✅ 高级 | ✅ 高级 |
| 命令系统 | ✅ /commands | ✅ /commands | ✅ /commands |
| 进度条 | 🟡 基础 | ✅ 高级 | ✅ 高级 |
| 错误恢复 | 🟡 基础 | ✅ 高级 | ✅ 高级 |
| 会话恢复 | ❌ 无 | ✅ 完整 | ✅ 完整 |

---

## 三、架构能力差距

### 安全架构

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| 权限分级 | ✅ L0-L4 分级 | ✅ 沙箱执行 | ✅ 权限确认系统 |
| 文件沙箱 | 🟡 路径限制 | ✅ 完全沙箱 | ✅ 目录限制 |
| Prompt 注入防护 | ✅ 已实现 | ✅ 内置 | ✅ 内置 |
| 执行确认 | ✅ 逐次确认 | ✅ 分级确认 | ✅ 分级确认 |
| 审计日志 | ✅ JSONL | ✅ 高级日志 | ✅ 高级日志 |

### 扩展架构

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| MCP 集成 | 🟡 框架已实现 | ✅ 完整 | ✅ 完整 |
| Skills/Plugins | ✅ Marketplace | ❌ 有限 | ✅ 完整 |
| Hooks 系统 | ❌ 无 | ❌ 有限 | ✅ 完整 |
| IDE 扩展 | ❌ 仅终端 | ✅ VS Code/Cursor | ✅ VS Code/JetBrains/API |
| API 接口 | ✅ HTTP API | ❌ 无 | ✅ SDK |
| Sub-agents | ❌ 无 | ✅ 后台 agents | ✅ 完整 |

### 记忆系统

| 能力 | Jaicode | Codex CLI | Claude Code |
|---|---|---|---|
| 会话内记忆 | ✅ 消息链 | ✅ 完整 | ✅ 完整 |
| 跨会话记忆 | 🟡 JSONL 持久化 | ✅ 高级 | ✅ CLAUDE.md + Auto Memory |
| 项目记忆 | 🟡 memory.yaml | ❌ 无 | ✅ CLAUDE.md |
| 用户偏好 | ✅ user.profile | ✅ 设置文件 | ✅ 设置文件 |
| 行为学习 | 🟡 基础 | ✅ 高级 | ✅ Auto Memory |

---

## 四、关键缺失项（按优先级）

### P0 — 必须立即补齐（产品可用性）

| # | 缺失项 | 影响 | 工作量 |
|---|---|---|---|
| 1 | **文件自动写入** | AI 只能建议不能修改文件，核心体验缺失 | 3 天 |
| 2 | **会话恢复** | 断连后所有上下文丢失 | 2 天 |
| 3 | **安装器体验** | 没有一键安装脚本 | 1 天 |
| 4 | **自动更新** | 用户永远停留在旧版本 | 2 天 |

### P1 — 短期补齐（功能完整性）

| # | 缺失项 | 影响 | 工作量 |
|---|---|---|---|
| 5 | **Git 原生集成** | 无法自动 commit/branch/PR | 3 天 |
| 6 | **MCP Server 完整接入** | 无法连接外部工具生态 | 3 天 |
| 7 | **子 Agent / 并行执行** | 无法同时处理多个任务 | 5 天 |
| 8 | **上下文压缩** | 长对话会超出 token 限制 | 2 天 |
| 9 | **Diff 行内确认** | 无法在终端中确认代码变更 | 2 天 |

### P2 — 中期补齐（产品竞争力）

| # | 缺失项 | 影响 | 工作量 |
|---|---|---|---|
| 10 | **Hooks 系统** | 无法自动化格式化/lint/测试 | 3 天 |
| 11 | **IDE 扩展 (VS Code)** | 无法在编辑器中使用 | 7 天 |
| 12 | **桌面应用** | 无法提供 GUI 体验 | 14 天 |
| 13 | **Chrome 集成** | 无法调试 Web 应用 | 5 天 |
| 14 | **Slack/Dispatch 集成** | 无法从聊天工具触发 | 3 天 |

---

## 五、详细实现方案

### P0-1: 文件自动写入

```
当前状态：AI 生成代码建议 → 用户手动复制粘贴

目标状态：AI 生成代码 → Diff 展示 → 用户确认 → 自动写入

实现：
1. 在 Code 模式响应中解析 FILE: 格式
2. 生成 unified diff
3. 展示 diff 并等待用户确认 (y/N/e)
4. 确认后调用 fs.writeFileSync
5. 自动备份到 .jaicode_backup/
```

### P0-2: 会话恢复

```
启动时检查 ~/.jaicode/sessions/{pid}.json
  ├─ 存在 → 询问用户是否恢复
  │   ├─ 是 → 加载历史消息 → 继续会话
  │   └─ 否 → 清理旧会话 → 新会话
  └─ 不存在 → 新会话
```

### P0-3: 安装器

```bash
# install.sh (macOS/Linux)
curl -fsSL https://jaicode.ai/install.sh | bash

# 安装逻辑：
# 1. 检测平台 (darwin/linux/windows)
# 2. 检测 Node.js >= 18 (没有则安装)
# 3. 下载最新 release 包
# 4. 解压到 ~/.jaicode/
# 5. 创建 symlink: /usr/local/bin/jaicode → ~/.jaicode/bin/jaicode
# 6. 验证安装
```

---

## 六、版本规划（对齐竞品）

| 版本 | 目标 | 核心交付 |
|---|---|---|
| v0.11.0 | **文件写入** | Diff 确认 + 自动写入 + 备份回滚 |
| v0.12.0 | **会话恢复** | PID 文件 + 恢复提示 + 上下文重建 |
| v0.13.0 | **MCP 完整接入** | 协议实现 + 服务器管理 + 工具路由 |
| v0.14.0 | **Git 原生集成** | commit/diff/branch/PR 全功能 |
| v0.15.0 | **安装器 + 自动更新** | install.sh + 更新检查 + 后台升级 |
| v0.16.0 | **Hooks 系统** | pre/post 格式化、lint、测试 |
| v0.17.0 | **子 Agent** | 并行任务执行 + 结果合并 |
| v0.18.0 | **IDE 扩展** | VS Code 插件 + JetBrains 插件 |
| v1.0.0 | **正式版** | 全能力对齐竞品 |

---

*本文档为 Jaicode vs Codex/Claude Code 差距分析与追赶路线图。*
