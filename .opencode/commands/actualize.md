---
description: ECA Phase 3 (Actualize) — turn workable into shippable. The promotion gate plus build hardening: audit and resolve prototype debt, backfill tests from the BDD scenarios, then run the blocking gates (dcon + both red-team levels) and CI. Re-entrant — on any gate failure it loops backward to the right phase and re-runs on fix. Orchestrates the existing /plan, /qa, /fix, /implement machinery.
---

# Actualize Command

Turn the workable prototype into a shippable feature. **Make it shippable**, where
Conceptualize made it workable. Re-entrant: read `status.md` first and resume.

## Inputs

- Feature: `$1` (`{group}/{feature}` slug)
- Reads the activation manifest in `overview.md` — **activate only what it names**.
  A T1 does not run interactive red-team unless a trigger fired; dcon runs only if
  there are data-writing scenarios.

## Procedure

### Step 0 — Resume

Read `status.md` (board + tier + manifest + checkpoints). Determine which scenarios
are `prototyped` and what gate work remains. Do only that.

### Step 1 — Promotion gate (debt audit) — load the `promotion-gate` skill

Before anything else, audit prototype-quality debt across the prototyped surface —
TODOs, hardcoded secrets/values, missing error paths, throwaway data shapes, absent
tests — and **resolve** it. Do not scan around it. Follow the `promotion-gate` skill
checklist; dispatch fixes to **architect** (contracts) / **go-implementer** /
**nextjs-implementer** as appropriate.

**Ratify the entity registry.** `docs/entities.md` is the canonical platform entity
registry and a living input/output of every phase. Before merge, reconcile it with the
shipped contracts: every new/changed entity, relationship, lifecycle, or rename this
feature introduced must be reflected as a **ratified** definition (drop any *proposed —
… ratify in /plan* qualifiers that empathize/conceptualize left), with a dated
`Appendix A. Changelog` entry and the §7 Entity Relationship Summary + §6 SpiceDB
schema updated to match. A shipped contract that disagrees with `docs/entities.md` is
promotion debt — resolve it here, do not scan around it.

### Step 2 — Make scenarios implementable

If contracts are still prototype-grade, run `/plan {feature}` (architect creates
real protos/migrations/types/route stubs + failing test stubs), then `/qa {feature}`
and `/fix {feature}` to close plan-review issues. Skip what already exists — idempotent.

### Step 3 — Backfill tests from the BDD scenarios

TDD was skipped during prototyping **by design** — tests are written here. Drive
`/implement {feature}` so the testers (`go-tester` / `nextjs-tester`) write tests
covering every scenario in `scenarios.md` against the now-real behavior, and the
implementers make them pass. Mark each scenario `tests-backfilled` on the board.

### Step 4 — Blocking gates (per manifest)

Run the gates the manifest activates. **Both dcon and red-team block merge.** Run
independent gates in parallel; each is blocking, not advisory (advisory only where a
T1 manifest explicitly downgrades interactive red-team to "trigger-only").

- **dcon** (data-writing scenarios only) — dispatch the `dcon` subagent. It reads
  actual DB state and validates it against the `Then` clauses in `scenarios.md`. Pass
  → mark scenarios `dcon-passed`.
- **red-team-code** — dispatch the `red-team-code` subagent (static security).
- **red-team-interactive** — dispatch the `red-team-interactive` subagent against the
  running app (if the manifest activates it). Pass both → mark `red-team-passed`.

Auth/money/PII findings always block regardless of tier.

### Step 5 — Failure path (re-entrant, bounded)

On any gate failure: update `status.md` (record the open loop), append the result to
`changelog.md`, and loop backward to the right phase — build (`/fix` / `/implement`),
`/conceptualize`, or `/empathize` — then **re-run the failed gate on fix**. Do not
force forward, never silently pass. **Auto-fix-and-retry is capped (max 2 retries per
gate); after the cap, STOP and escalate to a human.** Never loop indefinitely.

### Step 6 — CI / automations

Run CI/CD and any automations. Note: repo CI (`/.github/workflows/ci.yml`) is
currently partial — the **gates are enforced locally here** (the approved model);
CI wiring is a follow-up. Heavier, org-wide red-team belongs in an isolated
environment / the pipeline, not this per-feature loop.

### Step 7 — Ship

When all activated gates pass and the pre-merge checkpoint clears, mark scenarios
`shipped`. Update `status.md`, `changelog.md` (gate results), and run `/aar`.

## Checkpoints

- **pre-merge** (default on): present gate results (dcon, both red-team levels) before
  merge to main.
- **pre-deploy** (default on): confirm before production rollout.

## On phase boundary / error

Run `/aar {feature}` automatically at completion, on any gate failure (capture the
finding so it isn't repeated), and when an error is hit and resolved mid-session.

## Always update status (automatic — never wait to be asked)

A task is not done until the feature docs reflect it. At every hand-off, gate result, ship,
and loop-back — and BEFORE you report back — update the feature docs yourself, without being
prompted:

1. **`status.md`** — set `**Updated:**` to today's absolute date and `**Phase:**` to the
   current phase; advance the scenario-board states (`tests-backfilled` / `dcon-passed` /
   `red-team-passed` / `shipped`) and record any open loop from a gate failure; and keep a
   current top-of-file **▶ SESSION HANDOFF (<date>)** block: the one-line state, what's DONE,
   the single exact NEXT step (next gate, loop-back phase, or ship), and branch +
   build/gate state — so a fresh session with no memory of this conversation can resume from
   it alone.
2. **`changelog.md`** — append a dated entry for gate results, debt resolved, ships, and
   loop-backs.

This is a standing requirement, not something the user should have to request. (A full
session-clear that also writes durable memory is still `/checkpoint`; these in-repo status
docs stay current every time regardless.)

## Report

```
## Actualize: {group}/{feature}   (tier: {T1|T2|T3})

- Promotion debt resolved: {N items}
- Tests backfilled: {N/N scenarios}
- dcon: {PASS N/N data-writing | n/a} 
- red-team-code: {0 blocking | BLOCKED: …}
- red-team-interactive: {0 blocking | n/a | BLOCKED: …}
- Verdict: {SHIPPABLE | BLOCKED → looped back to {phase}}
```

## Constraints

- Activate only what the manifest names — no more, no less.
- dcon + both red-team levels block merge; auth/money/PII always block.
- Retry cap then escalate — never loop indefinitely, never silently pass.
- Never mark a scenario `shipped` with an unresolved blocking finding.
- Keep `status.md` + `changelog.md` current at every hand-off automatically — never make the
  user ask for a status update.
