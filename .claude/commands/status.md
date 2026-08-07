---
description: Read-only status check for a feature. Regenerates status.yaml, lints scenario blocks, runs scope check, prints a summary. Safe to run any time.
---

# /status

Read-only check for the current state of a feature. No code is written. Renders two
layers: the **ECA board** (`status.md` — human/ECA lifecycle) and the **machine
test-state** (`status.yaml` — auto-generated).

## Procedure

1. Verify `docs/features/{group}/{feature}/` exists.
2. **ECA board (read-only):** read `status.md` and render the active tier, the
   activation manifest (from `overview.md`), the per-scenario lifecycle board
   (`draft → prototyped → tests-backfilled → dcon-passed → red-team-passed →
   shipped`), the selected checkpoints, and any open backward loops. This is the
   re-entrancy snapshot — what a re-run of any ECA command would resume from.
3. **Machine test-state:** run `bash .claude/scripts/scenario-status.sh {feature}`
   to regenerate `status.yaml`.
4. Run `bash .claude/scripts/scenario-lint.sh {feature}` and capture violations.
5. If `plan.md` exists, run `bash .claude/scripts/scope-check.sh {feature}`.
6. Print a summary: ECA phase + tier, scenario lifecycle counts, test-state counts,
   active checkpoints, and any violations.

## Constraints

- Read-only on the ECA board — never hand-edit `status.md` here (the phase commands
  own it). The only file this command writes is `status.yaml` (via the script).
- Do not run tests.
- Do not invoke implementer or scaffolding agents.

$ARGUMENTS
