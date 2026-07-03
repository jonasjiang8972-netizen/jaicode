---
name: translate
description: Translate English documentation and UI copy to other languages
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Read Edit Grep Glob Bash(git diff *)
---

# Translation

Run git diff and translate changed English documentation and UI copy files to other configured languages.

## Steps

1. Run `git diff` to find changed files
2. Filter to documentation and UI files: .md, .mdx, .json (locale files), .txt
3. Skip files that are already non-English (check against locale directories)
4. For each changed English file, translate to all configured target languages
5. Preserve meaning, intent, tone, and formatting (including Markdown/MDX structure)
6. Preserve exactly (do NOT translate):
   - Technical terms and product/company names
   - API names, identifiers, code, commands/flags
   - File paths, URLs, versions
   - Error messages, config keys/values
   - Anything inside inline code or code blocks
   - Terms in the project glossary (if exists)

## Target Languages

Read from user.profile `targetLanguages` or default to: zh (Simplified Chinese)

Place translations in appropriate directories:
- `translations/` or `locales/` directory structure
- Next to the original file with language suffix (e.g., `README.zh.md`)

## Language-specific Rules

- Follow locale guidance from project glossary if available
- Use formal/technical tone for documentation
- Use conversational tone for UI copy
- Maintain consistent terminology across all translations
