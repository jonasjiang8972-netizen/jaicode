/**
 * Auto Update — Check for updates and self-upgrade
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const UPDATE_CHECK_FILE = path.join(os.homedir(), '.jaicode', '.last-update-check')
const GITHUB_REPO = 'jonasjiang8972-netizen/jaicode'
const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour

// ─── Check for Updates ─────────────────────────────────
export async function checkForUpdate() {
  try {
    // Rate limit: only check once per hour
    const lastCheck = getLastCheck()
    if (lastCheck && Date.now() - lastCheck < CHECK_INTERVAL) {
      return { hasUpdate: false, cached: true }
    }

    // Fetch latest release from GitHub
    const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    if (!resp.ok) return { hasUpdate: false, error: `HTTP ${resp.status}` }

    const release = await resp.json()
    const latestVersion = release.tag_name.replace(/^v/, '')
    const currentVersion = getCurrentVersion()

    setLastCheck()

    if (compareVersions(latestVersion, currentVersion) > 0) {
      return {
        hasUpdate: true,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseNotes: release.body,
      }
    }

    return { hasUpdate: false, currentVersion, latestVersion }
  } catch (e) {
    return { hasUpdate: false, error: e.message }
  }
}

// ─── Self-Upgrade ──────────────────────────────────────
export async function selfUpgrade() {
  try {
    // Method 1: npm update
    execSync('npm update -g @jaicode/cli', { stdio: 'pipe' })
    return { success: true, method: 'npm' }
  } catch {
    try {
      // Method 2: git pull
      execSync('git pull origin main', { stdio: 'pipe' })
      execSync('bun install', { stdio: 'pipe' })
      return { success: true, method: 'git' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
}

// ─── Helpers ───────────────────────────────────────────
function getCurrentVersion() {
  try {
    const pkgPath = path.join(os.homedir(), '.jaicode', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch { return '0.0.0' }
}

function getLastCheck() {
  try {
    return parseInt(fs.readFileSync(UPDATE_CHECK_FILE, 'utf-8').trim())
  } catch { return null }
}

function setLastCheck() {
  try {
    fs.mkdirSync(path.dirname(UPDATE_CHECK_FILE), { recursive: true })
    fs.writeFileSync(UPDATE_CHECK_FILE, Date.now().toString())
  } catch { /* ignore */ }
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export { GITHUB_REPO, CHECK_INTERVAL }
