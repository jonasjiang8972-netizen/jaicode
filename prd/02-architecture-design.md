# AI 编程 Agent CLI 工具 — 技术架构设计文档 V2（核心架构优先版）

| 文档信息 | 内容 |
|---|---|
| 产品名称 | Jaicode |
| 文档版本 | V2.0（核心架构优先版） |
| 关联文档 | 《市场分析与产品定位PRD》《前端界面设计PRD》 |
| 本版核心调整 | 授权激活与官网支付模块降级为**预留可插拔接口**，架构重心转向 Agent 核心引擎与本地执行安全性 |

---

## 1. 架构目标与设计原则

### 1.1 架构目标（按优先级排序）
1. **P0 核心闭环可靠**：Architect/Code/Debug/Ask 四种模式的任务循环必须稳定、可预测、可回滚
2. **P0 跨平台可分发**：Mac/Windows 单文件二进制，无外部依赖
3. **P0 双语引擎一致**：终端文案与AI Prompt语言100%对齐
4. **P1 授权可插拔**：架构预留标准接口，MVP阶段用空实现（NoOp）替代，二期无缝切换真实鉴权
5. **P1 支付/账号体系解耦**：不与核心Agent运行时耦合，未来可作为独立服务接入

### 1.2 设计原则
| 原则 | 说明 |
|---|---|
| 接口先行（Interface-First） | 授权、支付、遥测等非核心能力一律先定义接口，MVP用空实现占位，避免后期重构核心流程 |
| 核心闭环零依赖外部服务 | 除LLM API调用外，Architect/Code/Debug/Ask 的执行不应因授权/支付服务不可用而中断（MVP阶段） |
| 最小权限 | Ask模式无文件写权限；Code/Debug写入前必须人工确认 |
| 失败安全 | 网络异常时默认拒绝高风险操作，但**不因授权服务缺失而拒绝**（MVP阶段授权默认放行） |

---

## 2. 系统整体架构

```
┌───────────────────────────────────────────────────────────────────┐
│                       用户本地设备 (Mac / Windows)                     │
│                                                                       │
│  ┌───────────────┐   ┌───────────────────────────────────────────┐ │
│  │  CLI 入口层     │──▶│              核心运行时 (Core Runtime)         │ │
│  └───────────────┘   │                                             │ │
│                       │  ┌───────────┐ ┌──────────┐ ┌────────────┐│ │
│                       │  │ I18n 模块  │ │ 日志模块  │ │ 授权模块*    ││ │
│                       │  │ (P0)      │ │ (P0)     │ │ (P1/预留)   ││ │
│                       │  └───────────┘ └──────────┘ └──────┬─────┘│ │
│                       │                                    │       │ │
│                       │  ┌─────────────────────────────────▼────┐ │ │
│                       │  │        Agent 编排引擎 (P0 核心)          │ │ │
│                       │  │   Architect / Code / Debug / Ask       │ │ │
│                       │  └─────┬───────────────────┬─────────────┘ │ │
│                       │        │                   │                │ │
│                       │  ┌─────▼──────┐     ┌───────▼───────┐      │ │
│                       │  │ 文件系统适配 │     │ LLM Provider   │      │ │
│                       │  │ (P0)       │     │ Adapter (P0)   │      │ │
│                       │  └────────────┘     └───────┬───────┘      │ │
│                       └───────────────────────────────┼──────────┘  │
└─────────────────────────────────────────────────────┼─────────────┘
                                                          │ HTTPS
                                                ┌──────────▼─────────┐
                                                │  大模型 API (Claude等) │
                                                └─────────────────────┘

  * 授权模块：MVP阶段内部使用 NoOpLicenseProvider（本地空实现，始终放行）
    云端 License API / 支付系统 本期不部署，接口预留见第4节
```

**关键说明**：相比V1架构，本版本把"云端鉴权服务""计费系统"从**主链路依赖**降级为**可选外部依赖**——核心运行时在没有这两个服务的情况下也应能完整运行 Agent 任务循环，这是本期架构验收的硬性要求。

---

## 3. 客户端核心模块设计（P0，本期实现重心）

### 3.1 分层结构
| 层级 | 职责 | 代表模块 | 优先级 |
|---|---|---|---|
| CLI 入口层 | 命令解析、参数校验 | `cli/commands/*` | P0 |
| 业务编排层 | Agent模式调度、任务生命周期 | `orchestrator/` | P0 |
| 领域服务层 | i18n、Diff生成、Prompt构建、授权(预留) | `i18n/`, `diff/`, `prompt/`, `license/` | P0(前三) / P1(授权) |
| 基础设施层 | 文件IO、网络请求、日志、本地加密存储 | `infra/fs`, `infra/http`, `infra/log`, `infra/crypto` | P0 |

### 3.2 核心模块详细说明

**① Agent 编排引擎（本期架构重心）**
- `ModeRouter`：路由到 Architect / Code / Debug / Ask 四种模式处理器
- `TaskLoop`：管理"读取上下文 → 调用LLM → 解析响应 → 执行动作 → 反馈结果"循环
  - Debug 模式需支持**最大重试次数限制**（防止无限循环消耗Token，建议默认5次，可配置）
- `ContextBuilder`：读取本地文件/目录结构，构建LLM上下文；需支持大文件/超长目录的截断策略
- `DiffPresenter`：Git-like Diff展示，超过阈值行数自动折叠

**② 文件系统适配层**
- 统一跨平台路径处理
- 写入前自动备份（`.jaicode_backup/`），支持回滚指令 `jaicode rollback`
- 受控写入接口：仅Orchestrator确认后可调用 `applyDiff()`

**③ LLM Provider Adapter**
- 抽象接口 `ILLMProvider.chat(messages, tools)`
- MVP阶段：至少实现1个Provider（如Anthropic API），预留多Provider扩展点
- 支持 BYOK：用户API Key本地存储（**本期用简单本地加密，密钥来源见第4.2节说明**）

**④ I18n 模块**
- `LocaleDetector` + `LocaleStore` + `MessageCatalog`
- AI Prompt 语言对齐：System Prompt 根据语言设置动态包装

**⑤ 日志模块**
- 本地结构化日志（JSON Lines）
- 记录：任务执行、错误、（预留）授权状态变化

---

## 4. 预留模块设计：授权与支付（P1，接口先行）

> 本节定义**接口契约**，本期只需实现最小占位逻辑，不涉及真实云端服务开发。

### 4.1 授权模块接口设计

```typescript
// license/ILicenseProvider.ts
interface ILicenseProvider {
  /** 校验当前是否有权执行核心Agent操作 */
  validate(): Promise<LicenseStatus>;
  /** 激活流程（MVP阶段可为空实现） */
  activate(licenseKey: string): Promise<LicenseStatus>;
  /** 获取当前授权状态用于展示 */
  getStatus(): LicenseStatus;
}

type LicenseStatus = {
  isValid: boolean;
  plan: 'trial' | 'personal' | 'team' | 'enterprise' | 'unlicensed';
  expiresAt: Date | null;
};
```

**MVP阶段实现：`NoOpLicenseProvider`**
```typescript
class NoOpLicenseProvider implements ILicenseProvider {
  async validate() {
    return { isValid: true, plan: 'trial', expiresAt: null };
  }
  async activate(_key: string) {
    return { isValid: true, plan: 'trial', expiresAt: null };
  }
  getStatus() {
    return { isValid: true, plan: 'trial', expiresAt: null };
  }
}
```

**二期切换方式**：Orchestrator 通过依赖注入持有 `ILicenseProvider` 实例，二期只需将注入的实现从 `NoOpLicenseProvider` 替换为 `CloudLicenseProvider`（真实调用云端API），**核心业务代码零改动**。

**二期真实实现预告：**
- 在线激活：HTTPS请求云端License API，绑定硬件指纹，返回加密令牌
- 离线激活：RSA签名的离线证书文件，客户端内置公钥验签
- 授权令牌参与本地配置文件加解密

### 4.2 支付模块接口设计（本期完全不开发，仅占位）

```typescript
// billing/IBillingProvider.ts （本期仅定义类型，无实现，无调用点）
interface IBillingProvider {
  createCheckoutSession(planId: string): Promise<{ url: string }>;
  getSubscriptionStatus(): Promise<SubscriptionStatus>;
}
```

本期 CLI 与 Web 端均**不接入任何支付逻辑**，购买意向通过人工联系方式或 Waitlist 表单收集。

### 4.3 本期"轻量密钥保护"方案

由于授权模块本期为空实现，为避免用户BYOK的API Key明文落盘的基本风险，本期采用简化方案：

- 使用**设备本地生成的固定密钥**对 `~/.jaicode/keys` 做AES加密，仅防止明文泄露，**不作为商业防破解手段**
- 明确告知团队：本期不具备防盗版能力，防破解体系随二期授权模块一并实现

---

## 5. 关键流程时序

### 5.1 Code 模式任务循环
```
用户 → CLI: jaicode code "修复登录bug"
CLI → NoOpLicenseProvider: validate() → 始终返回 isValid:true（无网络请求）
CLI → ContextBuilder: 读取相关文件 + 目录结构
CLI → LLM Adapter: 发送带语言标记的System Prompt请求
LLM → CLI: 返回代码变更建议
CLI → DiffPresenter: 生成Diff并展示
用户 → CLI: 确认 (y)
CLI → FS Adapter: 备份原文件 → 写入新内容
CLI → 用户: 展示执行结果（双语）
```

**验收要点**：全流程除LLM API调用外，不产生任何其他外部网络请求，可在完全隔离/仅允许访问LLM API域名的网络环境下正常工作。

### 5.2 Debug 模式循环（含重试上限）
```
第 N/MAX 次尝试
├─ 运行用户指定命令，捕获 stdout/stderr
├─ 若失败 → LLM生成修复方案 → 展示Diff → 确认 → 应用 → 重新运行
├─ 若成功 → 结束，展示"用时N次尝试"
└─ 若达到MAX（默认5，可通过 --max-retries 配置）→ 终止并提示人工介入
```

---

## 6. 目录结构

```
jaicode/
├── src/
│   ├── cli/                     # 命令行入口
│   ├── orchestrator/            # Agent编排引擎（P0核心）
│   ├── license/
│   │   ├── ILicenseProvider.ts  # 接口定义
│   │   └── NoOpLicenseProvider.ts  # MVP空实现
│   │   # CloudLicenseProvider.ts   ← 二期新增
│   ├── billing/
│   │   └── IBillingProvider.ts  # 仅类型定义，无实现，无调用
│   ├── i18n/
│   ├── llm/                     # LLM Provider Adapter
│   ├── fs/                      # 文件系统适配与Diff
│   ├── infra/
│   │   ├── crypto/              # 轻量密钥保护
│   │   ├── http/
│   │   └── log/
│   └── locales/
│       ├── en.json
│       └── zh.json
├── tests/
└── scripts/
```

---

## 7. 非功能性架构考量

| 维度 | 本期要求 | 二期扩展 |
|---|---|---|
| 性能 | 内存≤80MB，冷启动<500ms | 不变 |
| 可靠性 | 授权/支付服务缺失不影响核心功能可用 | 授权服务不可用时降级为本地缓存校验 |
| 可扩展性 | LLM Provider、Agent模式可插拔 | License/Billing Provider可插拔（本期已预留接口） |
| 安全 | 轻量本地密钥保护 | 授权令牌参与加解密的完整防破解体系 |
| 可观测性 | 本地结构化日志 | 可选匿名遥测 |

---

## 8. 二期接入计划预告（非本期开发范围）

| 事项 | 说明 |
|---|---|
| 云端 License API | 激活/校验/离线证书三种模式 |
| 计费系统对接 | Stripe（海外）/ 国内发卡平台，对接 `IBillingProvider` |
| 防破解加固 | 授权令牌参与配置解密、代码混淆、反调试检测 |
| Web管理控制台 | 授权管理、账单、团队席位 |

---

## 9. 待评审事项

1. `NoOpLicenseProvider` 是否需要支持"模拟到期"用于内部测试授权到期场景的UI表现？
2. Debug模式默认最大重试次数5次是否合理，是否需要按任务复杂度动态调整？
3. 本期BYOK密钥的"轻量保护"方案是否需要安全团队最低限度审查，避免明文泄露风险被外部误解为"已具备加密保护"？

---

*本文档为架构设计V2修订版，核心变化是将商业化模块降级为预留接口，架构评审时请重点确认"核心闭环零外部依赖"这一验收标准的可行性。*
