---
description: Phase 2 of the BDD feature flow. Produce compilable scaffolding — types, interfaces, function signatures, and tests with embedded scenario blocks — all unimplemented.
---

# /scaffold

You are running **Phase 2** of the BDD feature development flow.

## Inputs

- Feature name: `$1`
- Required existing files:
  - `docs/features/{feature}/scenarios.md`

## Goal

Produce:
1. `docs/features/{feature}/plan.md` — scope contract
2. Test files for every scenario with embedded scenario blocks
3. Type/interface/signature scaffolding
4. `docs/features/{feature}/status.yaml`

## Procedure

### Step 1 — Read all skills

- `.opencode/skills/scenarios/SKILL.md`
- `.opencode/skills/scope-discipline/SKILL.md`
- `.opencode/skills/status/SKILL.md`

### Step 2 — Read scenarios.md

Parse the Gherkin scenarios.

### Step 3 — Plan the scope

Write `docs/features/{feature}/plan.md`.

### Step 4 — Dispatch to stack-specific scaffolding agents

Group scenarios by stack and dispatch in parallel:
- `go` scenarios → architect in `go-scaffold` mode
- `web` scenarios → architect in `web-scaffold` mode
- `e2e` scenarios → architect in `e2e-scaffold` mode

### Step 5 — Verify scaffolding

1. Run `bash .claude/scripts/scenario-lint.sh {feature}`. Must exit 0.
2. Build for each affected stack. Must compile.
3. Every test must fail with the "not implemented" sentinel.

### Step 6 — Generate status.yaml

### Step 7 — Report

## Constraints

- Implementation function bodies are stubs only.
- Do not edit `scenarios.md`.
- Use architect agent for stack work.
