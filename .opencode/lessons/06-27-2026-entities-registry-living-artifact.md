---
id: L-eca-entities-registry-01
date: 2026-06-27
feature: inspirations/refactor
tier: T3
trigger: human-direction
category: process-change
status: active
---

## Context
`docs/entities.md` is the canonical, versioned (v3.2, changelog'd) registry of every
platform entity definition (mental model, core entities, SpiceDB schema). It was not
referenced by any ECA phase command, so empathize/conceptualize/actualize work could
drift from — or silently contradict — the platform's source-of-truth definitions.

## What happened
Human direction: the entity registry must be a **first-class input and output of every
ECA phase** — consult it during research/discovery so work is grounded in the *current*
definitions (and a "new" idea isn't already defined under another name), and **update it**
as discoveries land (new entity, rename, changed relationship/lifecycle), with a dated
changelog entry. Definitions are expected to evolve across phases.

Wired this into the commands: `empathize` (Step 3.5 + constraint), `conceptualize`
(preflight) and `actualize` (ratify-the-registry in the promotion gate). The ratification
ladder: empathize/conceptualize write **proposed** definitions (marked *proposed —
{feature} {phase}; ratify in /plan*) without touching the version line; `/plan` ratifies
with schemas/SpiceDB/§7; `/actualize` finalizes the version bump before merge.

Reconciling for inspirations/refactor also validated the "verify decisions are addressed"
habit: it surfaced that `Rule` (§2.8) **already** carried the six types + immutable HMAC
snapshots our design assumed — so that decision needed no change, only confirmation.

## What to do differently
- Every phase: read the relevant `docs/entities.md` sections first; record which entities
  the feature touches in `overview.md` §Research. When a definition changes, update the
  registry inline + append an `Appendix A. Changelog` entry; mark unratified changes
  *proposed* and **do not bump the canonical version** until `/actualize`.
- A shipped contract (proto/migration/struct) that disagrees with `docs/entities.md` is
  promotion debt — resolve at `/actualize`, don't scan around it.
- Rule candidate for **architect / reviewer / research-synthesizer**: *cross-check work
  against `docs/entities.md` and keep it in sync; never introduce or rename an entity in
  code without a corresponding registry update.* `/improve` to promote.
