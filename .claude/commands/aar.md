---
description: ECA After-Action Review — capture tier-tagged lessons. Runs AUTOMATICALLY at every phase boundary, at kill/pivot points, and on errors mid-session — not only when a human remembers. Layered onto the existing /improve learning loop: it captures the ECA-specific lesson (tier tag, phase, kill/pivot, mid-session error) and hands the durable promotion/prune work to /improve. Also invokable manually.
---

# AAR Command

Capture what just happened as a structured, tier-tagged lesson so a future session
does not repeat it. AAR is the **capture + pre-flight** half of the learning loop;
the durable corpus, gated rule promotion, and pruning stay in `/improve` and
`.claude/rules/LEARNING-LOOP.md`. **Do not fork a second learning system** — AAR
feeds the existing one.

## When it runs (automatic, not opt-in)

The ECA phase commands invoke `/aar {feature}` automatically:

- **At every phase boundary** — end of `/empathize`, `/conceptualize`, `/actualize`.
- **At kill/pivot points** — problem invalidated, prototype flopped (celebrated
  outcomes — capture *why*).
- **On errors mid-session** — when the agent hits an error and resolves it, write the
  error + resolution as a lesson *immediately*, before moving on. This is the whole
  point: the recurring failure of repeating last session's mistakes ends here.

Also invokable manually: `/aar {feature}`.

## Procedure

### Step 1 — Load the aar skill

Read `.claude/skills/aar/SKILL.md` (lesson record schema + tier tagging).

### Step 2 — Write the lesson

Append a tier-tagged lesson row to `docs/features/{group}/{feature}/lessons.md` and a
durable record to the **Supabase `lessons` table** (the never-deleted audit trail) via the
`3d-artifacts` skill — `domain`, `tags`, `tier`, `phase`, `ladder_stage='observation'`, and an
explicit `created_at`. Tag every lesson with the **active tier** (from
`status.md`) so the system can answer the calibration question: does under-tiering
recur? Tag the **trigger** (phase-boundary | kill | pivot | mid-session-error).

### Step 3 — De-escalation rationales

If this feature de-escalated a tier, ensure the rationale is recorded here (category
`process-change`) per the tier-classification guardrail.

### Step 4 — Hand off to /improve (gated promotion + prune)

For promotion to rules, recurrence counting, and consolidation, run `/improve
{feature}` (or `/improve --consolidate` every ~5 features). AAR captures; `/improve`
generalizes, applies (gated), verifies, and prunes. Recurring under-tiering patterns
surfaced here become proposed **new auto-escalation triggers** in the next
`--consolidate` pass.

## Pre-flight (the other half — automatic at /empathize)

`/empathize` loads relevant prior lessons by domain/problem similarity *before* new
work. AAR is the capture side of that same loop; the preload side lives in
`/empathize` step 3 and `LEARNING-LOOP.md`.

## Report

```
## AAR: {group}/{feature}   (tier: {T1|T2|T3}, trigger: {phase|kill|pivot|error})

- Lesson captured: {id} — {one line}
- Tier-tagged: {T1|T2|T3}
- Durable record: Supabase lessons row {id}
- Promotion: deferred to /improve  (run /improve {feature} to generalize)
```

## Constraints

- Never delete a lessons file — lessons are the audit trail (`LEARNING-LOOP.md`
  invariant #2). AAR only appends.
- Capture on errors immediately — do not batch to end-of-session.
- Tag every lesson with its tier — the calibration metric depends on it.
- Do not promote rules here — that is `/improve`'s gated job.

$ARGUMENTS
