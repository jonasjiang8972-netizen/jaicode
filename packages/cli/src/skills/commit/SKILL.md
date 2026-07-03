---
name: commit
description: Git commit with semantic prefix and bilingual message
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Bash(git *)
---

# Commit and push changes

Analyze the current git diff and stage, commit, and push changes.

## Steps

1. Run `git status`, `git diff`, and `git log --oneline -5` to understand the current state
2. Determine which files to stage based on the changes
3. Generate a commit message following this format:
   - Prefix: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`, `build:`, `revert:`
   - For files in `packages/web/` or `docs/` directories, use `docs:` prefix
   - Subject line in imperative mood, concise (under 72 chars)
   - Include WHY the change was made from an end-user perspective, not WHAT was changed
   - Avoid generic messages like "improved agent experience" — be specific about user-facing changes
4. If the user's language preference is Chinese (check user.profile), write the commit message in Chinese
5. Stage the files, commit, and push
6. If there are merge conflicts, DO NOT FIX THEM — notify the user and stop

## Commit message format

```
<prefix>: <imperative description>

- <bullet point explaining user benefit 1>
- <bullet point explaining user benefit 2>
```

## Language selection

If user.profile `outputPreferences.language` is `zh`, write commit message in Chinese.
Otherwise, write in English.
