---
description: Phase 1.75 — Fix Plan Issues. Reads the latest plan-review, classifies issues into categories, and dispatches each to the correct subagent in dependency order. Validates compilation after each architect pass. Idempotent.
---

# Fix Command

You are running **Phase 1.75 (Fix Plan Issues)** of the feature development flow.

## Inputs

- Feature name: `$1` (kebab-case)
- Optional fix message: `$2`

## Procedure

### Step 1 — Load the fix skill

Read `.opencode/skills/fix/SKILL.md` and follow its process.

### Step 2 — Validate arguments and find the latest review

```bash
FEATURE="$1"
test -d "docs/features/$FEATURE" || ERROR
LATEST_REVIEW=$(ls -1 "docs/features/$FEATURE/plan-review-*.md" 2>/dev/null | sort -r | head -1)
test -n "$LATEST_REVIEW" || ERROR
```

### Step 3 — Read and parse the plan-review

Build a structured issue list with id, description, location, fix_description, category, status.

### Step 4 — Execute fixes by category in dependency order

1. **contracts** (proto + migration + typescript + go_structs) → architect subagent
2. **test fixes** → go-tester / nextjs-tester
3. **implementation fixes** → go-implementer / nextjs-implementer
4. **convention fixes** → direct Edit

### Step 5 — Final validation

```bash
make build 2>&1
```

### Step 6 — Update the plan-review file

Append a `## Fix Summary` section.

### Step 7 — Report

```
## Fix Complete: {feature-name}
**Issues addressed**: {M} of {N}
**Build**: PASS
```

## Constraints

- ARCHITECT OWNS CONTRACTS — Never edit proto/migration/TS types directly.
- CORRECT DEPENDENCY ORDER — Contracts → Tests → Implementation → Convention.
- IDEMPOTENT — Check prior fix summaries before fixing.
