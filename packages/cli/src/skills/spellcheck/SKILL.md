---
name: spellcheck
description: Check Markdown files for spelling and grammar errors
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Read Grep Glob
---

# Spellcheck Markdown Files

Look at all unstaged and staged changes to markdown (.md, .mdx, .mdoc) files and check for spelling and grammar errors.

## Steps

1. Find all changed markdown files: `git diff --name-only` + `git diff --cached --name-only`
2. Extract only the changed lines from each file
3. Check each changed line for:
   - Spelling errors (common typos, misspelled words)
   - Grammar errors (subject-verb agreement, tense consistency)
   - Punctuation issues
   - Inconsistent formatting
   - Broken links or references
4. Ignore:
   - Code blocks (content between ``` markers)
   - Inline code (content between backticks)
   - URLs
   - Proper nouns that are project-specific (check project glossary)
   - Technical terms and API names

## Output Format

For each issue:

```
<file>:<line> - <issue type>: <description>
  Current: "<text with error>"
  Suggestion: "<corrected text>"
```

Severity: `TYPO`, `GRAMMAR`, `STYLE`, `PUNCTUATION`

## Language Detection

Detect the primary language of each file and apply appropriate spelling rules:
- Files with Chinese content: check Chinese grammar and punctuation
- Files with English content: check English spelling and grammar
- Mixed content: check both according to the language of each paragraph
