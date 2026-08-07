---
description: ECA Phase 2 (Conceptualize) — explore the what in live prototyping mode. The Claude-Design-like experience the user steers in the browser, against the real backend, one visible slice at a time. Prototypes are exempt from BDD and TDD and may be created and destroyed freely. Never shippable from here — must pass through /actualize. "It didn't work / users didn't want it" is a celebrated kill/pivot.
---

# Conceptualize Command

Put the human into **live prototyping mode**. The goal is to learn, not to ship.
Make the feature *workable*; `/actualize` makes it *shippable*. This command is the
ECA wrapper over the repo's existing prototyping loop (`.opencode/commands/proto.md`)
plus a greenfield mode and the kill/pivot + status hooks.

**What to prototype:** `$ARGUMENTS` (feature slug + the slice the human wants to see)

## Modes

- **Against the current app (default)** — prototype directly in the running
  monorepo, reusing real RPCs and data.
- **Greenfield / isolated (`--greenfield`)** — stand up the new app/functionality in
  an isolated **throwaway git worktree** so experiments never touch the working tree:

  ```bash
  git worktree add ../proto-{feature} -b proto/{feature}
  ```

  Prototype there against the same Docker stack (`make up`). When the slice is
  learned, copy forward only what survives and **remove the worktree**:

  ```bash
  git worktree remove ../proto-{feature} --force
  ```

  Nothing in a greenfield worktree is shippable — survivors re-enter through
  `/actualize` on a real branch.

## Step 0 — Preflight (from proto.md)

1. **Frontend up?** `curl -sf -o /dev/null -w "%{http_code}" http://alpha.jouvae.com`
2. **Backend reachable?** `curl http://api.alpha.jouvae.com/api/v1/health/check` with headers
3. **Mock mode MUST be off:** grep `NEXT_PUBLIC_MOCK_MODE` in `clients/web/.env.local`
4. Read `status.md`; load the `design-system` skill before any UI.
4.5. **Read the empathize artifacts that steer this prototype:** `information-architecture.md`
   (prototype the **screens** it inventories, against the **bounded-context seams** it names —
   one IA screen ≈ one prototype slice) and `event-storming.md` (the commands/events/policies a
   slice realizes, and the 🔴 hotspots a slice may resolve). If they are absent, note it and
   prototype from `scenarios.md` + `overview.md` alone, but prefer running `/empathize` first so
   the prototype builds the structure the IA defines.
5. **Read `docs/entities.md`** for the entities this slice touches — prototype against the
   *current* canonical definitions. As prototyping reveals a definition needs to change
   (new entity, renamed field, altered relationship/lifecycle), **update `docs/entities.md`
   and add a dated changelog entry** (mark unratified changes *proposed — {feature}
   conceptualize; ratify in /plan*). The entity registry is a living input/output of every
   phase.

## Core principles

1. **Live-first** — every change is immediately visible in the running app.
2. **Smallest visible slice** — the smallest increment the user can see and play with.
3. **UI-first, real data underneath. Never mock mode.**
4. **Every slice ships its test — verification of record, not optional.** The prototype exemption is
   only from the **full upfront BDD ceremony** (`/plan → /qa → /scaffold`) and the `/actualize` gates
   (dcon, red-team, CI) — it is **NOT** an exemption from tests. Each slice that lands behavior gets a
   real test, created through the proper harness, that you RUN and watch pass before the hard-stop:
   - **Backend slice → a `go-tester` service integration test** in `services/alpha/modules/{svc}/tests/`,
     one per scenario it realizes, RPC-only via the fixture client, **run with `go test -tags testmode`**
     (the `testmode` build tag ungates OTP; the `TEST_MODE` env var is gone). This is the backend
     verification of record — **never** ad-hoc grpcurl as the proof.
   - **Frontend slice → a `nextjs-tester` Playwright e2e** through the **Dorothy `/api/v1/...` proxy**,
     driving the **real auth flow** (no minted/forged sessions).
5. **Self-verify by observing, not by inferring.** Before any hard-stop you must have *watched* the slice
   behave — a passing integration test you ran (backend) and/or the real UI driven with Playwright
   (frontend: authenticate via the real flow, perform the interactions, assert the visible outcome,
   screenshot it). A green *build* or a request that "reaches the backend" is necessary but never
   sufficient. Never report a slice working on compilation/wiring alone.

   **Data & sessions — never reach around the service (this is the rule you keep being reminded of):**
   - **Never bypass an entity's RPC to create/seed it.** Every entity (workspace, instance, booking,
     reservation, participant, …) is created through its own `Create*` RPC — in tests, in verification,
     everywhere. No direct DB inserts, no hand-built rows. A **non-ULID id** (e.g. `ins-000f6a70…` vs
     `ins-01KW…`) is a tell that a bypass happened — surface it, don't build on it.
   - **Never mint/forge a session** (no grpcurl session-minting, no fake cookie/Bearer header). Backend
     tests authenticate via `libs/go/tests` helpers under `-tags testmode`; Playwright drives the real
     sign-in flow through Dorothy.
   - **A new RPC the UI/e2e will exercise needs its Dorothy `/api/v1/...` proxy route** added as part of
     the slice (mirror a handler in `services/alpha/modules/dorothy/service/http_*.go` + register in
     `init_http.go`). e2e and the BFF go through Dorothy, never raw gRPC.
6. **One slice at a time. Hard stop after each.** Never advance until the user
   confirms the slice in the browser.
7. **You orchestrate; you never write impl/test code yourself.**
8. **Standards still apply — the exemption is BDD/TDD only.** Prototype code is exempt from
   *tests*, NOT from the repository's coding standards, because it is promoted as-is through
   `/actualize` — standards debt compounds if you let it in here. Every implementer you spawn
   must follow the established rules; brief them with the relevant standard and reject violations:
   - `go-implementer` → `.opencode/agents/go-implementer.md`: **Func Flow** thin-orchestrator
     RPCs (domain types between phases, proto only at validate/respond) and **direct GORM via the
     `gormClient`/`gormClient` on `ServiceImpl` per `docs/db-rules.md`** — never the abolished
     `repo.Repository` interface or the `global.Query` term-translation path for service-layer
     reads/writes.
   - `nextjs-implementer` → the `design-system` skill / `DESIGN.md` and the project `apiClient`
     (never raw `fetch`).

## The loop (per slice)

1. **Align** — restate the smallest next slice in one line.
2. **Shape** — spawn **architect** to sketch the slice.
3. **QA the sketch** — `go-qa-reviewer` and/or `nextjs-qa-reviewer` as relevant.
4. **Data path** — existing RPC? use it. New/changed RPC? **`go-tester` writes the service integration
   test(s)** for the slice's scenario(s) → **`go-implementer`** makes them pass (Func Flow +
   `gormClient`/`docs/db-rules.md`; **never bypass an entity's RPC to seed**). Do **NOT** skip `go-tester` —
   the integration test (run `go test -tags testmode`) IS the backend verification. **Add the Dorothy
   `/api/v1/...` proxy route for any new RPC the UI/e2e will call.**
5. **Build the UI slice** — **`nextjs-tester` writes the Playwright e2e** (through the Dorothy proxy, real
   auth flow) → **`nextjs-implementer`** makes it pass (design-system + `apiClient`, never raw `fetch`).
   Do **NOT** skip `nextjs-tester` — the e2e IS the frontend verification. Verify a clean typecheck/lint.
6. **Self-verify against the live app — RUN the test(s) and watch them pass; drive the real UI with
   Playwright (mandatory for any UI slice).** Load the `playwright` skill and use the Playwright CLI/library
   to actually open
   the slice's route in a real browser, **authenticate by driving the real auth flow** (sign in via
   the sign-in page → the `/api/v1/...` auth endpoints through the **Dorothy proxy** — never mint/forge
   a session token, never set a fake auth cookie/header, never stop at the auth boundary and call it
   verified), perform the slice's interactions, and **assert the visible outcome** the scenario
   specifies (the rendered DOM/text, not just an HTTP 200). Capture a screenshot as evidence. **Create
   any scenario data through the app or its real create-RPCs (via Dorothy) — never seed via SQL/grpcurl;
   a non-ULID id is a tell that a bypass happened.**

   **A backend-only slice's verification of record is a service integration test, not ad-hoc grpcurl.**
   Have `go-tester` write the test(s) in `services/alpha/modules/{svc}/tests/` (RPC-only via the fixture
   client; setup data created through real `Create*` RPCs / `libs/go/tests` helpers — NEVER bypassing an
   entity's RPC) and run them with the build tag: `go test -tags testmode ./services/alpha/modules/{svc}/tests/...`
   (the `TEST_MODE` env var is gone; the `testmode` tag ungates OTP so auth completes). grpcurl is
   acceptable ONLY for a throwaway registration/negative probe — never for session-minting or as a
   happy-path proof. **A new RPC the UI/e2e will exercise needs its Dorothy `/api/v1/...` proxy route
   added as part of the slice** (mirror a handler in `services/alpha/modules/dorothy/service/http_*.go`
   + register in `init_http.go`). "Builds compile / the request reaches the RPC" is NOT self-verification
   — observe the actual behavior. If you genuinely cannot drive it, say so explicitly in the handoff and
   mark the slice unverified — do not imply it works.
7. **Hand off and wait — HARD STOP.** Report (built / look-at-it / data / backend /
   **integration-test: `go test -tags testmode` PASS + the observed ids** / **playwright-verified: what you
   drove + asserted + the screenshot path** / waiting-for) and let the human play with it and steer.

## Status + kill/pivot

- Mark each scenario the human confirms in the browser as `prototyped` on the
  `status.md` board.
- **Kill/pivot (celebrated):** if the human concludes "users didn't want it" or "it
  didn't work," that's a first-class outcome → record in `changelog.md`, loop back to
  `/empathize` (or close the feature), and run `/aar {feature}`. Do not push a dead
  prototype forward to make it "count."

## Checkpoint

**post-prototype / pre-build** (default on): before any move toward `/actualize`,
confirm the direction with the human. This is also the kill/pivot point.

## Promotion boundary (hard)

A prototype built in the main codebase may already be most of a shippable feature —
but it is **never** shippable from here. It must pass through `/actualize` (promotion
gate: debt audit, backfilled tests, dcon, red-team, CI). Say so in the handoff.

## On phase boundary / error

Run `/aar {feature}` automatically at the kill/pivot point and when an error is hit
and resolved mid-session.

## Constraints

- Never write implementation or test code yourself — orchestrate the agents.
- Never run in mock mode. Never tell the user to rebuild/restart the backend (air
  hot-reloads Go edits; `make apis` only after proto changes).
- Never mark a scenario past `prototyped` here — promotion happens in `/actualize`.
## Always update status (automatic — never wait to be asked)

A slice is not done until the feature docs reflect it. At every per-slice hard-stop,
direction checkpoint, and kill/pivot — and BEFORE you report back — update the feature docs
yourself, without being prompted:

1. **`status.md`** — set `**Updated:**` to today's absolute date and `**Phase:**` to the
   current phase; refresh the scenario-board states (mark a slice `prototyped` only after the
   human confirms it in the browser); and keep a current top-of-file **▶ SESSION HANDOFF
   (<date>)** block: the one-line state, what's DONE, the single exact NEXT slice, and branch +
   build/verification state — so a fresh session with no memory of this conversation can resume
   from it alone.
2. **`changelog.md`** — append a dated entry for what was built/decided/verified this slice
   (including kills/pivots).

This is a standing requirement, not something the user should have to request. (A full
session-clear that also writes durable memory is still `/checkpoint`; these in-repo status
docs stay current every time regardless.)

## Constraints

- Never write implementation or test code yourself — orchestrate the agents.
- Prototype code MUST still meet the repo coding standards (Func Flow / thin orchestrator;
  direct GORM via `gormClient`/`gormClient`, never the repository interface, per `docs/db-rules.md`;
  design-system; `apiClient` not raw fetch). Brief implementers with the standard and verify a
  clean build / typecheck.
- **Every behavior-landing slice ships a test (verification of record):** backend → a `go-tester`
  service integration test run with **`go test -tags testmode`**; frontend → a `nextjs-tester` Playwright
  e2e via the Dorothy proxy. Do NOT skip the tester. The exemption is only from the upfront `/plan`/`/qa`
  ceremony + `/actualize` gates — NOT from tests.
- **Never bypass an entity's RPC to create/seed data** (no direct DB inserts, no hand-built rows; a
  non-ULID id is a bypass tell). **Never mint/forge a session** (no grpcurl session-minting, no fake
  cookie/Bearer header) — backend tests auth via `libs/go/tests` + `-tags testmode`; Playwright drives the
  real sign-in flow. **e2e + BFF go through the Dorothy `/api/v1/...` proxy, never raw gRPC** — a new RPC
  the UI/e2e needs gets its Dorothy route added in the same slice.
- Never run in mock mode. Never tell the user to rebuild/restart the backend (air
  hot-reloads Go edits; `make apis` only after proto changes).
- Never mark a scenario past `prototyped` here — promotion happens in `/actualize`.
- Keep `status.md` + `changelog.md` current at every hard-stop automatically — never make the
  user ask for a status update.
