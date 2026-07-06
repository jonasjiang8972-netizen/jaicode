import { test, expect } from 'bun:test'
import { detectLanguage, isTextFile, isImageFile } from '../../cli/src/skills/file-reader'

test('detectLanguage identifies TypeScript', () => {
  expect(detectLanguage('file.ts')).toBe('typescript')
  expect(detectLanguage('file.tsx')).toBe('typescript')
  expect(detectLanguage('file.js')).toBe('javascript')
  expect(detectLanguage('file.py')).toBe('python')
  expect(detectLanguage('file.md')).toBe('markdown')
  expect(detectLanguage('file.unknown')).toBe('text')
})

test('detectLanguage handles edge cases', () => {
  expect(detectLanguage('')).toBe('text')
  expect(detectLanguage('noextension')).toBe('text')
  expect(detectLanguage('.hidden')).toBe('text')
})

test('isTextFile identifies text files', () => {
  expect(isTextFile('src/index.ts')).toBe(true)
  expect(isTextFile('README.md')).toBe(true)
  expect(isTextFile('.env')).toBe(true)
  expect(isTextFile('image.png')).toBe(false)
  expect(isTextFile('binary.exe')).toBe(false)
})

test('isImageFile identifies image files', () => {
  expect(isImageFile('screenshot.png')).toBe(true)
  expect(isImageFile('photo.jpg')).toBe(true)
  expect(isImageFile('diagram.webp')).toBe(true)
  expect(isImageFile('document.txt')).toBe(false)
})
