/**
 * Sub-Agent System — Parallel task execution
 * Spawns child agents that work on different parts of a task
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { info, error, debug } from '../logging/logger.js'

// ─── Agent Task ────────────────────────────────────────
const AgentStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

// ─── Agent Pool ────────────────────────────────────────
class AgentPool {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent
    this.agents = new Map()
    this.queue = []
  }

  async spawn(task) {
    const agent = {
      ...task,
      status: 'running',
      startTime: Date.now(),
    }
    this.agents.set(task.id, agent)

    debug('Agent spawned', { id: task.id, description: task.description })

    try {
      // Run the agent in a child process
      const result = await this.runAgentProcess(agent)
      agent.status = 'completed'
      agent.result = result
      agent.endTime = Date.now()
      return result
    } catch (e) {
      agent.status = 'failed'
      agent.error = e.message
      error('Agent failed', { id: task.id, error: e.message })
      throw e
    }
  }

  runAgentProcess(agent) {
    return new Promise((resolve, reject) => {
      const timeout = 120000 // 2 min timeout
      let stdout = ''
      let stderr = ''

      const proc = spawn(process.execPath, ['-e', this.getAgentScript(agent)], {
        cwd: agent.cwd || process.cwd(),
        env: process.env,
        timeout,
      })

      proc.stdout.on('data', d => { stdout += d.toString() })
      proc.stderr.on('data', d => { stderr += d.toString() })

      proc.on('close', code => {
        if (code === 0) resolve(stdout.trim())
        else reject(new Error(stderr || `Exit code: ${code}`))
      })

      proc.on('error', reject)
    })
  }

  getAgentScript(agent) {
    return `
      const { callLLM } = require('./packages/tui-node/src/llm-adapter.js')
      const messages = [
        { role: 'user', content: ${JSON.stringify(agent.description)} }
      ]
      callLLM(messages).then(r => console.log(r.content)).catch(e => { console.error(e.message); process.exit(1) })
    `
  }

  async runParallel(tasks) {
    const results = []
    const running = []

    for (const task of tasks) {
      if (running.length >= this.maxConcurrent) {
        const done = await Promise.race(running)
        running.splice(running.indexOf(done), 1)
      }

      const promise = this.spawn(task).then(result => {
        results.push({ id: task.id, result })
        return promise
      })

      running.push(promise)
    }

    await Promise.all(running)
    return results
  }

  getStatus() {
    const status = { pending: 0, running: 0, completed: 0, failed: 0 }
    for (const agent of this.agents.values()) {
      status[agent.status]++
    }
    return status
  }

  destroy() {
    for (const agent of this.agents.values()) {
      if (agent.status === 'running') {
        // Kill child process
        try { agent.process?.kill() } catch (e) { /* process already exited */ }
      }
    }
    this.agents.clear()
  }
}

// ─── Simple Sequential Agent (for now) ─────────────────
export async function runSubAgent(description, cwd, providerConfig) {
  info('Sub-agent started', { description: description.slice(0, 100) })

  try {
    // In MVP, run sequentially via LLM
    const messages = [
      { role: 'system', content: 'You are a sub-agent working on a specific task. Be concise and focus on the task.' },
      { role: 'user', content: description },
    ]

    // Call LLM directly
    const { callLLM } = await import('./tui.js')
    const result = await callLLM(messages)

    info('Sub-agent completed', { resultLength: result.content?.length })
    return result
  } catch (e) {
    error('Sub-agent failed', { error: e.message })
    throw e
  }
}

export function decomposeTask(goal, maxTasks = 4) {
  const tasks = []

  if (goal.files && goal.files.length > 0) {
    for (const file of goal.files.slice(0, maxTasks)) {
      tasks.push({
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: `${goal.action}: ${file}`,
        files: [file],
        status: AgentStatus.PENDING,
      })
    }
  } else {
    tasks.push({
      id: `task-${Date.now()}`,
      description: goal.action,
      status: AgentStatus.PENDING,
    })
  }

  return tasks
}

export { AgentPool, AgentStatus }
