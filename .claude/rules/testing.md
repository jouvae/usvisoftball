---
description: Ratified test-discipline rules — RPC-only seeding, helper placement, testcontainer serialization, constraint fixtures, and Playwright selector/auth-path rules. Loads when editing Go or Playwright test files.
paths:
  - "services/alpha/modules/**/tests/**"
  - "libs/go/tests/**"
  - "**/*_test.go"
  - "clients/web/tests/**"
---

# Test discipline

The structural conventions (one global fixture per package, gRPC-client-only, testcontainers, the
`testmode` build tag) are in `.claude/agents/go-tester.md` and `CLAUDE.md`. What follows are the
rules ratified from tests that lied — passing suites that hid real defects, and failing suites that
hid nothing at all.

---

## T1. Never seed by bypassing an entity's RPC

Create **all** setup data — workspaces, instances, bookings, reservations, participants — through
the entity's own `Create*` RPC via the fixture client. No direct DB inserts, no hand-built GORM
rows, no reaching around the service.

**The tell is a non-ULID id.** `ins-000f6a70…` instead of `ins-01KW…` means something bypassed the
RPC. Data seeded that way skips validation, permission grants, projections, and events — so the
test asserts against a state the production write path can never produce.

The same discipline applies to authentication: go through `tests.SetupAuthenticatedCaller`. Never
hand-construct session tokens, never call `TrackSession`/`AuthenticateGuest`/`VerifyGuest` inline,
never mint a session with grpcurl. Playwright drives the **real auth flow through the dorothy
proxy**.

If something cannot be set up or verified through the public RPC surface, that gap is a signal to
**add an RPC**, not to reach into the internals.

---

## T2. Helper placement — keep `libs/go/tests` lean without duplicating

| Helper | Where it lives |
|---|---|
| Used by **≥2** service test packages, or cross-cutting by nature (authentication, identity/caller setup, workspace provisioning, idempotency plumbing, container bootstrap) | `libs/go/tests/` — `setups.go` for setup funcs, `entities.go` for result types |
| Used by **exactly one** service — service-specific record/data builders (`Make*ImportRecord`, menu/passport/taxonomy fixtures), assertions about that service's rows, wrappers over its own client | `services/alpha/modules/{service}/tests/helpers_test.go` (`package service_tests`) |

Decide with a grep, not a guess:

```bash
grep -rl "{HelperName}" services/alpha/modules/*/tests/
```

One service → local. Two or more → shared.

- **Do not add a method to `tests.Helper` for single-service work.** If a helper is a method only
  because it needs a registered client var, de-methodize it into a plain function in the service's
  `helpers_test.go` using that package's own fixture client.
- **Promote on the second caller, not in anticipation** — then delete the local copy. Never both.
- Three similar lines of setup is the signal to extract: locally if one service uses it, shared if
  several do. Never a third copy.

---

## T3. Run testcontainer suites one at a time

**Never run two full-package `go test` invocations against testcontainer-backed packages
concurrently** — not a backgrounded run plus a foreground run, not two packages at once.

Concurrent runs contend over shared infrastructure (DB, ports, backend) and produce a **wall of
spurious failures across unrelated suites, with ~6 s timeouts**. That shape is the signature. If
you see it, re-run serially and confirm green **before** reporting RED.

The authoritative full-package pass runs alone.

> Related infra tell: if the backend behaves impossibly — empty workspaces, phantom rate limits —
> check `docker logs core | grep -iE 'panic|evictCount'` before any other theory. An hpack panic
> from concurrent gRPC drives crashes `tmp/main` and masquerades as an application bug.

---

## T4. A fixture must actually exercise the constraint

When a scenario asserts capacity, limit, or constraint behavior, **build the fixture so the
constraint is real** — an instance with limited capacity, a quota already near its ceiling — not
the default unconstrained entity.

A capacity test against an uncapped instance passes for the wrong reason and keeps passing after
the constraint logic is deleted.

---

## T5. One integration test per scenario, and a regression test per security fix

- Every scenario in the feature's scenario set gets a **service integration test** expressing its
  Given/When/Then as observable RPC outcomes. This is the dcon-aligned spec. Backend slices are
  verified by these tests, **not** by ad-hoc grpcurl — grpcurl is fine only for a throwaway
  registration or negative probe, never for session-minting or as a happy-path proof.
- The frontend gets a **Playwright e2e per scenario in addition**, once the UI exists.
- A change closing an audit or red-team finding ships a regression test that fails on the old
  behavior and passes on the fix, asserting the explicit status code
  (`.claude/rules/security.md` §S4).
- A green happy path is not confidence. Also test the failing path, the edge case, and the
  **reloaded-from-server** path.

---

## T6. Playwright: selectors and the unhappy path

- **Verify the `data-testid` against the actual component** before writing the assertion. Account
  for per-step differences — `submit-button` / `pay-button` versus `continue-button`. A test that
  queries a testid the component never renders fails for a reason that has nothing to do with the
  behavior under test.
- Use `page.getByTestId('x')`, not `page.locator('[data-testid="x"]')`.
- **Include the auth-failure / unauthenticated case alongside every authenticated happy path.** An
  e2e suite that only proves the logged-in path proves nothing about the gate.

---

## T7. Apply goose migrations in `TestMain`

Tables owned by versioned SQL migrations are not created by the service at boot, so the test
package applies them itself after the containers are up — see
`services/alpha/modules/reservations/tests/init_test.go` and `.claude/rules/data.md` §9. A
multi-service harness must set and **restore** the goose table name around each apply.
