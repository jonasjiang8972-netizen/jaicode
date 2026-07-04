# Jaicode 文件识别与处理方案

## 一、文件类型完整分类

### 分类层级

```
                    ┌─ 直接读取 → LLM 上下文
  文本类 ──────────┤
                    └─ 编辑操作 → Diff 确认 → 写入
                    
                    ┌─ 图片 → VL 模型分析
  多模态类 ────────┤─ PDF → 文本提取 → LLM 分析
                    └─Office → 内容提取 → LLM 分析
                    
                    ┌─ 解压 → 列出内容
  归档类 ──────────┤
                    └─ 禁止直接读取（二进制安全）
                    
  未知类型 ──────── 仅显示元数据（大小、修改时间）
```

---

### 完整文件类型识别方案

| 类型 | 扩展名 | 处理方式 | 是否需要外部工具 |
|---|---|---|---|
| **代码文本** | .ts, .js, .tsx, .jsx, .py, .go, .rs, .java, .c, .cpp, .swift, .kt | 直接读取注入 LLM 上下文 | 否 |
| **配置文件** | .json, .yaml, .yml, .toml, .xml, .ini, .env, .conf | 直接读取注入 LLM 上下文 | 否 |
| **文档** | .md, .mdx, .txt, .rst, .csv, .tsv, .log | 直接读取注入 LLM 上下文 | 否 |
| **样式** | .css, .scss, .less, .html, .svg (文本) | 直接读取注入 LLM 上下文 | 否 |
| **图片** | .png, .jpg, .jpeg, .webp, .gif, .bmp, .ico | Base64 → VL 模型分析 | 需要 VL Provider |
| **PDF** | .pdf | 文本提取 → LLM 分析 | 需要 pdf 解析器 |
| **Word** | .docx | XML 提取 → LLM 分析 | 需要 docx 解析器 |
| **Excel** | .xlsx, .csv | 表格数据 → LLM 分析 | 需要 xlsx 解析器 |
| **PPT** | .pptx | 文本提取 → LLM 分析 | 需要 pptx 解析器 |
| **压缩包** | .zip, .tar, .gz, .bz2, .7z | 列出目录结构 | 否 |
| **可执行** | .exe, .dll, .so, .dylib, .app | 仅显示元数据 | 禁止读取 |
| **音视频** | .mp3, .wav, .mp4, .mov, .avi | 仅显示元数据 | 暂不支持 |
| **二进制** | .bin, .dat, .db, .sqlite | 仅显示元数据 | 禁止读取 |

---

### Claude Code 文件处理核心逻辑（逆向参考）

```
用户粘贴文件路径
      │
      ▼
┌─ 检测阶段 ─────────────────────────────────────────┐
│ 1. 路径有效性检查（文件存在？权限？）               │
│ 2. 文件大小检查（< 50MB?）                         │
│ 3. 文件类型检测（扩展名 + magic bytes）             │
│ 4. 编码检测（UTF-8? 二进制?）                      │
└─────────────────────────────────────────────────────┘
      │
      ▼
┌─ 路由阶段 ─────────────────────────────────────────┐
│ 文本类  → readAsText() → 注入 LLM 上下文            │
│ 图片类  → readAsBase64() → 构建 ImageBlock → VL API │
│ PDF 类  → extractText() → 注入 LLM 上下文           │
│ 二进制  → 仅显示元数据 + 安全警告                   │
└─────────────────────────────────────────────────────┘
```

---

### Jaicode 实现架构

```
                    ┌──────────────────────────────────────┐
                    │         UnifiedFileHandler           │
                    │  detect → route → read → encode     │
                    └──────────────┬───────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ TextHandler  │      │ ImageHandler │      │ BinaryHandler│
   │              │      │              │      │              │
   │ - 编码检测   │      │ - 格式验证   │      │ - 元数据展示 │
   │ - 行数统计   │      │ - base64     │      │ - 大小/时间  │
   │ - 语言识别   │      │ - MIME 类型  │      │ - 安全检查   │
   │ - 截断策略   │      │ - 缩略图     │      │ - 拒绝读取   │
   └──────────────┘      └──────────────┘      └──────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
      LLM 上下文              VL 模型 API              仅元数据
```

---

## 二、核心实现方案

### 文件类型检测

**优先级：**

1. **扩展名匹配** — 快速筛选（白名单）
2. **Magic Bytes 检测** — 防止伪装扩展名
3. **文本/二进制检测** — 防止读取二进制文件

### 文件大小限制

| 文件类型 | 大小限制 | 超出处理 |
|---|---|---|
| 代码文本 | 5MB | 截断并提示用户 |
| Markdown | 2MB | 截断并提示用户 |
| 图片 | 10MB | 拒绝 + 建议使用缩略图 |
| PDF | 50MB | 分页读取 |
| 其他 | 1MB | 仅显示元数据 |

### 安全策略

```
1. 路径遍历防护：∀path. ¬path.contains("..") ∧ path.startsWith(projectRoot)
2. 符号链接检测：Files.isSymbolicLink() → 追踪真实路径
3. 二进制文件检测：前 1024 字节是否包含 NULL 字节
4. 敏感文件拒绝：.env, *_secret*, *.key 等
```

### 剪贴板处理方案（第三方截图 → 粘贴）

**核心问题：** 用户用微信/系统截图后图片只存在于剪贴板，需要检测并处理。

**解决方案：**

```
用户粘贴到 Jaicode
       │
       ▼
┌─ 检测阶段 ──────────────────────────────────────────┐
│ 输入 = 文件路径？                                    │
│   ├─ 是 → 直接读取文件                              │
│   └─ 否 → 输入 = 图片数据（base64/data-uri）？       │
│       ├─ 是 → 解码 → 临时文件 → 分析                 │
│       └─ 否 → 检查剪贴板（需权限）                   │
│           ├─ 剪贴板有图片 → 保存临时文件 → 分析      │
│           └─ 剪贴板无图片 → 当作普通文本处理         │
└─────────────────────────────────────────────────────┘
```

---

## 三、文件处理架构设计

### 新增文件结构

```
packages/tui-node/src/filesystem/
  ├── file-handler.js           — 统一入口，路由分发
  ├── text-handler.js           — 文本类文件处理
  ├── image-handler.js          — 图片处理（已有，需扩展）
  ├── pdf-handler.js            — PDF 文本提取
  ├── binary-handler.js         — 二进制元数据
  ├── clipboard-monitor.js      — 剪贴板监控
  └── file-types.js             — 文件类型注册表
```

### 文件类型注册表

```js
// file-types.js
export const FILE_TYPES = {
  // 文本类 — 直接读取
  text: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '.py', ...],
    maxSize: 5 * 1024 * 1024,
    handler: 'text',
  },
  // 图片类 — VL 分析
  image: {
    extensions: ['.png', '.jpg', '.jpeg', .webp', '.gif', '.bmp', '.ico'],
    maxSize: 10 * 1024 * 1024,
    handler: 'image',
  },
  // PDF — 文本提取
  pdf: {
    extensions: ['.pdf'],
    maxSize: 50 * 1024 * 1024,
    handler: 'pdf',
  },
  // Office — 内容提取
  office: {
    extensions: ['.docx', '.xlsx', '.pptx'],
    maxSize: 30 * 1024 * 1024,
    handler: 'office',
  },
  // 归档 — 列出内容
  archive: {
    extensions: ['.zip', '.tar', '.gz', '.bz2', '.7z'],
    maxSize: 100 * 1024 * 1024,
    handler: 'archive',
  },
  // 二进制 — 拒绝
  binary: {
    extensions: ['.exe', '.dll', '.so', '.dylib', '.bin', '.dat'],
    handler: 'reject',
  },
}
```

---

## 四、浏览器端文件路径识别（粘贴场景）

### macOS 终端粘贴行为差异

| 终端 | 粘贴图片行为 | Jaicode 处理方式 |
|---|---|---|
| **Terminal.app** | 无输出或乱码 | 检测剪贴板 → 保存临时文件 |
| **iTerm2** | 保存到 /tmp/ → 粘贴路径 | 直接读取路径 |
| **WezTerm** | 保存到 /tmp/ → 粘贴路径 | 直接读取路径 |
| **Windows Terminal** | 保存到 %TEMP% → 粘贴路径 | 直接读取路径 |

### macOS 剪贴板读取方案

```javascript
// clipboard-monitor.js (macOS)

// 方案 A：使用 pngpaste（需要安装）
// brew install pngpaste
export async function readClipboardImage() {
  const tmpPath = `/tmp/jaicode-${Date.now()}.png`
  try {
    execSync(`pngpaste "${tmpPath}"`)
    return tmpPath
  } catch {
    return null  // 剪贴板无图片
  }
}

// 方案 B：使用 osascript（原生支持）
export async function readClipboardImageNative() {
  const tmpPath = `/tmp/jaicode-${Date.now()}.png`
  try {
    execSync(`osascript -e 'set f to open for access POSIX file "${tmpPath}" with write permission
      try
        write (the clipboard as «class PNGf») to f
      end try
      close access f'`)
    return tmpPath
  } catch {
    return null
  }
}

// 方案 C：Electron Clipboard（如果未来迁移到 Electron）
// const { clipboard } = require('electron')
// const image = clipboard.readImage()
// if (!image.isEmpty()) { ... }
```

---

## 五、综合处理流程

### 完整输入处理管线

```
用户输入（粘贴 Cmd+V）
       │
       ▼
┌─ 第 1 层：输入类型检测 ────────────────────────────┐
│ • 是 /command？ → 命令路由                          │
│ • 是文件路径？ → 文件处理器                         │
│ • 是 base64 数据？ → 解码 → 临时文件 → 分析        │
│ • 是普通文本 → 第 2 层                             │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ 第 2 层：图片路径快速检测 ────────────────────────┐
│ 匹配正则：                                         │
│   /[\/\w\s-]+\.(png\|jpg\|jpeg\|webp\|gif\|bmp)/i│
│   或 ~/[^ ]+\.(png\|jpg\|jpeg\|webp\|gif\|bmp)   │
│   或 /tmp/[^ ]+\.(png\|jpg\|jpeg\|webp\|gif\|bmp)│
│                                                    │
│ 匹配 → 验证文件存在 → 图片处理器                    │
│ 不匹配 → 第 3 层                                   │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ 第 3 层：剪贴板检测（用户触发 /paste 或自动）─────┐
│ 调用系统剪贴板工具                                  │
│   • 有图片 → 保存临时文件 → 分析                    │
│   • 无图片 → 第 4 层                               │
└────────────────────────────────────────────────────┘
       │
       ▼
┌─ 第 4 层：普通文本 → LLM ─────────────────────────┐
│ 文本意图分类 → LLM 分析 → 返回结果                 │
└────────────────────────────────────────────────────┘
```

---

## 六、版本规划

| 版本 | 交付 | 优先级 |
|---|---|---|
| v0.10.0 | 文件类型注册表 + 文本/图片/二进制处理器 | P0 |
| v0.10.1 | PDF 文本提取 + Office 文档提取 | P1 |
| v0.11.0 | 剪贴板监控 + 第三方截图粘贴 | P1 |
| v0.11.1 | iTerm2 内联图片显示 | P2 |
| v0.12.0 | 统一文件拖拽 + 浏览器文件选择器 | P2 |

---

*本文档为 Jaicode 文件识别与处理完整方案。待确认后启动开发。*
