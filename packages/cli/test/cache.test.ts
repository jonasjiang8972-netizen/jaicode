import { test, expect } from 'bun:test'

const base = '/Users/jonasjiang/projects/jaicode/packages/tui-node/src/cache'
const { HashIndex } = await import(`${base}/hash-index`)
const { PrefixExtractor } = await import(`${base}/prefix-extractor`)

test('HashIndex tracks files', () => {
  const idx = new HashIndex()
  idx.addFile('test.ts', 'const x = 1', { mtime: 1000 })

  expect(idx.hasFile('test.ts')).toBe(true)
  expect(idx.getHash('test.ts')?.length).toBe(64) // SHA-256 hex
})

test('HashIndex detects changes', () => {
  const idx = new HashIndex()
  idx.addFile('app.ts', 'v1')
  const hash1 = idx.getHash('app.ts')

  idx.addFile('app.ts', 'v2')
  const hash2 = idx.getHash('app.ts')

  expect(hash1).not.toBe(hash2)
})

test('HashIndex computes correct SHA-256', () => {
  const idx = new HashIndex()
  const hash = idx.addFile('hello.txt', 'hello world')

  // Known SHA-256 for "hello world"
  expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
})

test('HashIndex sorts files for consistency', () => {
  const idx = new HashIndex()
  idx.addFile('z.ts', 'z')
  idx.addFile('a.ts', 'a')
  idx.addFile('m.ts', 'm')

  const staticFiles = idx.getStaticPrefix()
  const paths = staticFiles.map(f => f.path)

  expect(paths).toEqual(['a.ts', 'm.ts', 'z.ts'])
})

test('PrefixExtractor splits context', () => {
  const extractor = new PrefixExtractor({ cacheThreshold: 100 })

  const staticPrefix = extractor.extractStaticPrefix(
    [{ path: 'main.ts', content: 'package main' }],
    'You are a coding assistant'
  )

  expect(staticPrefix.length).toBeGreaterThan(0)
})

test('PrefixExtractor excludes sensitive files', () => {
  const extractor = new PrefixExtractor()

  const result = extractor.buildAnthropicRequest(
    [
      { path: '.env', content: 'SECRET=123', role: undefined },
      { path: 'main.ts', content: 'package main', role: undefined },
    ],
    [{ type: 'user_input', content: 'hello' }]
  )

  // .env should not be in the prefix
  const systemStr = JSON.stringify(result.system)
  expect(systemStr).not.toContain('.env')
  expect(systemStr).not.toContain('SECRET')
})

test('PrefixEstimator estimates tokens', () => {
  const extractor = new PrefixExtractor({})

  // Rough estimation: English ~4 chars/token
  const tokens = extractor.estimateTokens('hello world foo bar')
  expect(tokens).toBeGreaterThan(0)
  expect(tokens).toBeLessThan(10)
})

test('Shared secret stays out of cache', () => {
  const extractor = new PrefixExtractor({})

  expect(extractor.isSensitive('.env')).toBe(true)
  expect(extractor.isSensitive('secret.key')).toBe(true)
  expect(extractor.isSensitive('src/main.ts')).toBe(false)
})
