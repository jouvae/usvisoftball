---
name: tier-classification
description: Classify an ECA feature into a risk tier (T1 Patrol / T2 Sortie / T3 Campaign) on two axes — reversibility and stakes — apply auto-escalation triggers, and emit the activation manifest. Used by /triage. Tiers gate which machinery runs downstream (mixture-of-experts).
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Classify a feature into a **risk tier** and emit its **activation manifest** — the
set of experts (subagents/checks/checkpoints/artifacts) the rest of the flow turns
on. Treat ECA like a mixture-of-experts model: the tier is the routing decision, and
downstream commands activate only the experts the manifest names. A reversible,
low-stakes copy change must not summon the interactive red-team.

Read me from `/triage`. Write the result into `overview.md` (manifest) and
`status.md` (active tier + checkpoints).

## The two axes

- **Reversibility** — if this is wrong, can we undo it cheaply? Flag-gated, rollback
  in one step, no contract/data-shape change → **reversible**. A schema/data
  migration, a published API contract, anything a user or partner builds on →
  **irreversible**.
- **Stakes** — blast radius × uncertainty. A small surface with high uncertainty is
  **high stakes**. Money, identity, data integrity → high stakes.

## Routing

| | Reversible | Irreversible |
|---|---|---|
| **High stakes** | **T2 — Sortie** (ship behind a flag; invest in rollback + monitoring) | **T3 — Campaign** (full apparatus) |
| **Low stakes** | **T1 — Patrol** (just ship and measure) | **T2 — Sortie** (one-way: design the data model / contract first) |

## Activation profiles (the MOE weights)

| | **T1 Patrol** | **T2 Sortie** (default) | **T3 Campaign** |
|---|---|---|---|
| Problem statement | one sentence | one paragraph | full framing |
| Design doc | none | one page, single review | full RFC, two review passes |
| Prototype | no | only if interaction is genuinely novel | high-fi, validated with users |
| BDD | only if user-facing (a scenario or two) | core flows | full traceability |
| dcon | only if it writes data | yes (data-writing scenarios) | yes |
| red-team-code | yes | yes | yes |
| red-team-interactive | only if a trigger fires | yes | yes |
| Reviewers / sign-off | single reviewer | one accountable approver | cross-functional + product-lead |
| Rollout | flag-gated; the bet is the experiment | flag-gated | staged / canary |

## Auto-escalation triggers

If **any** of these is touched, force **at least T2**; most force **T3** regardless
of the team's instinct. Record which fired in the manifest.

| Trigger | Floor |
|---|---|
| Authentication / authorization | T3 |
| Money / billing | T3 |
| PII / sensitive data handling | T3 |
| Public or partner-facing API contract | T2 (T3 if breaking) |
| Irreversible data migration | T3 |
| Security / compliance surface | T3 |

In this codebase that means: edits under the **identity** service, SpiceDB
`configs/spicedb/*.zed`, the **finance** service / Stripe, any `RelationName` /
authz relation, PII columns in `libs/go/postgres/migrations/`, or a published
Dorothy gateway route → auto-escalate and say so.

## Guardrails

- **Escalating is free** and needs no justification.
- **De-escalating requires a written rationale** logged to `lessons.md` (category
  `process-change`). `/triage` never silently downgrades.
- **Misclassification is a lesson.** When a shipped feature's tier proves wrong
  (an incident on a T1, a kill that a T3 over-engineered), capture it as a
  tier-tagged lesson. Recurring under-tiering patterns become **new auto-escalation
  triggers** — propose the addition during `/improve --consolidate`.

## Output — the activation manifest

Emit this block into `overview.md` §"Tier & activation manifest" and set the active
tier + default-all checkpoints in `status.md`:

```
Tier: {T1|T2|T3}
Reversibility: {reversible|irreversible}
Stakes: {low|high}
Auto-escalation triggers fired: {list|none}
Active subagents: {research-synthesizer?, dcon?, red-team-code, red-team-interactive?, chaos?}
Required artifacts: {design doc?, prototype?, BDD traceability level}
De-escalation rationale: {text|n/a}
```

## Critical rules

1. High uncertainty is high stakes even on a tiny surface — do not let a small diff
   talk you down.
2. Run the auto-escalation triggers **before** the reversibility/stakes judgment; a
   fired trigger sets the floor, the axes can only raise it.
3. Write the rationale for any de-escalation to `lessons.md`. No silent downgrades.
4. The manifest is a contract: downstream commands must activate exactly what it
   names — no more (wasteful), no less (unsafe).
