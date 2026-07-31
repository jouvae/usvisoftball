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
