export interface ParsedArgs {
  command: string
  subcommand?: string
  positional: string[]
  flags: Record<string, string | boolean>
}

export class CommandParser {
  static parse(argv: string[]): ParsedArgs {
    const result: ParsedArgs = {
      command: "",
      subcommand: undefined,
      positional: [],
      flags: {},
    }

    let i = 0
    // Skip binary path and script path
    while (i < argv.length && (argv[i].includes("bun") || argv[i].endsWith(".ts") || argv[i].endsWith("jaicode"))) {
      i++
    }

    if (i >= argv.length) return result

    result.command = argv[i]
    i++

    // Check for subcommand
    if (i < argv.length && !argv[i].startsWith("-")) {
      const sub = argv[i]
      // For market commands: search, install, list, etc.
      if (["search", "install", "list", "remove", "update", "info"].includes(sub)) {
        result.subcommand = sub
        i++
      }
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
        const flag = arg.slice(1)
        if (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
          result.flags[flag] = argv[++i]
        } else {
          result.flags[flag] = true
        }
      } else {
        result.positional.push(arg)
      }
    }

    return result
  }

  static getFlag(
    args: ParsedArgs,
    key: string,
    defaultValue?: string | boolean,
  ): string | boolean | undefined {
    return args.flags[key] ?? (args.flags[key[0]] || defaultValue)
  }
}
