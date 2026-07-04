/**
 * Clipboard Monitor — Detect and read image data from system clipboard
 * macOS: uses pngpaste or osascript
 * Linux: uses xclip or wl-paste
 * Windows: uses PowerShell
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const TEMP_DIR = path.join(os.homedir(), '.jaicode', '.temp')

function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// ─── Platform Detection ────────────────────────────────
function getPlatform() {
  const platform = process.platform
  if (platform === 'darwin') return 'macos'
  if (platform === 'linux') return 'linux'
  if (platform === 'win32') return 'windows'
  return 'unknown'
}

// ─── macOS: pngpaste ───────────────────────────────────
function readClipboardMacOS() {
  ensureTempDir()
  const tmpPath = path.join(TEMP_DIR, `clipboard-${Date.now()}.png`)

  try {
    execSync(`pngpaste "${tmpPath}"`, { stdio: 'pipe' })
    const stat = fs.statSync(tmpPath)
    if (stat.size > 0) return tmpPath
    fs.unlinkSync(tmpPath)
    return null
  } catch {
    // pngpaste not installed or no image
    return null
  }
}

// ─── macOS: osascript fallback ─────────────────────────
function readClipboardMacOSNative() {
  ensureTempDir()
  const tmpPath = path.join(TEMP_DIR, `clipboard-${Date.now()}.png`)

  try {
    // AppleScript to save clipboard image
    const script = `
      set f to open for access POSIX file "${tmpPath}" with write permission
      try
        write (the clipboard as «class PNGf») to f
      on error
        close access f
        return "no_image"
      end try
      close access f
      return "ok"
    `
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf-8', stdio: 'pipe' }).trim()

    if (result === 'ok') {
      const stat = fs.statSync(tmpPath)
      if (stat.size > 0) return tmpPath
    }

    // Clean up
    try { fs.unlinkSync(tmpPath) } catch {}
    return null
  } catch {
    try { fs.unlinkSync(tmpPath) } catch {}
    return null
  }
}

// ─── Linux: xclip ──────────────────────────────────────
function readClipboardLinux() {
  ensureTempDir()
  const tmpPath = path.join(TEMP_DIR, `clipboard-${Date.now()}.png`)

  try {
    execSync(`xclip -selection clipboard -t image/png -o > "${tmpPath}"`, { stdio: 'pipe' })
    const stat = fs.statSync(tmpPath)
    if (stat.size > 0) return tmpPath
    fs.unlinkSync(tmpPath)
    return null
  } catch {
    return null
  }
}

// ─── Windows: PowerShell ───────────────────────────────
function readClipboardWindows() {
  ensureTempDir()
  const tmpPath = path.join(TEMP_DIR, `clipboard-${Date.now()}.png`)

  try {
    execSync(
      `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $img = [System.Windows.Forms.Clipboard]::GetImage(); if ($img) { $img.Save('${tmpPath}'); }"`,
      { stdio: 'pipe' }
    )
    const stat = fs.statSync(tmpPath)
    if (stat.size > 0) return tmpPath
    fs.unlinkSync(tmpPath)
    return null
  } catch {
    return null
  }
}

// ─── Unified API ───────────────────────────────────────
export function readClipboardImage() {
  const platform = getPlatform()

  switch (platform) {
    case 'macos':
      return readClipboardMacOS() || readClipboardMacOSNative()
    case 'linux':
      return readClipboardLinux()
    case 'windows':
      return readClipboardWindows()
    default:
      return null
  }
}

// ─── Check if clipboard has image (without saving) ────
export function clipboardHasImage() {
  return readClipboardImage() !== null
}

export { getPlatform, TEMP_DIR }
