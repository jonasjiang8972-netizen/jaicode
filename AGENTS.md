## 开发规范

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
├── desktop-app/           # Tauri 桌面应用
├── backend-go/            # Go 后端
├── packages/              # TypeScript 模块
└── prd/                   # 产品需求文档
```

## 开发命令

```bash
# 终端版 (TypeScript)
bun install
bun run packages/tui-node/src/main.tsx

# Go 后端
cd backend-go
go build -o bin/jaicode-server cmd/jaicode-desktop/main.go

# 桌面应用
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
- API Key 本地加密
- 文件写入前确认
