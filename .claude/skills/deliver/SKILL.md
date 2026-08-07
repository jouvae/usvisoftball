---
name: 3D Deliver
description: Run the 3D flow's DELIVER phase for a feature — make it REAL. Relies on the buildable slices from Design. Node 1 Slice (wire mocks→real backend + integration + e2e + DCON), Node 2 Load (vs a defined budget), Node 3 Secure (two-level red-team). Blocking gates block merge at every tier. Persists per-phase results to Supabase. Invoke as /deliver {group}/[{feature}/…]/{version} (e.g. /deliver listings/search/v2 → feature 'listings_search_v2').
disable-model-invocation: true
argument-hint: "{group}/[{feature}/…]/{version}"
allowed-tools: ["Task", "Read", "Write", "Edit", "Bash"]
---

# 3D — Deliver (make it *real*)

Goal: take Design's **buildable (mocked) slices** and make them **shippable** — wire the real
backend, prove the data is right (dcon), prove it holds under load, prove it's secure. Three nodes.
Full contract: `docs/features/3d/v1/3d-spec.md` §3 (Deliver). State + per-phase results in Supabase
via `3d-artifacts` (`scenario_phase_results`).

**Feature identity.** `$ARGUMENTS` is a `/`-delimited path `{group}/[{feature}/…]/{version}` —
**group** first, **version** (`vN`) last. Supabase **`name`** = the path with `/`→`_` (e.g.
`listings/search/v2`→`listings_search_v2`); **`group`** = first segment; **`version`** = last segment;
**doc folder** = `docs/features/{$ARGUMENTS}` (nested by group, versioned). **Resume first**: read the
feature (by `group` + `name`) + scenarios + `scenario_phase_results` from Supabase. A scenario enters
Deliver at `lifecycle_state='prototyped'`.

Folds the old BDD sub-steps (`plan`/`qa`/`fix`/`implement`) as **sub-steps of this phase**, not peer
commands. Tier gates which experts activate (hybrid: honor any scenario `tier_override`).

## Node 1 — Slice (wire to backend + verify)
For each prototyped scenario:
- **Replace mocks with real backend wiring** (this is where the prototype meets the backend).
- **Schema is a migration, not a struct field.** Any new/changed table, column, index, or backfill
  ships as a numbered goose SQL migration in `data/migrations/{service}/` (Up **and** Down), applied
  with `make {service}-migrate` and re-applied in the service's `TestMain`. **`gorm.AutoMigrate` is
  frozen legacy** — nothing new goes into `doAutoMigrations`. Rules: `.claude/rules/data.md`.
- **Tests:** integration tests + e2e tests. Backend via `go-tester`/`go-implementer` + shared
  `libs/go/tests` helpers (service-specific helpers stay in the service's own `tests/`) + fixture
  gRPC client (testmode FLAG); frontend via `nextjs-tester`/`nextjs-implementer` + Playwright driving
  the **real auth flow through the dorothy proxy** (never grpcurl session-minting, never bypass an
  entity's RPC to seed). Mark `tested`.
- **Backend code review (`go-qa-reviewer`) — run it before dcon.** Whenever the slice touched Go,
  dispatch `go-qa-reviewer` with the scenario(s), `PHASE=deliver`, and the changed files. It reads the
  written code for **correctness** and conformance to `.claude/rules/go-standard.md` +
  `.claude/rules/data.md` + `.claude/agents/go-tester.md`, and returns a **fix order** — it never
  edits and never dispatches anyone. On `FAIL`/`NEEDS_REVISION`, **you** re-run `go-implementer`
  against that fix order, then re-run the reviewer. Do not advance `lifecycle_state` on a failing
  verdict, and do not spend a dcon cycle on code the reviewer already called broken.
- **dcon (BLOCKING, data-writing scenarios):** the `dcon` subagent reads **actual DB state
  out-of-band** vs the scenario's `then`/`data_validation_expectations`. Store the result in
  `scenario_phase_results` (phase `data-validated`). "Tests green" ≠ "right data written."
  Summarize the 3 verifications (integration + e2e + dcon) to the human **before** their own check.

## Node 2 — Load (vs a defined budget)
Declare a **load/performance budget** for the feature/tier (never "performing as expected" undefined).
The `load-test` subagent runs load vs that budget; store results (phase `load-tested`). A miss loops
back (open loop recorded).

## Node 3 — Secure (two-level red-team, BLOCKING)
- **Static authz pre-gate (run FIRST, before red-team).** Run the deterministic tenant-isolation
  gate `./libs/scripts/check-workspace-authz.sh` (also `make check-authz`). It fails if any
  enforced workspace-scoped RPC lost its per-workspace `CheckAccess`, and lists unreviewed tenant
  RPCs. This is the down-the-ladder gate for the data/v1 cross-tenant IDOR (`R-reviewer-bola-body-id`
  recurred because Deliver never runs the `reviewer` agent) — catch BOLA/IDOR at implement-time, not
  only at the red-team. If a slice added/changed a tenant RPC, add it to the gate's `AUTHZ_ENFORCED`.
- `red-team-code` — static branch-diff (CVEs/deps, insecure patterns, authn/authz gaps, secrets).
- `red-team-interactive` — attacks the **running** app (auth/session, authz boundaries, injection,
  exposed surface). Activation-gated by tier (static every tier; interactive on T2/T3 or a trigger).
- Store findings; mark `secured`. **Both red-teams + dcon block merge regardless of checkpoint
  toggles** — lowering a checkpoint is convenience, not de-escalation.

## Gates & checkpoints
Checkpoints **pre-merge** (review gate results) and **pre-deploy** (before rollout). Blocking gates
(dcon + both red-teams) are non-negotiable. A scenario is **shippable** only at `lifecycle_state=
'secured'`.

## Always
- Store every phase result in `scenario_phase_results`; keep the Supabase board honest (not `status.md`).
- Emit metrics; surface `improvement_opportunities` from gate failures/errors (self-improvement).
- On any gate failure, loop backward to the right phase and re-run on fix (re-entrant).
- **Lessons and metrics go to SUPABASE, not the repo.** Write each lesson as a `lessons` row
  (`domain`, `tags`, `tier`, `phase`, `ladder_stage='observation'`) via `3d-artifacts`; metrics via
  `metrics-writer`. The repo holds only **ratified** rules in `.claude/rules/*.md` — a rule enters a
  ratified file only when it recurs across ≥2 features, is a confirmed Critical, or the human
  ratifies it (`.claude/rules/LEARNING-LOOP.md`). Never write to `.opencode/`.

## Report
`Deliver: {name} — sliced {n} · go-qa {pass/fail, n fixes} · dcon {pass/total} · load {pass/fail vs
budget} · secure {pass/fail} · shippable(secured) {n}/{total}.`
