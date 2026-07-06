# Jaicode 用户使用手册

> 版本：v0.15.2 | 最后更新：2026-07-06

---

## 目录

1. [安装](#1-安装)
2. [首次配置](#2-首次配置)
3. [终端 CLI](#3-终端-cli)
4. [Agent 模式](#4-agent-模式)
5. [命令参考](#5-命令参考)
6. [快捷键](#6-快捷键)
7. [多 Provider 配置](#7-多-provider-配置)
8. [文件操作](#8-文件操作)
9. [Skills 系统](#9-skills-系统)
10. [故障排除](#10-故障排除)

---

## 1. 安装

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
cd jaicode/backend-go
go build -o jaicode-server cmd/jaicode-desktop/main.go
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

## 2. 首次配置

启动 Jaicode 后，首次使用会引导你选择 LLM Provider：

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

## 3. 终端 CLI

### 启动

```bash
# 在当前项目目录启动
cd /your/project
node /path/to/jaicode/packages/tui-node/src/tui.js
```

### 终端快捷键

| 快捷键 | 行为 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift+Enter` | 换行 |
| `↑↓` | 浏览历史输入 |
| `Tab` | 自动补全 |
| `Ctrl+C` | 中断/退出 |
| `Ctrl+L` | 清屏 |

---

## 4. Agent 模式

| 模式 | 权限 | 适用场景 |
|------|------|----------|
| **Plan** | 只读 | 架构设计与技术方案 |
| **Code** | 读写 | 代码编写与修改 |
| **Debug** | 读写+执行 | Bug 自动修复循环 |
| **Ask** | 只读 | 纯问答 |

按 `Ctrl+M` 循环切换模式。

---

## 5. 命令参考

### 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示所有命令 |
| `/quit` | 退出 |
| `/clear` | 清屏 |
| `/mode` | 切换模式 |
| `/config` | 配置管理 |
| `/stats` | 用量统计 |

### 文件命令

| 命令 | 说明 |
|------|------|
| `/read <文件>` | 读取文件内容 |
| `/exec <命令>` | 执行 Shell 命令 |
| `/rollback` | 恢复最近一次文件备份 |

### Git 命令

| 命令 | 说明 |
|------|------|
| `/git status` | 查看 Git 状态 |
| `/git log` | 查看提交历史 |
| `/git branch` | 查看分支 |
| `/git commit <msg>` | 提交代码 |

### Skills 命令

| 命令 | 说明 |
|------|------|
| `/skill commit` | 语义化 Git 提交 |
| `/skill review` | 代码审查 |
| `/skill spellcheck` | Markdown 拼写检查 |
| `/skill changelog` | 生成变更日志 |
| `/skill rmslop` | 清理 AI 冗余代码 |
| `/skill translate` | 多语言文档翻译 |
| `/skill issues` | 搜索 GitHub Issues |
| `/skill learn` | 提取会话知识到项目配置 |

---

## 6. 快捷键

| 快捷键 | 行为 |
|--------|------|
| `Enter` | 发送 |
| `Shift+Enter` | 换行 |
| `↑↓` | 输入历史 |
| `Tab` | 自动补全 |
| `Ctrl+C` | 中断/退出 |
| `Ctrl+L` | 清屏 |
| `Ctrl+M` | 切换模式 |

---

## 7. 多 Provider 配置

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
# 在 TUI 中
/config --provider openai

# 或设置环境变量
export JAICODE_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 8. 文件操作

### 读取文件

```
❯ /read package.json
📄 package.json (json, 45 lines):
{
  "name": "my-project",
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

## 9. Skills 系统

### 内置 Skills

| Skill | 命令 | 功能 |
|-------|------|------|
| commit | `/skill commit` | 语义化 Git 提交（自动前缀） |
| code-review | `/skill review` | 代码审查（Bug/安全/质量） |
| spellcheck | `/skill spellcheck` | Markdown 拼写检查 |
| changelog | `/skill changelog` | 从 commits 生成变更日志 |
| rmslop | `/skill rmslop` | 清理 AI 生成的冗余代码 |
| translate | `/skill translate` | 多语言文档翻译 |
| issues | `/skill issues` | 搜索 GitHub Issues |
| learn | `/skill learn` | 提取会话知识到项目配置 |

### 运行 Skill

```
❯ /skill review

[code-review] 正在审查当前变更...
  ✓ 无安全漏洞
  ⚠ src/auth/login.ts:13 - 建议添加空值检查
  ✓ 代码风格一致
```

---

## 10. 故障排除

| 问题 | 解决方案 |
|------|----------|
| `command not found: jaicode` | 使用源码方式运行：`node packages/tui-node/src/tui.js` |
| `No API Key configured` | 运行 `/config` 配置 Provider |
| `API error: 401` | 检查 API Key 是否正确 |
| `API error: 429` | 请求过于频繁，等待后重试 |
| `File too large` | 文件超过 5MB，用 `/read` 分段读取 |
| `Context compacted` | 对话过长自动压缩，正常现象 |
| 进程崩溃 | 日志：`~/.jaicode/logs/` |

### 重置配置

```bash
rm -rf ~/.jaicode/
node packages/tui-node/src/tui.js    # 重新初始化
```

### 获取帮助

```
/help                    # 命令列表
/stats                   # 用量统计
```

---

*Jaicode v0.15.2 — 详见 [https://github.com/jonasjiang8972-netizen/jaicode](https://github.com/jonasjiang8972-netizen/jaicode)*
