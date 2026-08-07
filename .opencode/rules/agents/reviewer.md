# reviewer — learned rules

Loaded by `.opencode/agents/reviewer.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-reviewer-security-fix-has-test
- trigger: reviewing a change that closes an audit finding (id like `C1`/`H9`/`M11`)
- rule: block approval unless a regression test accompanies the fix that fails on the old behavior and passes on the new (audit §0.4)
- status: binding
- confidence: high
- source: audit-report.md §0.4; refactor-plan
- promoted: 2026-06-24
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none

### R-reviewer-bola-body-id
- trigger: reviewing an RPC that acts on a request-body `subject_id`/`workspace_id`/`resource_id` (OR a scope taken from an HTTP header like `Active-Workspace-Slug`)
- rule: require a server-side `CheckAccess` on that object BEFORE any read/write; caller identity must come from the session token, not the body/header, unless gated by platform-admin. A `!= ""` presence check, a check that no-ops when the header is absent, or an empty-scope fall-through to an unscoped all-tenant query are all NON-authorization.
- status: binding
- confidence: high
- classification: SECURITY
- source: audit-report.md H9/H10/H11/M10; RECURRED in L-data-v1-deliver-security-authz (07-19-2026)
- promoted: 2026-06-24
- last_validated: 2026-07-19
- recurrences_after: 1
- gate: script:libs/scripts/check-workspace-authz.sh
- note: Recurred in data/v1 (cross-tenant IDOR) because the 3D Deliver flow does not invoke the `reviewer` agent — the prompt rule never fired; red-team caught it. REMEDIATED 2026-07-19 by moving down the ladder: the deterministic gate `check-workspace-authz.sh` now enforces this flow-independently (CI `test-alpha` + Deliver Node-3 pre-gate + `make check-authz`). The reviewer prompt rule stays as defense-in-depth for the BDD flow (semantic authz the grep can't verify); the gate is the backstop that closes the unapplied-in-3D-flow gap.

### R-reviewer-cross-ref-enum-consumers
- trigger: reviewing a change that adds an enum value or a new response field
- rule: verify all consumers updated — transition maps, API-route flattening, TS types, FromProto/ToProto. Missing cross-references were the top recurring critical class.
- status: binding
- confidence: high
- source: 05-29-2026-create-reservations (CRIT-FE-15, CRIT-FE-16)
- promoted: 2026-05-29
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none

### R-reviewer-anti-enumeration
- trigger: reviewing a change to signup / login / password-reset, or any "account already exists / not found" messaging
- rule: block approval if the fix distinguishes a registered from an unregistered identifier via status code, body, redirect, set-cookie, or response timing — or if it touches only one of signup/login/reset while another endpoint still leaks. Distinguishing info must be inbox-only.
- status: provisional
- confidence: high
- source: L-identity-refine-01; audit M3; docs/features/identity/refine/anti-enumeration.md
- tier: T3
- promoted: 2026-06-26
- last_validated: 2026-06-26
- recurrences_after: 0
- gate: none
- note: SECURITY rule — `binding` promotion requires the security-review gate. Eventual target: port the status/timing-parity check to `.claude/scripts/` (gate) once stable.

<!-- Tombstone R-reviewer-repository-pattern (retired 2026-06-24) DELETED at consolidation
2026-07-19 — one cycle elapsed; the Repository pattern is abolished and durably documented in
go-standard.md + the 06-26-2026-inspirations-refactor-01 lesson. Lessons files are never deleted. -->

