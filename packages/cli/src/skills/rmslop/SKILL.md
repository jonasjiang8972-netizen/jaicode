---
name: rmslop
description: Remove AI-generated code slop from the current diff
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Read Edit Bash(git diff *)
---

# Remove AI Code Slop

Check the diff against the base branch and remove all AI-generated slop introduced.

## What counts as slop

1. **Extra comments** that a human wouldn't add or that are inconsistent with the rest of the file
   - Redundant inline comments explaining obvious code
   - JSDoc/TSDoc for trivial functions
   - Comments that just restate what the code does

2. **Extra defensive checks** abnormal for that area of the codebase
   - try/catch blocks around trusted/validated code paths
   - Null checks where the type system already guarantees non-null
   - Redundant validation in internal functions

3. **Type system workarounds**
   - Casts to `any` to get around type issues
   - `// @ts-ignore` or `// @ts-expect-error` comments
   - Unnecessary type assertions

4. **Style inconsistencies**
   - Code that doesn't match the file's existing patterns
   - Unnecessary emoji in comments or strings
   - Inconsistent formatting compared to surrounding code
   - Import order changes that don't affect functionality

5. **Unnecessary refactors**
   - Renaming variables to worse names
   - Splitting functions that shouldn't be split
   - Adding abstraction layers that aren't needed

## Steps

1. Run `git diff main` (or against the base branch) to see all changes
2. Read the full context of each changed file (not just the diff)
3. Identify slop within the changes
4. Remove the slop while keeping the functional changes
5. Ensure the result matches the file's existing style

## Output

At the end, provide a concise 1-3 sentence summary of what was changed and why each removal qualifies as slop.
