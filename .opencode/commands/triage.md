---
description: ECA — classify a feature into a risk tier (T1/T2/T3) and emit its activation manifest. Runs automatically at the start of /empathize and re-runs whenever scope materially changes; also invokable manually. Never silently downgrades a tier.
---

# Triage Command

Classify the feature and emit the **activation manifest** that gates which ECA
machinery runs downstream. This is the mixture-of-experts router.

## Inputs

- Feature: `$1` (a `{group}/{feature}` slug, or a description to slug)
- Re-runs when scope materially changes — it is idempotent and recomputes from
  current `overview.md` scope.

## Procedure

### Step 1 — Load skills

Read `.opencode/skills/tier-classification/SKILL.md` and
`.opencode/skills/artifact-structure/SKILL.md`.

### Step 2 — Ensure the feature directory exists

If `docs/features/{group}/{feature}/` is missing, create it by copying every file
from `docs/features/_template/` and filling `{feature-name}`/`{group}`. (Usually
`/empathize` has already done this.)

### Step 3 — Run auto-escalation triggers FIRST

Inspect the described/affected surface. If it touches auth/identity, SpiceDB `.zed`,
money/finance/Stripe, PII columns, a published gateway route, or an irreversible data
migration → set the tier **floor** per the skill and record which triggers fired.

### Step 4 — Judge the two axes

Reversibility × stakes → tier. The axes can only **raise** the floor from Step 3,
never lower it.

### Step 5 — Write the manifest

Write the manifest block into `overview.md` §"Tier & activation manifest" and set
the active tier + default-all checkpoints in `status.md`. List exactly which
subagents/checks/artifacts this tier activates. Append a one-line entry to
`changelog.md`.

### Step 6 — De-escalation guard

If a human asks to lower an auto-escalated tier, require a written rationale and log
it to `lessons.md` (category `process-change`). Otherwise never downgrade.

## Checkpoint

**post-triage** (default on): present the tier + manifest and wait for confirmation.
If the checkpoint is unselected in `status.md`, proceed automatically.

## Report

```
## Triage: {group}/{feature}

- Tier: {T1 Patrol | T2 Sortie | T3 Campaign}
- Reversibility: {…}   Stakes: {…}
- Auto-escalation fired: {…}
- Activates: {subagents/checks}
- Required artifacts: {…}

Next: /empathize {feature}  (or resume the phase status.md indicates)
```

## Constraints

- Never silently downgrade a tier; de-escalation needs a logged rationale.
- Do not do research, design, or code here — triage only classifies and manifests.
- Re-run safely: recompute from current scope; overwrite the manifest in place.
