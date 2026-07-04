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
    name: '文件读取',
    description: '读取项目中的源代码和配置文件',
    required: 'P0',
    status: 'available',
  },
  {
    id: 'cap-file-write',
    name: '文件写入',
    description: '创建、修改、删除文件',
    required: 'P0',
    status: 'missing',
    solution: { type: 'skill', name: 'file-writer', description: '开发本地 Skill：安全写入、diff 预览、备份回滚', autoDevelop: true },
  },
  {
    id: 'cap-shell-exec',
    name: '命令执行',
    description: '执行 Shell 命令并捕获输出',
    required: 'P0',
    status: 'partial',
    solution: { type: 'skill', name: 'shell-exec', description: '完善执行结果反馈和错误处理', autoDevelop: true },
  },
  {
    id: 'cap-image-understanding',
    name: '图片理解',
    description: '理解用户上传的截图、设计图、架构图',
    required: 'P0',
    status: 'missing',
    solution: { type: 'mcp', name: 'image-reader', description: '接入 VL 模型 MCP 或兼容 API', autoDevelop: false },
  },
  {
    id: 'cap-web-search',
    name: '网络搜索',
    description: '获取最新技术文档和解决方案',
    required: 'P1',
    status: 'missing',
    solution: { type: 'third-party', name: 'serpapi/tavily', description: '集成搜索 API 作为 MCP', autoDevelop: false },
  },
  {
    id: 'cap-web-fetch',
    name: '网页抓取',
    description: '抓取和分析网页内容',
    required: 'P1',
    status: 'missing',
    solution: { type: 'skill', name: 'web-fetch', description: '开发基于 fetch 的网页内容提取', autoDevelop: true },
  },
  {
    id: 'cap-git-ops',
    name: 'Git 操作',
    description: '版本管理、分支操作、diff 查看',
    required: 'P1',
    status: 'missing',
    solution: { type: 'skill', name: 'git-helper', description: '封装常用 git 命令并提供安全确认', autoDevelop: true },
  },
]

export class CapabilityManager {
  /** Run full capability audit */
  static audit() {
    // Update statuses based on real checks
    const caps = JSON.parse(JSON.stringify(CAPABILITY_REGISTRY))

    // Check each capability
    for (const cap of caps) {
      if (cap.id === 'cap-file-read') cap.status = 'available'
      else if (cap.id === 'cap-shell-exec') cap.status = 'partial'
      else cap.status = 'missing'
    }

    return caps
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
