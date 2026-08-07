---
name: qa
description: Review a BDD implementation plan produced by the plan skill before /implement runs. Invokes nextjs-qa-reviewer for the frontend plan and go-qa-reviewer for backend code, then merges their reports.
metadata:
  audience: developers
  workflow: bdd
---

> **⚠️ Reviewer remits diverged (2026-08-01).** `go-qa-reviewer` is no longer a *plan* reviewer — it
> reviews **written Go code** for correctness and standards conformance and returns a fix order for
> `go-implementer` (see `.claude/agents/go-qa-reviewer.md`). In this legacy BDD flow that means it is
> useful **after** the backend scaffolding/implementation exists, not against an empty plan; invoke it
> with `PHASE=deliver` and the changed files. `nextjs-qa-reviewer` still reviews the frontend plan.
> In the 3D flow, `go-qa-reviewer` runs inside Design Node 2 and Deliver Node 1 — not here.

## What I Do

Review a BDD implementation plan produced by the `plan` skill before `/implement` runs. Invokes both QA reviewers in parallel and merges their reports.

## Two Modes

### Files Mode (default)
- Reads scenarios from `docs/features/{feature}/scenarios/`
- Checks plan.md, spike.md exist
- Verifies all referenced artifact files exist on disk

### Graph Mode (--graph)
- Queries Neo4j for spike and scenario context
- Checks graph connectivity

## Process

1. Preflight checks (verify feature exists, detect mode)
2. Verify feature directory and required files exist
3. Extract scenario context from files or graph
4. Verify all referenced artifacts exist on disk
5. Detect redundant type creation
6. Read spike document for feature context
7. Compute review version (auto-incrementing)
8. Read previous plan-review for prior fix context
9. Invoke both reviewers in parallel:
   - `nextjs-qa-reviewer` — frontend slice
   - `go-qa-reviewer` — backend slice
10. Merge reports into single `plan-review-{N}.md`

## Verdict Merging

| go-qa | nextjs-qa | Merged |
|-------|-----------|--------|
| PASS | PASS | PASS |
| PASS | NEEDS_REVISION | NEEDS_REVISION |
| PASS | FAIL | FAIL |
| NEEDS_REVISION | PASS | NEEDS_REVISION |
| FAIL | any | FAIL |

## Review File Format

```
# Plan Review: {feature}

**Merged verdict**: PASS | NEEDS_REVISION | FAIL

## Summary
- Scenarios reviewed: {N}
- Frontend: {M} Critical, {K} Warnings
- Backend: {P} Critical, {Q} Warnings

## Critical Issues (merge of both reports)

## Warnings (merge of both reports)

## Cross-Domain Synthesis

## Raw Reports
### nextjs-qa-reviewer Report
{verbatim copy}

### go-qa-reviewer Report
{verbatim copy}
```

## Critical Rules

1. READ-ONLY — Never modify the plan, graph, or any artifact.
2. TWO REVIEWERS, IN PARALLEL — Always both in the same message.
3. VERBATIM MERGE — Preserve both subagent reports verbatim.
4. Never recommend implementation on FAIL/NEEDS_REVISION.
5. Run preflight before anything else.
6. Check prior reviews to avoid re-reporting fixed issues.
7. Extract graph mode context using grapher skill scripts.
8. Final response under 1000 tokens — detail goes in review file.
9. Pre-compute missing artifacts list before invoking reviewers.
10. Include pre-computed missing artifacts in reviewer prompts.
11. Detect redundant type creation (references pointing to nonexistent files).
12. Merge only after both reviewers complete successfully.
