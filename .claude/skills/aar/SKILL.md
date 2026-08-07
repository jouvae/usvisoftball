---
name: aar
description: The After-Action Review lesson record schema and tier tagging. Defines how an ECA lesson is written (id, date, feature, tier, category, context, what happened, what to do differently, status), how it maps onto the existing /improve learning loop, and the automatic capture triggers. Used by /aar.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Define the **lesson record** AAR captures and how it threads into the existing
learning loop (`.claude/rules/LEARNING-LOOP.md`). AAR adds three things the base
loop lacked: **automatic capture** (phase boundaries / kills / mid-session errors),
a **tier tag** on every lesson, and a **per-feature view** (`lessons.md`). The
durable corpus, gated rule promotion, and pruning stay in `/improve`.

## Lesson record schema

Write a row to the Supabase `lessons` table (durable, never hard-deleted) via `3d-artifacts`
and mirror a row into `docs/features/{group}/{feature}/lessons.md`:

```markdown
---
id: L-{feature}-{NN}
date: YYYY-MM-DD
feature: {group}/{feature}
tier: T1 | T2 | T3            # the ACTIVE tier from status.md — enables calibration
trigger: phase-boundary | kill | pivot | mid-session-error
category: learning | training | process-change
status: active | archived
---

## Context
{what we were doing, which phase}

## What happened
{the error / kill reason / pivot — concrete}

## What to do differently
{the falsifiable change. If it implies a rule, state the trigger so /improve can
generalize it into an R-{agent}-{slug} record.}
```

## Category meanings

- **learning** — a fact about the domain/codebase we didn't know.
- **training** — an agent did the wrong thing; candidate for a per-agent rule.
- **process-change** — the flow itself needs to change (e.g. a de-escalation
  rationale, a missing checkpoint, a new auto-escalation trigger).

## The tier tag (why it matters)

Tagging every lesson with the active tier lets the system answer the **single most
important health question**: *is under-tiering recurring?* If lessons tagged `T1`
keep describing incidents that a `T2`/`T3` apparatus would have caught, that pattern
becomes a proposed **new auto-escalation trigger** during `/improve --consolidate`
(tier-classification skill). Calibration is the north-star signal.

## Automatic capture triggers

The ECA phase commands call `/aar` at:
- **phase-boundary** — end of empathize/conceptualize/actualize.
- **kill** — problem invalidated (empathize) — celebrated; capture *why*.
- **pivot** — prototype flopped (conceptualize) — celebrated; capture *why*.
- **mid-session-error** — an error hit and resolved *during* work; capture the error
  + resolution immediately, so the next session can't repeat it. This drives the
  repeat-error-rate metric toward zero — the proof the loop is real.

## Hand-off to /improve

AAR does **not** promote rules. After capture, `/improve {feature}` classifies the
signal, bumps recurrence counters, and promotes to `provisional`/`binding` **gated**;
`/improve --consolidate` verifies and prunes. Security rules and edits to shared agent
files are flagged for human/security-review ratification, never auto-applied.

## Critical rules

1. Never delete a lessons file (audit trail). AAR only appends.
2. Tag every lesson with the active tier — no exceptions; the calibration metric
   depends on it.
3. Capture mid-session errors immediately, not at end-of-session.
4. AAR captures; `/improve` promotes. Do not blur the two.
