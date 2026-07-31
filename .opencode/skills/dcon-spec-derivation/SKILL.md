---
name: dcon-spec-derivation
description: How to derive data-consistency specs from the Then clauses of user-facing BDD scenarios, and how dcon reads actual database state OUT OF BAND (not through the test surface) to validate them. Used by the dcon subagent and /actualize. Only data-writing scenarios produce specs.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Define how a feature's **data-consistency specs** come from its own documentation —
the `Then` clauses in `scenarios.md` — and how `dcon` checks that the *right data*
was actually written, not merely that tests went green. The canonical spec comes from
the feature's scenarios and **nothing else**.

## Deriving specs from `Then` clauses

For each **data-writing** user-facing scenario (a scenario whose `Then` asserts
persisted state — a row created, a status changed, a relation written), translate the
`Then` into a concrete, checkable assertion about storage:

```
Scenario: booking-web-003
  Then a booking is created with status "confirmed" and a payment intent attached

→ dcon spec:
  - table bookings: exactly 1 new row for this run
  - bookings.status == "confirmed"   (normalized; see enum note)
  - bookings.payment_intent_id is non-empty and resolvable in finance
  - SpiceDB: the expected booking relation exists (auth/identity scenarios)
```

Scenarios whose `Then` is purely UI/observational (a banner shows, a list renders)
produce **no** dcon spec. Pure refactor/infra work has no scenarios and no specs.

## Reading actual DB state — OUT OF BAND (approved model)

The repo's testing rule is **RPC-only**: tests must not touch the DB directly. `dcon`
honors that by **not being a test**. It is a validator subagent that reads storage
out of band, *after* the backfilled tests have run and produced state:

- **Postgres** — connect read-only to the dev/test instance (`:5432`, db `jouvae`)
  via `psql`/gorm to inspect rows the scenario should have written.
- **SpiceDB** — inspect relations via the HTTP/gRPC API (`:8081` / `:50055`) with
  `grpcurl`/zed for authz/identity scenarios.
- **Neo4j / Redis / search** — only if a `Then` clause asserts state there.

This is explicitly outside the test surface — it never appears in `services/.../tests/`
and never calls service-impl internals. It is a post-hoc consistency audit.

## Data hygiene that bites in this repo

- **Enum normalization** — domain code uses short forms (`published`,`confirmed`)
  while rows may carry proto enum NAMEs (`INSTANCE_LIFECYCLE_STATE_PUBLISHED`).
  Normalize both sides before comparing; a mismatch here is a real bug class
  (see prior lessons), not a dcon false-positive.
- **protojson zero-omission** — zero scalars are dropped on the wire; key fullness on
  a status enum, never a derived count. Assert on the enum the row stores.
- **Scope to this run** — filter by the ids/keys the scenario created (idempotency
  key, caller id) so dcon validates *this* feature's writes, not ambient data.

## Verdict

```
dcon: {PASS | FAIL}
per-scenario:
  - {scenario-id}: {PASS | FAIL: expected {…}, found {…}}
data_writing_scenarios: {N}
coverage: {must be 100% of data-writing scenarios to PASS}
```

`dcon` **blocks merge**. A FAIL loops `/actualize` back to build with the specific
row/relation mismatch.

## Critical rules

1. Specs come from `Then` clauses only — never invent assertions the scenario doesn't make.
2. Only data-writing scenarios get specs; UI-only `Then`s are out of scope.
3. Read DB out of band — never through the test surface, never via service internals.
4. Normalize enums and scope to this run before comparing — avoid false PASS and false FAIL.
