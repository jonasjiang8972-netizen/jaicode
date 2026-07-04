# Jaicode 能力检验与差距分析

## 一、当前已具备能力

| 能力 | 实现状态 | 对应模式 |
|---|---|---|
| LLM 流式对话 | ✅ 已实现 | ask |
| 代码生成建议 | ✅ 已实现 | code |
| 调试辅助 | ✅ 已实现 | debug |
| 架构设计 | ✅ 已实现 | plan |
| 文件安全备份/回滚 | ✅ 已实现 | 全局 |
| 用户画像个性化 | ✅ 已实现 | 全局 |
| 中英双语 i18n | ✅ 已实现 | 全局 |
| 多 Provider 支持 | ✅ 已实现 | 全局 |
| 思考过程可视化 | ✅ 已实现 | 全局 |
| TUI 像素吉祥物 | ✅ 已实现 | 全局 |
| Marketplace 框架 | ✅ 已实现 | 全局 |

## 二、缺失的关键能力

### P0 — 必须立即补足

| 能力 | 缺失影响 | 实现方案 |
|---|---|---|
| **直接读文件** | AI 无法了解项目上下文，只能凭空建议 | 内置 Skill: file-reader |
| **直接写文件** | AI 只能生成 diff 建议，不能直接修改 | 内置 Skill: file-writer |
| **执行 Shell 命令** | AI 说"可以运行 xxx"但实际无法执行 | 内置 Skill: shell-executor |
| **错误捕获与重试** | Debug 模式无法自动运行测试验证 | 整合到 Debug 模式核心 |
| **使用量统计分析** | 无法追踪 Token 消耗与费用 | 内置 Analytics 模块，状态栏实时展示 |

### P1 — 短期补足（1-2 个迭代）

| 能力 | 用途 | 实现方案 |
|---|---|---|
| **图片理解** | 用户上传 UI 截图/架构图 | MCP: image-reader 或第三方 VL 模型 |
| **网络搜索** | 获取最新技术文档/解决方案 | MCP: web-search |
| **网络抓取** | 抓取文档页面/API 文档 | MCP: web-fetch |
| **Git 操作** | 版本管理、分支操作、diff 查看 | 内置 Skill: git-helper |
| **Web 预览** | 预览生成的 HTML/页面 | Skill: web-preview |

### P2 — 中期补足

| 能力 | 用途 | 实现方案 |
|---|---|---|
| **数据库操作** | SQL 查询和 schema 管理 | MCP: database |
| **浏览器自动化** | E2E 测试/数据采集 | MCP: playwright |
| **API 测试** | HTTP 请求测试/调试 | Skill: api-tester |
| **多文件协同** | 大项目跨文件修改 | Skill: project-context |

## 三、能力补足路径

### 路径 A：Jaicode 自主开发（推荐）
优点：完全可控、深度集成、性能最优
缺点：开发周期长

### 路径 B：引入第三方 MCP Server
优点：即插即用、社区维护
缺点：质量参差不齐、安全风险

### 路径 C：混合模式
核心能力自主开发 + 长尾能力引入第三方

## 四、推荐实施计划

### Phase 1.5 — 立即迭代（P0 能力）
```
[Core] file-reader    → 读取文件内容注入 LLM 上下文
[Core] file-writer    → 安全写入（带备份确认）
[Core] shell-exec     → 执行命令 + 捕获 stdout/stderr
[Core] project-scanner → 项目结构概览
```

### Phase 2.0 — 智能体增强
```
[MCP] image-reader    → 图片理解（调用 VL 模型）
[MCP] web-search      → 网络搜索
[MCP] git-helper      → Git 操作封装
```

### Phase 3.0 — 生态扩展
```
[Market] 第三方 Skill 安装
[Market] MCP Server 一键接入
[Community] 共享组件库
```
