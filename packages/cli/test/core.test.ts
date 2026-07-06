import { test, expect } from 'bun:test'
import { CommandParser } from '@jaicode/core/command-parser'
import { DiffEngine } from '@jaicode/core/diff'

test('CommandParser parses basic commands', () => {
  const result = CommandParser.parse(['bun', 'jaicode', 'code', 'fix login bug'])
  expect(result.command).toBe('code')
  expect(result.positional).toEqual(['fix login bug'])
})

test('CommandParser parses flags', () => {
  const result = CommandParser.parse(['bun', 'jaicode', 'debug', 'npm test', '--yes', '--verbose'])
  expect(result.command).toBe('debug')
  expect(result.flags.yes).toBe(true)
  expect(result.flags.verbose).toBe(true)
  expect(result.positional).toEqual(['npm test'])
})

test('CommandParser parses short flags', () => {
  const result = CommandParser.parse(['bun', 'jaicode', 'ask', '-y', '-q'])
  expect(result.command).toBe('ask')
  expect(result.flags.y).toBe(true)
  expect(result.flags.q).toBe(true)
})

test('CommandParser parses subcommands', () => {
  const result = CommandParser.parse(['bun', 'jaicode', 'market', 'search', 'code-review'])
  expect(result.command).toBe('market')
  expect(result.subcommand).toBe('search')
  expect(result.positional).toEqual(['code-review'])
})

test('CommandParser handles empty args', () => {
  const result = CommandParser.parse(['bun', 'jaicode'])
  expect(result.command).toBe('')
})

test('DiffEngine computes correct diff', () => {
  const oldContent = 'function hello() {\n  return "world"\n}'
  const newContent = 'function hello() {\n  return "jaicode"\n}'
  const diff = DiffEngine.compute(oldContent, newContent)
  expect(diff.hunks.length).toBe(1)
  expect(diff.additions).toBeGreaterThan(0)
  expect(diff.deletions).toBeGreaterThan(0)
})

test('DiffEngine handles identical content', () => {
  const content = 'same content'
  const diff = DiffEngine.compute(content, content)
  expect(diff.hunks.length).toBe(0)
})

test('DiffEngine handles empty old content', () => {
  const diff = DiffEngine.compute('', 'new content\nsecond line')
  expect(diff.additions).toBe(2)
  expect(diff.deletions).toBe(0)
})

test('DiffEngine handles empty new content', () => {
  const diff = DiffEngine.compute('old content', '')
  expect(diff.additions).toBe(0)
  expect(diff.deletions).toBe(1)
})
