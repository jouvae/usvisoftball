---
description: Phase 1 of the BDD feature flow. Generate Gherkin scenarios for a feature from a spike document or feature description, written to `docs/features/{feature}/scenarios.md`. Quality gate: human approval before proceeding to `/plan`.
---

# Scenarios Command

You are running **Phase 1 (Scenarios)** of the feature development flow.

## Inputs

- Feature name: `$1`
- Optional feature description or path to notes: `$2`

## Procedure

### Step 1 — Load the scenarios skill

Read `.claude/skills/scenarios/SKILL.md`.

### Step 2 — Create the feature directory

```bash
mkdir -p docs/features/$1
```

### Step 3 — Read context

Read all of the following that exist:
1. `docs/features/$1/spike.md`
2. `docs/features/_template/scenarios.md`
3. `docs/sample-scenarios.md`

### Step 4 — Identify scenarios

Cover happy paths, sad paths, and edge cases. Use stack-specific ID format:
- Backend behaviors → `{feature}-go-NNN`
- Frontend behaviors → `{feature}-web-NNN`
- End-to-end user journeys → `{feature}-e2e-NNN`

### Step 5 — Write scenarios.md

Standard Gherkin (Given/When/Then) with YAML-like frontmatter per scenario.

### Step 6 — Report

```
## Scenarios Created: {feature}

### Coverage
| Stack | Count |
|-------|-------|
| go    | {n}   |
| web   | {n}   |
| e2e   | {n}   |
```

## Constraints

- Do not write any code.
- Do not create test files.
- Do not edit any file outside `docs/features/{feature}/`.

$ARGUMENTS
