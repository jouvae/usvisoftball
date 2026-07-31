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
- trigger: reviewing an RPC that acts on a request-body `subject_id`/`workspace_id`/`resource_id`
- rule: require a server-side `CheckAccess` on that object; caller identity must come from the session token, not the body, unless gated by platform-admin
- status: binding
- confidence: high
- source: audit-report.md H9/H10/H11/M10
- promoted: 2026-06-24
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none

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

---

## Retired (tombstones — delete after next consolidation)

### R-reviewer-repository-pattern  — RETIRED 2026-06-24
- was: "Generic `Get()` with Query pattern; repo returns `migrations.*`; tests in `suite_apis_test.go`"
- reason: the Repository pattern was ABOLISHED (`go-implementer`: use `gormClient` directly; `go-tester`: tests in `tests/` with `TestMain`/`TestFixture`, not testify). This rule contradicted current standards and caused the reviewer to flag correct code. Removed from the reviewer agent on 2026-06-24.
- status: retired
