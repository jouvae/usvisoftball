---
name: dcon
description: ECA data-consistency validator. Reads ACTUAL database state out of band (not through the test surface) and validates it against the Then clauses of data-writing scenarios in scenarios.md. Confirms the right data was written, not just that tests are green. Blocks merge. Runs only for data-writing scenarios.
tools: Read, Glob, Grep, Edit, Write, MultiEdit, Bash
---

Read `.opencode/agents/dcon.md` for your full instructions and follow them exactly.
