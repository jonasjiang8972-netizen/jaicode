---
name: issues
description: Search GitHub for existing issues matching a query
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Bash(gh *)
---

# Find GitHub Issues

Search through existing issues using the GitHub CLI to find issues matching the query.

## Steps

1. Run `gh issue list --search "$ARGUMENTS"` to find matching issues
2. For each match, show:
   - Issue number and title
   - Brief explanation of why it matches
   - Direct link to the issue
3. Also search closed issues if no open matches found
4. Consider: similar titles, same error messages, related functionality

## Output Format

For each matching issue:

```
#<number> [<state>] <title>
  <explanation of match>
  URL: https://github.com/<owner>/<repo>/issues/<number>
```

If no matches found, say so and suggest the user create a new issue.

## Arguments

The user provides a search query as arguments. Pass it directly to `gh issue list --search`.
