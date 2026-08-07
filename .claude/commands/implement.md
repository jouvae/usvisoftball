---
description: >
  Phase 2 — Implementation. Per-scenario TDD loop using subagents: tester
  writes tests → implementer makes them pass → tester verifies. If type
  conflicts arise, escalates to architect subagent. Independent scenarios
  run in parallel, dependent scenarios run sequentially. Ends at Checkpoint 4.
---

# Implement Command

You are running **Phase 2 (Implementation)** of the feature development flow.

## Inputs

- Feature name: `$1`
- Optional flags:
  - `--group <letter>`: implement only scenarios in this group
  - `--scenario <id>`: implement only this single scenario
  - `--plan <path>`: drive from a phased master plan (e.g. `docs/features/identity/refactor/refactor-plan.md`) instead of `scenario-NNN/` dirs — see the implement skill's Plan-driven Mode
  - `--application-running`: frontend/backend already running locally

## Procedure

### Step 1 — Load the implement skill

Read `.claude/skills/implement/SKILL.md` and follow its process.

### Step 2 — Determine mode and load the plan

Follow the implement skill's mode detection and plan loading.

### Step 3 — Run the TDD loop per scenario

For each scenario / plan work item (in dependency order):
1. Invoke **tester** subagent — writes/refines tests (a security regression test when it closes an audit finding)
2. If type/proto/`.zed` schema missing → ESCALATE to **architect** subagent, then resume
3. Invoke **implementer** subagent — makes tests pass
4. Invoke **tester** subagent — verifies tests pass
5. If it closes a Critical/High audit finding → run the **security-review gate** (reviewer subagent / `/security-review`)
6. Max 3 TDD iterations per scenario

In `--plan` mode, also: honor the plan's phase order and `Depends on` lines;
surface non-code / `[live]` items (secret rotation, secrets manager, Redis HA) as
a human checklist and STOP if a phase depends on one; treat `configs/spicedb/main.zed`
as authoritative and surface (don't resolve) the domain-object conflicts in the
plan's §4.C.

### Step 3.5 — Capture lessons (learning loop)

Capture is cheapest at the failure moment, not from memory later. Whenever a
scenario needed >1 TDD iteration, an architect escalation, or a security-review
gate flagged something, record a one-line observation `(error_type, agent,
root_cause, scenario/finding_id)` to a running `## Lessons (pending)` list in your
report. These feed `/improve`. Do NOT promote rules here — `/implement` captures;
`/improve` classifies and promotes.

### Step 4 — Report

```
## Implementation Complete: {feature-name}

### Scenarios: {done}/{total}

### Files Modified
Backend: {count}
Frontend: {count}

### Escalations
Architect escalations: {count}

### Lessons (pending — for /improve)
- {error_type} · {agent} · {root_cause} · {scenario/finding id}

### Next Steps
1. Code review
2. Run `/improve {feature-name}` to classify the pending lessons and promote rules (gated)
3. Deploy to staging
```

## Constraints

- Tests ONLY make gRPC calls — never test internal methods
- Tester and implementer NEVER create types or edit `.zed` schema — escalate to architect
- Independent scenarios run in parallel, dependent scenarios sequentially
- Every security fix carries a regression test; Critical/High fixes pass the security-review gate before counting as done

$ARGUMENTS
