---
id: L-init-11
date: 2026-07-31
feature: softball/init
tier: T3
trigger: phase-boundary
category: process-change
status: active
---

## Context
Actualize (Phase 3), Step 4 blocking gates. dcon, red-team-code, and red-team-interactive were dispatched **in parallel** against the single shared Supabase dev DB (the same DB the whole suite uses, `workers:1`).

## What happened
dcon (which drives real writes as the seeded operators, then reads rows out of band to validate the `Then` clauses) observed a foreign `rt-*` marker row — created by the concurrently-running **red-team-interactive** gate — inside its read window. dcon correctly refused to delete a row it didn't own and flagged it. Harmless in the end (a `draft`, off the public feed; both gates cleaned their own markers), but a data-consistency gate reading a shared DB while another gate mutates it is a real cross-contamination risk.

## What to do differently
Gates that **write** the shared DB should be **serialized**, or each must use a **strictly unique marker namespace + fail-closed self-cleanup** and read/act on **only its own rows** (never delete foreign rows). Purely **static** gates (red-team-code) can always run in parallel with anything. When DB-mutating gates are parallelized to save wall-clock, the orchestrator must **expect and tolerate foreign in-flight rows** in any out-of-band count/read and not treat them as a failure. **Trigger for /improve:** the `/actualize` Step-4 dispatcher should either run dcon and red-team-interactive **sequentially**, or guarantee per-gate marker isolation + own-rows-only cleanup, before parallelizing them against a shared database.
