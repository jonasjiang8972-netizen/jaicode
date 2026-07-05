const VERSION = "0.13.1"

interface ParsedArgs {
  command: string
  subcommand?: string
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { command: "", subcommand: undefined, positional: [], flags: {} }
  let i = 0

  while (i < argv.length && (argv[i].includes("bun") || argv[i].endsWith(".ts") || argv[i] === "jaicode")) {
    i++
  }

  if (i >= argv.length) return result
  result.command = argv[i++]

  // Subcommands for market
  if (i < argv.length && ["search", "install", "list", "remove", "update", "info"].includes(argv[i])) {
    result.subcommand = argv[i++]
  }

  for (; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=")
      if (eqIdx > 0) {
        result.flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.flags[arg.slice(2)] = argv[++i]
      } else {
        result.flags[arg.slice(2)] = true
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        result.flags[arg.slice(1)] = argv[++i]
      } else {
        result.flags[arg.slice(1)] = true
      }
    } else {
      result.positional.push(arg)
    }
  }

  return result
}

function getFlag(args: ParsedArgs, key: string, def?: string | boolean): string | boolean | undefined {
  return args.flags[key] ?? args.flags[key[0]] ?? def
}

function printHelp(lang: "zh" | "en"): void {
  if (lang === "zh") {
    console.log(`
${"✨"} Jaicode v${VERSION} — 本地优先 AI 编程助手

使用方式:
  jaicode <命令> [选项]

命令:
  plan <需求>     生成技术方案（Architect 模式）
  code <任务>     修改代码（Code 模式，含 Diff 确认）
  debug <命令>    自动修复（Debug 模式，含重试）
  ask <问题>      纯问答（Ask 模式，无文件权限）
  commit          提交代码（语义化前缀 + 双语消息）
  review          审查代码变更（安全/质量/风格）
  spellcheck      检查 Markdown 拼写和语法
  issues <查询>   搜索 GitHub Issues
  learn           提取会话知识到项目配置
  changelog       生成变更日志
  rmslop          清理 AI 生成的冗余代码
  translate       翻译文档到其他语言
  skill <名称>    运行指定 skill
  rollback        恢复最近的文件备份
  config          管理配置
  init            在当前项目中初始化
  market          管理扩展市场
  --help, -h      查看帮助
  --version, -v   查看版本

通用选项:
  --lang zh|en    指定语言（覆盖全局配置）
  --yes, -y       跳过确认（CI 场景）
  --verbose       输出详细日志
  --quiet         抑制过程输出
  --max-retries N  Debug 最大重试次数（默认 5）

示例:
  jaicode code "修复登录接口空指针异常"
  jaicode debug "npm test" --max-retries 8
  jaicode plan "设计用户认证模块"
  jaicode ask "解释这段代码"
  jaicode config --provider anthropic --api-key sk-xxx
  jaicode market search code-review
`)
  } else {
    console.log(`
${"✨"} Jaicode v${VERSION} — Local-first AI coding agent

Usage:
  jaicode <command> [options]

Commands:
  plan <req>      Generate technical design (Architect mode)
  code <task>     Modify code (Code mode, with Diff confirmation)
  debug <cmd>     Auto-fix (Debug mode, with retry loop)
  ask <question>  Pure Q&A (Ask mode, no file access)
  commit          Commit changes with semantic prefix (bilingual)
  review          Review code changes (bugs/security/style)
  spellcheck      Check Markdown spelling and grammar
  issues <query>  Search GitHub Issues
  learn           Extract learnings to project config
  changelog       Generate changelog from commits
  rmslop          Remove AI-generated code slop
  translate       Translate docs to other languages
  skill <name>    Run a specific skill
  rollback        Restore recent file backup
  config          Manage configuration
  init            Initialize in current project
  market          Manage extension marketplace
  --help, -h      Show help
  --version, -v   Show version

Common Options:
  --lang zh|en    Override language for this run
  --yes, -y       Skip confirmations (CI mode)
  --verbose       Verbose logging
  --quiet         Suppress process output
  --max-retries N Debug max retries (default 5)

Examples:
  jaicode code "Fix null pointer in login handler"
  jaicode debug "npm test" --max-retries 8
  jaicode plan "Design user auth module"
  jaicode ask "Explain this code"
  jaicode config --provider anthropic --api-key sk-xxx
  jaicode market search code-review
`)
  }
}

function printVersion(): void {
  console.log(`jaicode v${VERSION}`)
}

async function ensureJaicodeDir(): Promise<string> {
  const home = process.env.HOME || "~"
  const dir = `${home}/.jaicode`
  await Bun.write(`${dir}/.keep`, "")
  await Bun.write(`${dir}/logs/.keep`, "")
  await Bun.write(`${dir}/extensions/.keep`, "")
  return dir
}

async function loadOrCreateConfig(): Promise<any> {
  const home = process.env.HOME || "~"
  const configPath = `${home}/.jaicode/config.json`
  const file = Bun.file(configPath)

  if (await file.exists()) {
    try {
      return JSON.parse(await file.text())
    } catch {
      // corrupt config, recreate
    }
  }

  // Create default config
  const defaultConfig = {
    version: 1,
    language: detectLanguage(),
    providers: {
      anthropic: { model: "claude-sonnet-4-20250514", enabled: false },
      openai: { model: "gpt-4o", enabled: false },
    },
    defaultProvider: "anthropic",
    agent: { maxRetries: 5, maxFilesPerTask: 20 },
    marketplace: { localDirs: ["~/.jaicode/extensions", "./.jaicode/extensions"] },
    license: { provider: "noop" },
    tips: { enabled: true, triggerCount: 10 },
  }

  await Bun.write(configPath, JSON.stringify(defaultConfig, null, 2))
  return defaultConfig
}

function detectLanguage(): "zh" | "en" {
  const lang = process.env.LANG || process.env.LC_ALL || ""
  if (lang.startsWith("zh")) return "zh"
  return "en"
}

async function loadOrCreateUserProfile(): Promise<any> {
  const home = process.env.HOME || "~"
  const profilePath = `${home}/.jaicode/user.profile`
  const file = Bun.file(profilePath)

  if (await file.exists()) {
    try {
      return JSON.parse(await file.text())
    } catch {
      // recreate
    }
  }

  const now = new Date().toISOString()
  const profile = {
    version: 1,
    name: process.env.USER || "developer",
    role: "fullstack",
    languages: [],
    frameworks: [],
    stylePreferences: { naming: "camelCase", comments: "minimal", indentation: "2spaces", lineWidth: 100 },
    outputPreferences: { language: detectLanguage(), verbosity: "normal", includeExamples: true, explanationLevel: "intermediate" },
    templates: { commitFormat: "{{type}}: {{description}}", commentFormat: "// {{content}}", adrFormat: "default" },
    habits: { commonCommands: [], frequentDirs: [], lastUsedProvider: "anthropic" },
    createdAt: now,
    updatedAt: now,
  }

  await Bun.write(profilePath, JSON.stringify(profile, null, 2))
  return profile
}

function t(key: string, lang: "zh" | "en", vars?: Record<string, string>): string {
  const messages: Record<string, Record<string, string>> = {
    "welcome.title": { zh: `✨ Jaicode v${VERSION} (Preview)`, en: `✨ Jaicode v${VERSION} (Preview)` },
    "welcome.beta_notice": { zh: "当前处于内测阶段 — 免费使用，无限制", en: "Beta preview — free to use" },
    "agent.no_provider": {
      zh: "未配置 LLM 提供商。请运行 `jaicode config --provider <name> --api-key <key>` 进行设置。",
      en: "No LLM provider configured. Run `jaicode config --provider <name> --api-key <key>` to set up.",
    },
    "provider.connected": { zh: "已连接 {name}，模型：{model}", en: "Connected to {name} with model {model}" },
    "market.list_header": { zh: "已安装扩展：", en: "Installed extensions:" },
    "market.empty": { zh: "未安装任何扩展。", en: "No extensions installed." },
    "market.installed": { zh: "已安装：{name}", en: "Installed: {name}" },
    "market.removed": { zh: "已移除：{name}", en: "Removed: {name}" },
    "market.not_found": { zh: "未找到扩展：{name}", en: "Extension not found: {name}" },
    "fs.rollback_success": { zh: "已恢复 {count} 个文件", en: "Restored {count} file(s)" },
    "fs.rollback_none": { zh: "未找到可恢复的备份", en: "No backups found to restore" },
  }

  let msg = messages[key]?.[lang] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      while (msg.includes(`{${k}}`)) {
        msg = msg.replace(`{${k}}`, v)
      }
    }
  }
  return msg
}

async function handleConfig(args: ParsedArgs, config: typeof import("./config").AppConfig, lang: "zh" | "en"): Promise<void> {
  const provider = getFlag(args, "provider") as string | undefined
  const apiKey = getFlag(args, "api-key") as string | undefined
  const model = getFlag(args, "model") as string | undefined
  const langFlag = getFlag(args, "lang") as string | undefined

  const home = process.env.HOME || "~"
  const configPath = `${home}/.jaicode/config.json`

  if (langFlag === "zh" || langFlag === "en") {
    config.language = langFlag
  }

  if (provider) {
    if (!config.providers[provider]) {
      config.providers[provider] = { model: "", enabled: false }
    }
    if (apiKey) {
      config.providers[provider].apiKey = apiKey
      config.providers[provider].enabled = true
    }
    if (model) {
      config.providers[provider].model = model
    }
    config.defaultProvider = provider
    console.log(t("provider.connected", lang, { name: provider, model: config.providers[provider].model }))
  }

  config.updatedAt = new Date().toISOString()
  await Bun.write(configPath, JSON.stringify(config, null, 2))
  console.log(lang === "zh" ? "配置已保存" : "Configuration saved")
}

async function handleRollback(lang: "zh" | "en"): Promise<void> {
  const backupDir = ".jaicode_backup"
  const recordPath = `${backupDir}/index.jsonl`
  const file = Bun.file(recordPath)

  if (!(await file.exists())) {
    console.log(t("fs.rollback_none", lang))
    return
  }

  const text = await file.text()
  const lines = text.split("\n").filter(Boolean)
  if (lines.length === 0) {
    console.log(t("fs.rollback_none", lang))
    return
  }

  const lastLine = lines[lines.length - 1]
  const record = JSON.parse(lastLine)

  console.log(lang === "zh" ? `找到备份：${record.originalPath}` : `Found backup: ${record.originalPath}`)

  const backupFile = Bun.file(record.backupPath)
  const content = await backupFile.text()
  await Bun.write(record.originalPath, content)

  lines.pop()
  await Bun.write(recordPath, lines.join("\n"))

  console.log(t("fs.rollback_success", lang, { count: "1" }))
}

async function handleMarket(args: ParsedArgs, lang: "zh" | "en"): Promise<void> {
  const sub = args.subcommand || "list"
  const home = process.env.HOME || "~"

  switch (sub) {
    case "list": {
      const extDir = `${home}/.jaicode/extensions`
      const proc = Bun.spawn(["ls", "-1", extDir], { stdout: "pipe", stderr: "ignore" })
      const output = await new Response(proc.stdout).text()
      const entries = output.split("\n").filter(Boolean)

      console.log(t("market.list_header", lang))
      if (entries.length === 0) {
        console.log(`  ${t("market.empty", lang)}`)
      } else {
        for (const entry of entries) {
          console.log(`  - ${entry}`)
        }
      }
      break
    }
    case "search": {
      const query = args.positional[0] || ""
      const extDir = `${home}/.jaicode/extensions`
      const proc = Bun.spawn(["ls", "-1", extDir], { stdout: "pipe", stderr: "ignore" })
      const output = await new Response(proc.stdout).text()
      const entries = output.split("\n").filter(Boolean)
      const results = entries.filter((e) => e.toLowerCase().includes(query.toLowerCase()))

      if (results.length === 0) {
        console.log(t("market.not_found", lang, { name: query }))
      } else {
        for (const r of results) {
          console.log(`  - ${r}`)
        }
      }
      break
    }
    case "install": {
      const source = args.positional[0]
      if (!source) {
        console.log(lang === "zh" ? "用法: jaicode market install <路径>" : "Usage: jaicode market install <path>")
        return
      }
      const targetName = source.split("/").pop() || source
      const targetPath = `${home}/.jaicode/extensions/${targetName}`
      const proc = Bun.spawn(["cp", "-r", source, targetPath])
      await proc.exited
      console.log(t("market.installed", lang, { name: targetName }))
      break
    }
    case "remove": {
      const name = args.positional[0]
      if (!name) {
        console.log(lang === "zh" ? "用法: jaicode market remove <名称>" : "Usage: jaicode market remove <name>")
        return
      }
      const proc = Bun.spawn(["rm", "-rf", `${home}/.jaicode/extensions/${name}`])
      await proc.exited
      console.log(t("market.removed", lang, { name: name }))
      break
    }
    default:
      console.log(lang === "zh" ? "未知子命令" : "Unknown subcommand")
  }
}

async function handleInit(lang: "zh" | "en"): Promise<void> {
  const cwd = process.cwd()
  const projectName = cwd.split("/").pop() || "project"
  const configDir = `${cwd}/.jaicode`

  // Create project config
  const projectConfig = {
    version: 1,
    name: projectName,
    description: "",
    techStack: { languages: [], frameworks: [], buildTool: "", testFramework: "" },
    architecture: { style: "monolith", directories: {}, entryPoints: [] },
    conventions: { namingStyle: "camelCase", fileOrganization: "by-feature", codeStyle: {} },
    context: { domainModel: [], coreFlows: [], constraints: [] },
    agentInstructions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await Bun.write(`${configDir}/project.yaml`, JSON.stringify(projectConfig, null, 2))
  console.log(lang === "zh" ? `已初始化项目配置：${configDir}/project.yaml` : `Project config created: ${configDir}/project.yaml`)
}

async function createProviderFromConfig(config: { providers?: Record<string, ProviderConfig> }): Promise<{ name: string; model: string; stream: (msgs: LLMMessage[]) => AsyncGenerator<StreamChunk> } | null> {
  const name = config.defaultProvider
  const cfg = config.providers?.[name]
  if (!cfg?.apiKey) return null

  const { ProviderRegistry } = await import("@jaicode/llm")
  return ProviderRegistry.create(name, { apiKey: cfg.apiKey, model: cfg.model })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  // Ensure jaicode directories exist
  await ensureJaicodeDir()

  // Load config and user profile
  const config = await loadOrCreateConfig()
  const userProfile = await loadOrCreateUserProfile()

  // Determine language
  const langOverride = getFlag(args, "lang") as string | undefined
  const lang: "zh" | "en" = langOverride === "zh" || langOverride === "en" ? langOverride : config.language

  // Handle simple commands first
  if (getFlag(args, "help") || args.command === "--help" || args.command === "-h" || !args.command) {
    printHelp(lang)
    return
  }

  if (getFlag(args, "version") || args.command === "--version" || args.command === "-v") {
    printVersion()
    return
  }

  if (args.command === "config") {
    await handleConfig(args, config, lang)
    return
  }

  if (args.command === "rollback") {
    await handleRollback(lang)
    return
  }

  if (args.command === "market") {
    await handleMarket(args, lang)
    return
  }

  if (args.command === "init") {
    await handleInit(lang)
    return
  }

  // Skill commands (skill system)
  const { SkillLoader } = await import("@jaicode/core")
  // Register built-in skills directory (relative to CLI script)
  const scriptDir = new URL(".", import.meta.url).pathname
  SkillLoader.addSkillsDir(`${scriptDir}/skills`)

  const skillCommands = ["commit", "code-review", "spellcheck", "translate", "issues", "learn", "changelog", "rmslop"]
  const skillAliases: Record<string, string> = { review: "code-review", spell: "spellcheck" }
  if (args.command === "skill" || skillCommands.includes(args.command) || skillAliases[args.command]) {
    const skillName = args.command === "skill" ? args.subcommand || args.positional[0] : (skillAliases[args.command] || args.command)
    if (!skillName) {
      const { SkillRunner } = await import("./skills/runner")
      await SkillRunner.listSkills()
      return
    }

    const skillArgs = args.command === "skill" ? args.positional.slice(1) : args.positional
    const provider = await createProviderFromConfig(config)

    // Load project config if exists
    let projectConfig: Record<string, unknown> | null = null
    const projectFile = Bun.file(`${process.cwd()}/.jaicode/project.yaml`)
    if (await projectFile.exists()) {
      projectConfig = JSON.parse(await projectFile.text())
    }

    const { SkillRunner } = await import("./skills/runner")
    await SkillRunner.invoke(skillName, {
      cwd: process.cwd(),
      lang,
      provider,
      userProfile,
      projectConfig,
      args: skillArgs,
    })
    return
  }

  // Debug --verify mode (Claude Code verify concept)
  if (args.command === "debug" && getFlag(args, "verify")) {
    const provider = await createProviderFromConfig(config)
    if (!provider) {
      console.log(t("agent.no_provider", lang))
      return
    }

    const task = args.positional.join(" ") || "npm test"
    const maxRetries = parseInt((getFlag(args, "max-retries") as string) || "5", 10)

    const { DebugHandler } = await import("./agent/debug")
    const handler = new DebugHandler(provider, maxRetries)

    // Load project config
    let projectConfig: Record<string, unknown> | null = null
    const projectFile = Bun.file(`${process.cwd()}/.jaicode/project.yaml`)
    if (await projectFile.exists()) {
      projectConfig = JSON.parse(await projectFile.text())
    }

    const ctx = {
      mode: "debug" as const,
      cwd: process.cwd(),
      projectConfig,
      userProfile,
      messages: [] as Array<{ role: string; content: string }>,
    }

    const result = await handler.execute(ctx, task)

    if (result.success) {
      // Verify: run additional checks after fix
      console.log(lang === "zh" ? "\n✅ 修复已验证，运行最终确认..." : "\n✅ Fix verified, running final checks...")

      // Try to run the project's verify command if defined
      if (projectConfig && (projectConfig as any).verifyCommand) {
        const verifyCmd = (projectConfig as any).verifyCommand as string
        const proc = Bun.spawn(verifyCmd.split(" "), { cwd: process.cwd(), stdout: "inherit", stderr: "inherit" })
        await proc.exited
      }
    }
    return
  }

  // Agent modes require a provider
  const provider = await createProviderFromConfig(config)
  if (!provider) {
    console.log(t("agent.no_provider", lang))
    return
  }

  const verbose = getFlag(args, "verbose") as boolean || false
  const quiet = getFlag(args, "quiet") as boolean || false
  const maxRetries = parseInt((getFlag(args, "max-retries") as string) || String(config.agent.maxRetries) || "5", 10)
  const skipConfirm = getFlag(args, "yes") as boolean || false

  // Route to appropriate agent mode
  const mode = args.command
  const task = args.positional.join(" ")

  if (!task && mode !== "ask") {
    console.log(lang === "zh" ? `请提供任务描述。使用 \`jaicode ${mode} "你的任务"\`` : `Please provide a task. Use \`jaicode ${mode} "your task"\``)
    return
  }

  const startTime = Date.now()

  try {
    switch (mode) {
      case "ask": {
        const handler = await import("./agent/ask")
        const askHandler = new handler.AskHandler(provider)
        const ctx = {
          mode: "ask" as const,
          cwd: process.cwd(),
          projectConfig: null,
          userProfile,
          messages: [],
        }
        const result = await askHandler.execute(ctx, task || "Hello")
        if (!quiet) {
          console.log(lang === "zh" ? `\n✨ 完成（用时 ${((Date.now() - startTime) / 1000).toFixed(1)}s）` : `\n✨ Done (${((Date.now() - startTime) / 1000).toFixed(1)}s)`)
        }
        break
      }
      case "code": {
        const handler = await import("./agent/code")
        const codeHandler = new handler.CodeHandler(provider)
        const ctx = {
          mode: "code" as const,
          cwd: process.cwd(),
          projectConfig: null,
          userProfile,
          messages: [],
        }
        // Load project config if exists
        const projectFile = Bun.file(`${process.cwd()}/.jaicode/project.yaml`)
        if (await projectFile.exists()) {
          ctx.projectConfig = JSON.parse(await projectFile.text())
        }
        const result = await codeHandler.execute(ctx, task)
        break
      }
      case "debug": {
        const handler = await import("./agent/debug")
        const debugHandler = new handler.DebugHandler(provider, maxRetries)
        const ctx = {
          mode: "debug" as const,
          cwd: process.cwd(),
          projectConfig: null,
          userProfile,
          messages: [],
        }
        const result = await debugHandler.execute(ctx, task)
        break
      }
      case "plan": {
        const handler = await import("./agent/architect")
        const archHandler = new handler.ArchitectHandler(provider)
        const ctx = {
          mode: "plan" as const,
          cwd: process.cwd(),
          projectConfig: null,
          userProfile,
          messages: [],
        }
        const projectFile = Bun.file(`${process.cwd()}/.jaicode/project.yaml`)
        if (await projectFile.exists()) {
          ctx.projectConfig = JSON.parse(await projectFile.text())
        }
        const result = await archHandler.execute(ctx, task)
        break
      }
      default:
        console.log(lang === "zh" ? `未知命令：${mode}` : `Unknown command: ${mode}`)
        printHelp(lang)
    }
  } catch (e: any) {
    console.error(lang === "zh" ? `错误：${e.message}` : `Error: ${e.message}`)
    if (verbose) {
      console.error(e.stack)
    }
    process.exit(1)
  }
}

main()
