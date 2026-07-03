---
name: code-review
description: Review code changes for bugs, security, style, and best practices
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git log *) Bash(git status *)
---

# Code Review

Review the current code changes (git diff against the base branch or HEAD) for:

## Review Checklist

1. **Bugs & Logic Errors**
   - Null/undefined access without guards
   - Off-by-one errors
   - Race conditions
   - Missing error handling
   - Incorrect type usage

2. **Security**
   - Hardcoded secrets or credentials
   - SQL/command injection vectors
   - Missing input validation
   - Insecure defaults
   - Path traversal risks

3. **Code Quality**
   - Functions too long (>50 lines)
   - Deep nesting (>4 levels)
   - Duplicated code
   - Dead code
   - Missing or misleading comments

4. **Style & Conventions**
   - Inconsistent naming (check project conventions)
   - Fileorganization doesn't match project patterns
   - Missing tests for new functionality
   - API changes without documentation updates

5. **Performance**
   - N+1 queries
   - Unnecessary re-renders (if frontend)
   - Missing memoization
   - Memory leaks (event listeners, timers)

## Output Format

For each issue found, output:

```
[<severity>] <file>:<line> - <issue description>
  Suggestion: <how to fix>
```

Severity levels: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`

## Language

If user.profile `outputPreferences.language` is `zh`, output review in Chinese.
Otherwise, output in English.
