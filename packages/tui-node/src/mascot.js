/**
 * Jai the Dinosaur - Jaicode's pixel mascot
 * Animated pixel art character for terminal interaction
 * Uses terminal-safe block characters for universal compatibility
 */

// ─── Animation Frames ────────────────────────────────────
const FRAMES = {
  idle: [
    // Idle breathing - frame 1
    [
      '      ╭──────╮      ',
      '     │ ●  ● │      ',
      '     │  ▽▽  │      ',
      '   ╭─┴──────┴─╮    ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
    // Idle breathing - frame 2 (slight scale)
    [
      '      ╭──────╮      ',
      '     │ ●  ● │      ',
      '     │  ▽▽  │      ',
      '   ╭─┴──────┴─╮    ',
      '   │█████████│    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
  ],

  // Thinking animation - dinosaur tilts head, thinking bubbles appear
  thinking: [
    // Frame 1
    [
      '      ╭──────╮      ',
      '     │ ◉  ● │  ○   ',
      '     │  ▽▽  │  ○   ',
      '   ╭─┴──────┴─╮○   ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
    // Frame 2 - bigger bubble
    [
      '      ╭──────╮      ',
      '     │ ◉  ● │  ◎   ',
      '     │  ▽▽  │  ○   ',
      '   ╭─┴──────┴─╮○   ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
    // Frame 3 - eye sparkle
    [
      '      ╭──────╮      ',
      '     │ ★  ● │  ◯   ',
      '     │  ▽▽  │  ◎   ',
      '   ╭─┴──────┴─╮○   ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
  ],

  // Talking animation - mouth moves
  talking: [
    // Frame 1 - mouth open small
    [
      '      ╭──────╮      ',
      '     │ ●  ● │      ',
      '     │  ──  │      ',
      '   ╭─┴──────┴─╮    ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
    // Frame 2 - mouth open wide
    [
      '      ╭──────╮      ',
      '     │ ●  ● │      ',
      '     │  ━━  │      ',
      '   ╭─┴──────┴─╮    ',
      '   │ ███████ │    ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
  ],

  // Celebration animation - jumping and stars
  celebrate: [
    // Frame 1 - jump up
    [
      '  ☆   ╭──────╮   ☆ ',
      '     │ ★  ★ │      ',
      '     │  ▽▽  │      ',
      '   ╭─┴──────┴─╮    ',
      ' ☆ │ ███████ │ ☆  ',
      '   │█████████│    ',
      '   ╰┬─╮  ╭─┬─╯    ',
      '    │ │  │ │      ',
      '   ☆╰╮   ╰╮☆      ',
      '     └──┬┘        ',
    ],
    // Frame 2 - high jump
    [
      ' ★ ☆ ╭──────╮ ☆ ★  ',
      '     │ ✦  ✦ │      ',
      '     │  ▽▽  │      ',
      '   ╭─┴──────┴─╮    ',
      ' ★ │ ███████ │ ★  ',
      '   │█████████│    ',
      '  ☆╰┬─╮  ╭─┬─╯☆   ',
      '    │ │  │ │      ',
      '    ╰╮   ╰╮       ',
      '     └──┬┘        ',
    ],
  ],

  // Small version for header bar (compact 5-row)
  smallIdle: [
    [
      '  ╭────╮  ',
      ' │ ●  ●│  ',
      ' │ ▽▽ │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
    [
      '  ╭────╮  ',
      ' │ ●  ●│  ',
      ' │ ▽▽ │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
  ],

  smallThinking: [
    [
      '  ╭────╮ ○',
      ' │ ◉  ●│○ ',
      ' │ ▽▽ │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
    [
      '  ╭────╮ ◎',
      ' │ ◉  ●│○ ',
      ' │ ▽▽ │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
  ],

  smallTalking: [
    [
      '  ╭────╮  ',
      ' │ ●  ●│  ',
      ' │ ── │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
    [
      '  ╭────╮  ',
      ' │ ●  ●│  ',
      ' │ ━━ │  ',
      ' ╰┬──┬╯  ',
      '  │  │   ',
    ],
  ],
}

// ─── Animation Controller ───────────────────────────────
class JaiMascot {
  constructor() {
    this.state = 'idle'
    this.frameIndex = 0
    this.timer = null
    this.sizes = { idle: 10, thinking: 10, talking: 10, celebrate: 10, smallIdle: 5, smallThinking: 5, smallTalking: 5 }
  }

  setState(newState) {
    if (this.state === newState) return
    this.state = newState
    this.frameIndex = 0
    this._resetTimer()
  }

  _resetTimer() {
    if (this.timer) clearInterval(this.timer)
    const fps = this.state === 'celebrate' ? 400 : this.state === 'thinking' ? 350 : 600
    this.timer = setInterval(() => {
      const frameKey = this.state
      const frames = FRAMES[frameKey] || FRAMES.idle
      this.frameIndex = (this.frameIndex + 1) % frames.length
    }, fps)
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  }

  render(small = false) {
    const frameKey = small
      ? (this.state === 'thinking' ? 'smallThinking' : this.state === 'talking' ? 'smallTalking' : 'smallIdle')
      : this.state
    const frames = FRAMES[frameKey] || FRAMES[small ? 'smallIdle' : 'idle']
    const frame = frames[this.frameIndex % frames.length]
    return frame
  }

  renderWithText(text, small = false) {
    const frame = this.render(small)
    const maxLen = Math.max(...frame.map(l => l.length))
    if (!text) return frame
    // Replace placeholder or append text
    return frame.map((line, i) => {
      if (i === 0) return `  ${line}  ${text}`
      return `  ${line}`
    })
  }

  destroy() { this.stop() }
}

export { JaiMascot, FRAMES }
