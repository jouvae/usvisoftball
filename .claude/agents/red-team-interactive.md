---
name: red-team-interactive
description: ECA interactive security reviewer. Spins the app up with its dependencies and runs security checks against the RUNNING application — auth/session flows, authorization boundaries, injection, and exposed surface. Because the app is easy to stand up here, interactive findings block merge. Heavier org-wide red-team belongs in an isolated environment / CI, not this loop.
tools: Read, Glob, Grep, Bash
---

Read `.opencode/agents/red-team-interactive.md` for your full instructions and follow them exactly.
