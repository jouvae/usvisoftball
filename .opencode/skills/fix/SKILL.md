---
name: fix
description: Apply fixes to issues identified by the QA skill. Reads the latest plan-review, classifies issues, dispatches each to the appropriate subagent, validates compilation, and updates the review file.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Read the latest `plan-review-{NNN}.md`, classify issues into fix categories, dispatch each to the appropriate subagent (architect, go-tester, go-implementer, etc.), validate compilation, and update the plan-review file.

## Subagent Assignments by Category

| Category | Subagent | Responsibility |
|----------|----------|---------------|
| proto | architect | Edit proto files, run `make apis` |
| migration | architect | Edit migration types, ID prefixes |
| typescript | architect | Edit TS types |
| go_structs | architect | Edit Go domain types |
| test | go-tester / nextjs-tester | Fix test patterns |
| backend | go-implementer | Fix implementation code |
| frontend | nextjs-implementer | Fix frontend code |
| convention | direct Edit | Apply convention fixes directly |

## Process

1. Validate arguments and find the latest plan-review
2. Read and parse the plan-review into structured issues
3. Filter out issues already marked fixed in prior fix summaries
4. Execute fixes by category in dependency order:
   - Contracts (proto + migration + typescript + go_structs) → ONE architect call
   - Test fixes → go-tester and/or nextjs-tester
   - Implementation fixes → go-implementer and/or nextjs-implementer
   - Convention fixes → direct Edit tool
5. Final validation: `make build`
6. Update the plan-review file with `## Fix Summary` section
7. **Capture for the learning loop:** in the Fix Summary, list each fixed issue as
   `(error_type, source agent, root_cause)`. This is the raw signal `/improve`
   classifies — recording it here is what lets rules be promoted and verified.
   A Critical fixed here that maps to an existing rule means that rule is
   INEFFECTIVE — call it out so `/improve` bumps `recurrences_after`.
8. Report, and recommend running `/improve {feature}` to close the loop.

## Critical Rules

1. ARCHITECT OWNS CONTRACTS — Never edit proto files, migration types, Go structs, or TS types directly.
2. CORRECT DEPENDENCY ORDER — Contracts → Tests → Implementation → Convention.
3. IDEMPOTENT — Check prior fix summaries. Skip previously fixed issues.
4. PROVIDE FULL CONTEXT — Include issue ID, description, fix requirement, BDD scenario context.
5. Validate after every architect pass (`make apis && make build`).
6. Update the plan-review file, never delete or overwrite.
7. Max 2 iterations per pass.
8. Batch within categories, separate between categories.
9. If build fails, identify breakage category and dispatch corresponding subagent.
10. Record fixed issues as `(error_type, agent, root_cause)` in the Fix Summary so the learning loop (`/improve`) has signal to classify and verify against.
