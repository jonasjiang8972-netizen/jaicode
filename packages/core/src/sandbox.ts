export type FileOperation = "read" | "write" | "delete" | "move" | "copy"
export type PermissionAction = "allow" | "ask" | "deny"

export interface PermissionRule {
  pattern: string
  action: PermissionAction
}

export class Sandbox {
  private rules: PermissionRule[] = []

  addRule(pattern: string, action: PermissionAction): void {
    this.rules.push({ pattern, action })
  }

  check(operation: FileOperation, path: string): PermissionAction {
    // Last matching rule wins
    let result: PermissionAction = "ask"
    for (const rule of this.rules) {
      if (Sandbox.match(path, rule.pattern)) {
        result = rule.action
      }
    }
    return result
  }

  private static match(path: string, pattern: string): boolean {
    if (pattern === "*") return true
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, "___DOUBLESTAR___")
          .replace(/\*/g, "[^/]*")
          .replace(/___DOUBLESTAR___/g, ".*") +
        "$",
    )
    return regex.test(path)
  }

  static createReadOnly(): Sandbox {
    const sb = new Sandbox()
    sb.addRule("*", "allow")
    sb.addRule("*.env", "ask")
    sb.addRule("*.env.*", "ask")
    return sb
  }

  static createReadWrite(): Sandbox {
    const sb = new Sandbox()
    sb.addRule("*", "ask")
    sb.addRule("*.env", "deny")
    sb.addRule("*.env.*", "deny")
    sb.addRule("node_modules/**", "deny")
    return sb
  }
}
