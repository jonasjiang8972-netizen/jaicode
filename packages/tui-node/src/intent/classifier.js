/**
 * Semantic Intent Classifier
 * Two-level classification: regex fast-path + LLM fallback
 */

// ─── Level 1: Regex Rules ──────────────────────────────
const REGEX_RULES = [
  { mode: 'plan', patterns: [/设计|架构|方案|规划|plan for|design|architecture/i], weight: 0.4 },
  { mode: 'plan', patterns: [/批量|所有文件|refactor all|整体重构/i], weight: 0.3 },
  { mode: 'debug', patterns: [/修复|fix|bug|报错|错误|不工作|broken|test failed/i], weight: 0.35 },
  { mode: 'debug', patterns: [/排查|调试|debug|为什么.*不|跑不通/i], weight: 0.3 },
  { mode: 'ask', patterns: [/解释|explain|什么|为什么|how|what|描述|describe/i], weight: 0.35 },
  { mode: 'ask', patterns: [/是什么意思|帮我理解|介绍一下/i], weight: 0.25 },
  { mode: 'code', patterns: [/添加|修改|创建|实现|编写|add|create|implement|write/i], weight: 0.3 },
  { mode: 'code', patterns: [/改成|替换|优化|重写|refactor/i], weight: 0.25 },
]

const CONFIDENCE_THRESHOLD = 0.7
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ─── Cache ────────────────────────────────────────────
const cache = new Map()

function getCached(input) {
  const hit = cache.get(input)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.result
  cache.delete(input)
  return null
}

function setCache(input, result) {
  cache.set(input, { result, ts: Date.now() })
}

// ─── Level 1: Regex Classification ─────────────────────
function regexClassify(input) {
  const scores = { plan: 0, code: 0, debug: 0, ask: 0 }

  for (const rule of REGEX_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(input)) {
        scores[rule.mode] += rule.weight
      }
    }
  }

  // Find highest scoring mode
  let bestMode = 'code'
  let bestScore = 0
  for (const [mode, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestMode = mode
    }
  }

  return { mode: bestMode, confidence: Math.min(bestScore, 1.0) }
}

// ─── Level 2: LLM Classification ──────────────────────
async function llmClassify(input, callLLM) {
  const prompt = `Classify this user request into exactly one category:
- "plan": architecture design, system planning, batch operations
- "code": write code, modify files, implement features
- "debug": fix bugs, troubleshoot errors, analyze failures
- "ask": explain concepts, answer questions, describe things

User input: "${input}"
Reply with ONLY the category name (plan/code/debug/ask), nothing else.`

  try {
    const response = await callLLM([
      { role: 'user', content: prompt },
    ])
    const mode = response.trim().toLowerCase().replace(/[^a-z]/g, '')
    if (['plan', 'code', 'debug', 'ask'].includes(mode)) {
      return { mode, confidence: 0.95 }
    }
  } catch { /* fallback to regex */ }

  return null
}

// ─── Main Entry ───────────────────────────────────────
export async function classifyIntent(input, callLLM) {
  // Check cache
  const cached = getCached(input)
  if (cached) return cached

  // Level 1: Regex
  const regexResult = regexClassify(input)

  // If confidence high enough, return
  if (regexResult.confidence >= CONFIDENCE_THRESHOLD) {
    setCache(input, regexResult)
    return regexResult
  }

  // Level 2: LLM fallback
  if (callLLM) {
    const llmResult = await llmClassify(input, callLLM)
    if (llmResult) {
      setCache(input, llmResult)
      return llmResult
    }
  }

  // Fallback to regex result
  setCache(input, regexResult)
  return regexResult
}

export { regexClassify }
