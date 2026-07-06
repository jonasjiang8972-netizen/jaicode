# 开发规范

- 代码风格遵循项目配置
- 新功能需配套测试
- 文档与开发同步
- 版本号每次只递增一位

## 项目结构

```
jaicode/
├── README.md              # 项目说明
├── USER_GUIDE.md          # 用户使用手册
├── VERSION_POLICY.md      # 版本策略
├── MIGRATION_PLAN.md      # 迁移路线图
├── LICENSE                # Apache 2.0
├── THIRD_PARTY_NOTICES.txt # 第三方声明
├── backend-go/            # Go 后端服务
├── desktop-app/           # Tauri 桌面应用
├── packages/              # TypeScript 模块
│   ├── tui-node/          # 终端 TUI
│   ├── cli/               # CLI 入口
│   ├── core/              # 核心模块
│   ├── llm/               # LLM Provider 适配
│   ├── i18n/              # 国际化
│   └── marketplace/       # 扩展市场
├── prd/                   # 产品需求文档
└── .jai/                  # Agent 与命令定义
```

## 开发命令

```bash
# 终端版 (TypeScript)
bun install
node packages/tui-node/src/tui.js

# Go 后端
cd backend-go
go build -o jaicode-server cmd/jaicode-desktop/main.go

# 构建 macOS 二进制
cd backend-go
go build -ldflags="-linkmode=external" -o jaicode-macos cmd/jaicode-desktop/main.go
codesign -s - jaicode-macos

# 桌面应用 (需要 Rust)
cd desktop-app
bun install
cargo tauri dev
```

## 多 Provider 接入

- Anthropic (Claude)
- OpenAI (GPT)
- 自定义 API（OpenAI 兼容格式）

## 安全约束

- 危险命令黑名单
- 路径遍历防护
- API Key 本地 AES-256-GCM 加密（HKDF-SHA256 密钥派生）
- 文件写入前确认
- 接口认证（Bearer <REDACTED>）
- CORS Origin 白名单
