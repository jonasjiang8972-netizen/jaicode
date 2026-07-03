---
name: learn
description: Extract non-obvious learnings from the session into the project config
version: 1.0.0
author: jaicode
type: command
disable-model-invocation: true
allowed-tools: Read Edit Glob Grep
---

# Extract Learnings to Project Config

Analyze the current session and extract non-obvious learnings to add to `.jaicode/project.yaml` and update AGENTS.md files if appropriate.

## What counts as a learning (non-obvious discoveries only)

- Hidden relationships between files or modules
- Execution paths that differ from how code appears
- Non-obvious configuration, env vars, or flags
- Debugging breakthroughs when error messages were misleading
- API/tool quirks and workarounds
- Build/test commands not in README
- Architectural decisions and constraints
- Files that must change together

## What NOT to include

- Obvious facts from documentation
- Standard language/framework behavior
- Things already in an AGENTS.md
- Verbose explanations
- Session-specific details

## Steps

1. Review session for discoveries, errors that took multiple attempts, unexpected connections
2. Determine scope — what directory does each learning apply to?
3. Read existing AGENTS.md and `.jaicode/project.yaml` at relevant levels
4. Determine the target file:
   - Project-wide learnings → update root `.jaicode/project.yaml` `agentInstructions`
   - Package/module-specific → create/update `packages/<name>/AGENTS.md`
   - Feature-specific → create/update `src/<feature>/AGENTS.md`
5. Keep entries to 1-3 lines per insight
6. After updating, summarize which files were created/updated and how many learnings per file
