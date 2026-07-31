---
description: Phase 1.5 — Plan QA Review. Validates a BDD plan before implementation by orchestrating nextjs-qa-reviewer and go-qa-reviewer subagents in parallel. Reads scenarios and artifact references, checks all referenced files exist, then delegates cross-domain validation to reviewers. Merges their reports into a single plan-review verdict.
---

# QA Command

You are running **Phase 1.5 (Plan QA Review)** of the feature development flow.

## Inputs

- Feature name: `$1`

## Procedure

### Step 1 — Load the qa skill

Read `.opencode/skills/qa/SKILL.md` and follow its process.

### Step 2 — Run preflight checks

Detect mode (files-mode or graph-mode).

#### Files-mode

```bash
FEATURE="$1"
test -d "docs/features/$FEATURE/scenarios" || echo "MISSING: scenarios"
test -f "docs/features/$FEATURE/spike.md" || echo "MISSING: spike.md"
```

### Step 3 — Extract context and check artifacts

Read spike document and run `test -e` on every reference path.

### Step 4 — Invoke both reviewers in parallel

Use two Task tool calls:
- `go-qa-reviewer` — backend slice
- `nextjs-qa-reviewer` — frontend slice

### Step 5 — Merge reports and write review

Combine both reports into a single `plan-review-{N}.md`. Compute merged verdict.

### Step 6 — Report

```
## Plan Review Complete: {feature-name}

**Merged verdict**: {PASS | NEEDS_REVISION | FAIL}

### Findings
| Slice | Critical | Warnings |
|---|---|---|
| Frontend | {count} | {count} |
| Backend | {count} | {count} |

### Next step
- PASS → Run /implement
- NEEDS_REVISION or FAIL → Run /fix
```

## Constraints

- READ-ONLY — Never modify the plan or any artifact.
- TWO REVIEWERS, IN PARALLEL.
- VERBATIM MERGE — Preserve both reports verbatim.
