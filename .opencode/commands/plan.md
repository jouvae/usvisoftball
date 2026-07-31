---
description: Phase 1 — Planning. Creates all code artifacts needed to implement BDD scenarios: test shells, types, proto definitions, and migrations. Delegates type creation to architect and test writing to tester. Quality gate: all artifacts compile and tests fail with expected "not implemented" sentinel.
---

# Plan Command

You are running **Phase 1 (Planning)** of the feature development flow.

## Inputs

- Feature name: `$1`
- Optional flags: `--graph` or `--files` for persistence mode
- If `$2` is `update` → run update mode

## Required existing files

- `docs/features/{feature}/spike.md` or BDD scenarios

## Procedure

### Step 1 — Load the plan skill

Read `.opencode/skills/plan/SKILL.md` and follow its process.

### Step 2 — Determine persistence mode

Auto-detect: if `docs/features/{feature}/scenarios/` exists → files mode, else → graph mode.

### Step 3 — Run the planning process per the skill

1. Read scenarios
2. Delegate type creation to **architect** subagent
3. Delegate test writing to **tester** subagent
4. Validate compilation
5. Update task references
6. Present results

### Step 4 — Report

```
## Plan Complete: {feature-name}

### Validation
- Proto compile: PASS
- Go build: PASS
- Tests compile: PASS
- Tests fail correctly: PASS

### Next Steps
1. Run /qa {feature-name}
2. After QA PASS, run /implement {feature-name}
```

## Constraints

- Do NOT create types, protos, or migrations directly — delegate to architect
- Do NOT write test files directly — delegate to tester
- Validate compilation before reporting success
