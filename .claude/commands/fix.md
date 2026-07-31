---
description: >
  Phase 1.75 — Fix Plan Issues. Companion to /qa. Reads the latest
  plan-review-{N}.md, classifies issues into categories (proto, migration,
  typescript, go_structs, test, backend, frontend, convention), and dispatches
  each category to the correct subagent in dependency order: architect (contracts)
  → tester (tests) → implementer (implementation) → direct edit (convention).
  Validates compilation after each architect pass. Updates the plan-review file
  with a Fix Summary. Idempotent — skips previously fixed issues.
---

Read `.opencode/commands/fix.md` and follow its instructions.

$ARGUMENTS
