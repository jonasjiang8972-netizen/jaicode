export interface FileDiff {
  path: string
  oldContent: string
  newContent: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export class DiffEngine {
  static compute(oldContent: string, newContent: string): FileDiff {
    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")
    const hunks = DiffEngine.diffLines(oldLines, newLines)

    let additions = 0
    let deletions = 0
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith("+")) additions++
        else if (line.startsWith("-")) deletions++
      }
    }

    return {
      path: "",
      oldContent,
      newContent,
      additions,
      deletions,
      hunks,
    }
  }

  private static diffLines(oldLines: string[], newLines: string[]): DiffHunk[] {
    // Simple longest common subsequence (LCS) diff
    const m = oldLines.length
    const n = newLines.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }

    const hunks: DiffHunk[] = []
    let i = 0,
      j = 0
    let currentHunk: DiffHunk | null = null
    const contextLines = 2

    while (i < m || j < n) {
      if (i < m && j < n && oldLines[i] === newLines[j]) {
        if (currentHunk) {
          currentHunk.lines.push(` ${oldLines[i]}`)
          if (currentHunk.lines.length > contextLines * 2 + 1) {
            hunks.push(currentHunk)
            currentHunk = null
          }
        } else {
          currentHunk = {
            oldStart: i + 1,
            oldLines: 0,
            newStart: j + 1,
            newLines: 0,
            lines: [` ${oldLines[i]}`],
          }
        }
        i++
        j++
      } else {
        if (!currentHunk) {
          currentHunk = {
            oldStart: Math.max(1, i),
            oldLines: 0,
            newStart: Math.max(1, j),
            newLines: 0,
            lines: [],
          }
        }
        if (j >= n || (i < m && dp[i + 1][j] >= dp[i][j + 1])) {
          currentHunk.lines.push(`-${oldLines[i]}`)
          currentHunk.oldLines++
          i++
        } else {
          currentHunk.lines.push(`+${newLines[j]}`)
          currentHunk.newLines++
          j++
        }
      }
    }

    if (currentHunk && currentHunk.lines.some((l) => l.startsWith("+") || l.startsWith("-"))) {
      hunks.push(currentHunk)
    }

    return hunks
  }

  static format(diff: FileDiff, colors: boolean = true): string {
    const lines: string[] = []
    lines.push(`--- a/${diff.path}`)
    lines.push(`+++ b/${diff.path}`)

    for (const hunk of diff.hunks) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
      for (const line of hunk.lines) {
        if (colors) {
          if (line.startsWith("+")) lines.push(`\x1b[32m${line}\x1b[0m`)
          else if (line.startsWith("-")) lines.push(`\x1b[31m${line}\x1b[0m`)
          else lines.push(`\x1b[90m${line}\x1b[0m`)
        } else {
          lines.push(line)
        }
      }
    }

    return lines.join("\n")
  }
}
