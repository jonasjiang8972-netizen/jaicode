# Jaicode 授权能力框架 PRD

| 文档信息 | 内容 |
|---|---|
| 产品名称 | Jaicode |
| 文档版本 | V1.0 |
| 关联文档 | 《市场分析与产品定位PRD》《功能设计PRD》《能力差距分析》 |
| 定位 | 安全基础框架，所有能力扩展的前置约束 |

---

## 1. 设计原则

1. **最小权限** — 默认拒绝所有，按需逐项授权
2. **用户主权** — 用户可随时查看、修改、撤销权限
3. **透明可审计** — 所有敏感操作有日志可追溯
4. **能力自感知** — Jaicode 能检测自身能力缺口并提出补足方案
5. **渐进信任** — 随使用时长和验证，用户可逐步放宽权限

---

## 2. 权限分级

| 等级 | 名称 | 操作范围 | 默认模式 |
|---|---|---|---|
| **L0** | 读取 | 扫描目录结构、读取文件内容 | 会话授权 |
| **L1** | 写入 | 创建/修改/删除文件 | 逐次确认 |
| **L2** | 执行 | Shell 命令、脚本运行 | 逐次确认 |
| **L3** | 扩展 | 安装 Skill/MCP、下载插件 | 全局授权 |
| **L4** | 网络 | HTTP 请求、外部 API 调用 | 按域名确认 |

---

## 3. 授权流程

### 3.1 操作流程授权

```
用户请求 → Jaicode 检查能力 → 能力是否存在？
                                      │
                        ┌─ 是 ─┐      └─ 缺口 ─┐
                        │                   │
                   检查权限等级        分析缺口原因
                        │                   │
                   权限是否足够？      提出扩展方案
                        │              (自开发/第三方)
                   ┌─ 否 ─┐              │
                   │      │          用户选择方案
               弹窗请求   直接执行        │
               用户确认      │           │
                   │      │        执行扩展 → 执行原操作
                   └─ 是 ─┘              │
                        │                │
                        ▼                ▼
                    执行操作 ←──────────┘
                        │
                    记录审计日志
```

### 3.2 能力扩展授权

当检测到能力缺失时：

```
Jaicode: "此操作需要图片理解能力，当前缺失。"
Jaicode: "可选方案:"
          "[A] 内置 VL 模型调用 (需 Provider 支持)"
          "[B] 安装第三方 image-reader MCP"
          "[C] 创建本地 image-skill 插件"
          "[D] 暂不处理"

用户选择 → Jaicode 执行选定方案 → 重新尝试原操作
```

---

## 4. 用户配置模型

```json
{
  "permissions": {
    "L0_read": "session",       // always | session | ask | deny
    "L1_write": "ask",          // always | ask | deny
    "L2_exec": "ask",           // always | ask | deny
    "L3_extend": "ask",         // always | ask | deny
    "L4_network": "ask",        // always | ask | deny
    "autoApproveReadOnly": true,
    "blockedCommands": ["rm -rf", "sudo", "chmod 777"],
    "allowedDomains": [],
    "sessionAutoExpire": 3600
  }
}
```

---

## 5. 存储位置

- 配置文件：`~/.jaicode/permissions.json`
- 审计日志：`~/.jaicode/audit.jsonl`

---

*Jaicode 授权框架 PRD v1.0 — 所有能力开发的前置约束文档。*
