---
name: changelog
description: Generate a structured changelog from commit history
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Bash(git log *) Bash(git show *) Bash(git diff *)
---

# Generate Changelog

Create a structured changelog from commit history since the last release tag.

## Steps

1. Find the latest tag: `git describe --tags --abbrev=0`
2. Get commits since that tag: `git log <tag>..HEAD --oneline`
3. For each commit, understand the actual code changes (not just the commit message)
4. Group commits into sections:
   - `## Features` — new user-facing functionality
   - `## Bugfixes` — bug fixes
   - `## Improvements` — performance, refactors with user impact
   - `## Documentation` — docs changes
   - `## Breaking Changes` — API changes requiring user action

## Rules

- Only include user-facing changes (skip internal-only commits)
- Start each bullet with a capital letter
- Describe WHAT changed for the user, not HOW the code changed
- Avoid raw commit prefixes like `fix:` or `feat:` unless part of natural language
- Keep concise — users skim changelogs
- No empty sections
- If no notable entries in a section, omit the entire section

## Output Format

```markdown
# Changelog

## Features
- <feature description>

## Bugfixes
- <fix description>

## Improvements
- <improvement description>
```

## Save To

Save the generated changelog to `CHANGELOG.md` (append to existing) or print to stdout if the file doesn't exist yet.

## Language

If user.profile `outputPreferences.language` is `zh`, generate in Chinese.
Otherwise, generate in English.
