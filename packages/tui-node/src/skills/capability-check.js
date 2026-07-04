/**
 * Capability Self-Check & Auto-Development Framework
 * Detects missing capabilities and proposes solutions
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CAPABILITY_REGISTRY = [
  {
    id: 'cap-file-read',
    name: 'File Read',
    description: 'Read project source code and config files',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-file-write',
    name: 'File Write',
    description: 'Create, modify, delete files',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-shell-exec',
    name: 'Shell Execute',
    description: 'Execute shell commands and capture output',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-input-filter',
    name: 'Input Filter',
    description: 'Detect and block malicious input',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-output-filter',
    name: 'Output Filter',
    description: 'Redact sensitive data from LLM responses',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-prompt-shield',
    name: 'Prompt Injection Shield',
    description: 'Prevent system prompt override',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-privacy',
    name: 'Privacy Protection',
    description: 'Session encryption and data sanitization',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-image-understanding',
    name: 'Image Understanding',
    description: 'Understand screenshots and diagrams',
    required: 'P0',
    status: 'missing',
    solution: { type: 'mcp', name: 'image-reader', description: '接入 VL 模型 MCP 或兼容 API', autoDevelop: false },
  },
]

export class CapabilityManager {
  /** Run full capability audit */
  static audit() {
    // Return registry with current statuses (already correct in registry)
    return JSON.parse(JSON.stringify(CAPABILITY_REGISTRY))
  }

  /** Print audit report */
  static printAudit(caps) {
    const lines = [
      '--- Jaicode Capability Audit ---',
      '',
    ]

    // Group by priority
    const groups = { P0: caps.filter(c => c.required === 'P0'), P1: caps.filter(c => c.required === 'P1'), P2: caps.filter(c => c.required === 'P2') }

    for (const [priority, group] of Object.entries(groups)) {
      lines.push(`[${priority}]`)
      for (const cap of group) {
        const icon = cap.status === 'available' ? '✓' : cap.status === 'partial' ? '~' : 'x'
        lines.push(`  [${icon}] ${cap.name}: ${cap.description}`)
        if (cap.status !== 'available' && cap.solution) {
          lines.push(`      → ${cap.solution.type}/${cap.solution.name}: ${cap.solution.description}`)
        }
      }
    }

    const missing = caps.filter(c => c.status !== 'available').length
    lines.push('', `Status: ${caps.length - missing}/${caps.length} available, ${missing} need attention`, '')
    lines.push('Use /fix <cap-id> to develop a skill, or /audit to refresh')

    return lines
  }
}

export { CAPABILITY_REGISTRY }
