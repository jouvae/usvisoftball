# go-tester — learned rules

Loaded by `.opencode/agents/go-tester.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-go-tester-security-regression
- trigger: a scenario/task closes an audit finding (id like `H9`/`C1`/`M11`)
- rule: write a test that demonstrates the vulnerability is closed (e.g. caller B reads caller A's resource → `PermissionDenied`/`NotFound`), asserting the explicit gRPC status code; it must fail on old behavior, pass on the fix
- status: binding
- confidence: high
- source: audit-report.md §0.4; refactor-plan
- promoted: 2026-06-24
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none

### R-go-tester-scenario-group-matches
- trigger: writing a test's embedded scenario block
- rule: the `group:` in the test block must match the scenario file's `group:`; reconcile before writing
- status: provisional
- confidence: medium
- source: 05-29-2026-create-reservations (WARN-BE-009)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-go-tester-anti-enumeration
- trigger: testing signup / login / password-reset, or any account-enumeration-sensitive endpoint
- rule: assert the response is indistinguishable (identical gRPC status + body) for a registered vs unregistered identifier, and add a timing-parity check; cover signup, login, AND reset — a single-endpoint test leaves the oracle open
- status: provisional
- confidence: high
- source: L-identity-refine-01; audit M3; docs/features/identity/refine/anti-enumeration.md
- tier: T3
- promoted: 2026-06-26
- last_validated: 2026-06-26
- recurrences_after: 0
- gate: none
- note: SECURITY rule — `binding` promotion requires the security-review gate.

### R-go-tester-constraint-fixtures
- trigger: a scenario asserts capacity/limit/constraint behavior
- rule: build the fixture so the constraint is actually exercised (e.g. an instance with limited capacity), not just the default unconstrained entity
- status: provisional
- confidence: medium
- source: 05-29-2026-create-reservations (WARN-BE-008)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-go-tester-serialize-testcontainer-runs
- trigger: verifying a testcontainer-backed service test package (e.g. reservations) with `go test`
- rule: run the AUTHORITATIVE full-package pass ALONE — never two full-package `go test` invocations at once (a backgrounded run plus a foreground run). Concurrent runs contend over shared infra (DB/ports/backend) and produce a mass of spurious FAILs across unrelated suites (Instance/Booking/Authz ~6s timeouts). If a run shows many unrelated failures + 6s timeouts, suspect concurrency, re-run serially, and confirm green BEFORE reporting RED.
- status: provisional
- confidence: high
- source: L-data-v1-deliver-improve (07-17-2026); data/v1 D5 route-rework verification
- tier: T3
- promoted: 2026-07-17
- last_validated: 2026-07-17
- recurrences_after: 0
- gate: none
- note: FOLLOWED and held in L-data-v1-deliver-security-authz (07-19) — packages run one at a time; no recurrence.

### R-go-tester-helper-placement
- trigger: adding or moving a test helper — deciding whether it belongs in shared `libs/go/tests` or a service's `tests/` dir
- rule: a helper used by exactly ONE service's tests belongs in that service's `services/alpha/modules/{service}/tests/helpers_test.go` (package `service_tests`), NOT `libs/go/tests`. Only genuinely multi-service helpers (used by ≥2 service test packages) stay in `libs/go/tests`. Test rule: before adding to `libs/go/tests`, grep the helper's prospective callers across `services/alpha/modules/*/tests/` — one service → local; ≥2 → shared. A method on `tests.Helper` that depends on an unexported registered-client var but is single-service should be de-methodized to a plain func using the service fixture's own client (`fixture.contentClient`/`fixture.indClient`). Service-specific record/data builders (`Make*ImportRecord`, menu/passport fixtures) are the common offenders — keep them next to the tests that use them.
- status: provisional
- confidence: high
- classification: CONVENTION_VIOLATION
- source: L-data-v1-deliver-security-authz (07-19-2026); libs/go/tests de-bloat (user directive); restates CLAUDE.md test-helper placement discipline
- tier: any
- promoted: 2026-07-19
- last_validated: 2026-07-19
- recurrences_after: 0
- gate: none

### R-go-tester-route-not-a-resource
- trigger: a data/v1 (reservations) test asserts a ROUTE id appears in `associated_resource_ids` or a `listing_resources` row
- rule: under data/v1 D5 a route is NOT a resource — it binds via `listing_routes` (projection) + `route_rules` (authoritative join), never `listing_resources`. Assert route↔listing/rule binding through `route_rules`/`listing_routes` via `dconDB`; a resource-binding scenario (N resources → one listing) must use real physical resources (e.g. `tests.Helper{}.CreateVesselResource`). Relocate such an assertion to the new join — do not loosen or delete it.
- status: provisional
- confidence: high
- source: L-data-v1-deliver-improve (07-17-2026); data/v1 D5 route-rework verification
- tier: T3
- promoted: 2026-07-17
- last_validated: 2026-07-17
- recurrences_after: 0
- gate: none
