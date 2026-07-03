# JaiBuilder 低代码工具 — 技术架构设计 PRD

| 文档信息 | 内容 |
|---|---|
| 产品名称 | JaiBuilder |
| 文档版本 | V1.0 |
| 关联文档 | 《市场分析与产品定位PRD》《功能设计PRD》 |

---

## 1. 架构目标

1. **P0 终端原生渲染**：纯 Node.js TUI，无需浏览器
2. **P0 实时画布**：终端内可视化组件树 + 属性编辑
3. **P0 AI 生成能力**：接入 Jaicode Provider 配置，自然语言生成页面
4. **P0 多格式代码导出**：React / Vue / HTML
5. **P1 可扩展组件库**：插件机制和预设组件

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    JaiBuilder TUI                            │
│                                                              │
│  ┌─────────┐  ┌──────────────┐  ┌─────────────┐           │
│  │ 组件库   │  │   画布区     │  │  属性面板    │           │
│  │ Panel   │  │  Canvas      │  │  Inspector   │           │
│  │         │  │              │  │              │           │
│  │ - Text  │  │  ┌────────┐  │  │  文本内容    │           │
│  │ - Button│  │  │ Root   │  │  │  样式属性    │           │
│  │ - Image │  │  │ ├── Div │  │  │  布局属性    │           │
│  │ - Form  │  │  │ │   ├── │  │  │  事件绑定    │           │
│  │ - ...   │  │  │ │   └── │  │  │              │           │
│  └─────────┘  │  └────────┘  │  └─────────────┘           │
│       │       └──────────────┘         │                   │
│       └────────────┬───────────────────┘                   │
│                    ▼                                        │
│          ┌──────────────────┐                              │
│          │   Page Model     │                              │
│          │  (JSON Schema)   │                              │
│          └────────┬─────────┘                              │
│                   │                                         │
│     ┌─────────────┼─────────────┐                         │
│     ▼             ▼             ▼                         │
│  ┌──────┐   ┌──────────┐   ┌────────┐                   │
│  │ AI   │   │  Code    │   │  File  │                   │
│  │Engine│   │ Generator│   │  I/O   │                   │
│  └──────┘   └──────────┘   └────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

```json
{
  "project": {
    "name": "my-page",
    "version": "0.1.0",
    "theme": "default",
    "pages": ["home"]
  },
  "page": {
    "id": "home",
    "title": "首页",
    "components": {
      "id": "root",
      "type": "Container",
      "props": { "layout": "flex-column" },
      "children": [
        {
          "id": "header-1",
          "type": "Header",
          "props": { "text": "欢迎使用 JaiBuilder", "level": 1, "color": "#00B8D9" },
          "children": []
        },
        {
          "id": "btn-1",
          "type": "Button",
          "props": { "text": "点击开始", "variant": "primary", "action": "navigate" },
          "children": []
        }
      ]
    }
  }
}
```

---

## 4. 组件规范

### 4.1 内置组件库

| 组件名 | 类型 | 关键属性 |
|---|---|---|
| Container | 容器 | layout, padding, backgroundColor |
| Text | 展示 | text, fontSize, color, fontWeight |
| Button | 交互 | text, variant(primary/secondary), onClick |
| Image | 展示 | src, alt, width, height |
| Input | 交互 | placeholder, type, value |
| Card | 容器 | title, elevation, padding |
| List | 展示 | items[], renderItem |
| Form | 交互 | fields[], onSubmit |
| Divider | 展示 | orientation, color |
| Row | 容器 | gap, justify, align |
| Column | 容器 | gap, justify, align |

---

## 5. 代码导出生成器

### 5.1 React 导出
- 函数组件 + TypeScript
- CSS Module 或 Tailwind
- 支持 hooks 状态管理
- 路由集成（react-router）

### 5.2 Vue 导出
- SFC 单文件组件
- Composition API
- Scoped CSS

### 5.3 HTML 导出
- 纯 HTML + CSS + JS
- CDN 引入框架
- 单个文件可直接打开

---

## 6. AI 生成引擎

通过 Jaicode Provider 配置调用 LLM：
- Prompt 模板：将组件库 schema 注入 system prompt
- 用户输入自然语言描述
- AI 返回符合 schema 的组件 JSON
- 校验并渲染到画布

---

*本文档为 JaiBuilder 架构设计 V1 草案。*
