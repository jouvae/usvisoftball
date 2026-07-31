# Lesson — workspaces/providers (conceptualize slice 1 verification)

- **Date:** 2026-06-29
- **Feature:** workspaces/providers
- **Phase:** Conceptualize (slice 1 — backend "unblock manifest")
- **Tier:** T3
- **Type:** process + convention (verification discipline) — rule candidate → /improve
- **Source:** direct human feedback after the slice-1 hard-stop

## What happened
Verifying a backend RPC slice (`AssembleManifest`) headlessly, I (a) tried to **mint a session via
grpcurl** against the gRPC port directly, (b) hit `TEST_MODE=none` and treated OTP-gating as an
environment blocker, and (c) considered/began reasoning about **seeding an instance via a direct DB
insert** and targeting a pre-existing instance whose id (`ins-000f6a70ba380fee8039d8df3c`) was a
**non-ULID** — a tell that it had been created **bypassing the `CreateInstance` RPC**. All three are wrong.

## The corrections (binding)
1. **Never bypass an entity's RPC to create/seed it.** Every entity is created through its own RPC
   (`CreateInstance`, `CreateBooking`, …). No direct DB inserts, no hand-rolled rows. A non-ULID
   id (e.g. `ins-000f6a70ba380fee8039d8df3c` vs `ins-01KW…`) is a red flag that a bypass happened —
   surface it, don't build on it.
2. **Don't mint sessions via grpcurl, and don't call the gRPC service directly for e2e.**
   - **Service integration tests** (`services/alpha/modules/{svc}/tests/`) authenticate + create
     entities through the **`libs/go/tests`** helpers (init session, authenticate, create
     workspace/instance/booking via the real RPCs) and call the target RPC via the **fixture gRPC
     client**. Run with the **testmode FLAG** passed to `go test` (the `TEST_MODE` **env var was
     removed**); under the flag OTP is **not** email-gated.
   - **Playwright e2e** drives the **real auth HTTP flow** through the **dorothy HTTP→grpc proxy**
     (`/api/v1/…`), never the gRPC service directly and never a minted/stubbed session.
3. **Every scenario gets a service integration test** (one per scenario, reflecting its Given/When/Then
   as the dcon-aligned outcome). **Once the frontend exists**, add the Playwright e2e per scenario too.
4. **A new RPC that the UI/e2e will exercise needs its dorothy `/api/v1/…` proxy route** added as part
   of the slice — the HTTP→grpc proxy is the public surface; don't leave the RPC reachable only via raw
   gRPC.

## Do differently
- For a backend slice, the verification of record is a **service integration test** (RPC-only, real
  deps, testmode flag) — not ad-hoc grpcurl. grpcurl is fine for a quick negative/registration probe,
  never for session-minting or as the happy-path proof.
- When verification "needs data," create it via the **owning RPC inside the test**, never by reaching
  around the service.

## Builds on
- [[06-29-2026-workspaces-providers-01]] (same feature; "compile before you classify a mined finding").
- Reinforces RPC-only / no-bypass beyond tests into **verification + seeding**.

## Wiring (so it doesn't recur)
- `.opencode/agents/go-tester.md` — testmode is a flag (not env); per-scenario integration tests; use
  `libs/go/tests` helpers; never bypass an entity's RPC for setup.
- `.opencode/agents/go-implementer.md` + `nextjs-*` — never bypass RPCs to create/seed entities.
- `.opencode/agents/nextjs-tester.md` + `.opencode/skills/playwright` — e2e via dorothy proxy + real
  auth HTTP flow; never mint/stub sessions.
- `.opencode/commands/conceptualize.md` — self-verify: backend slice = integration test (testmode flag,
  libs/go/tests, real RPCs); UI slice = Playwright via dorothy proxy; no grpcurl session-minting; no
  RPC bypass for seeding.
</content>
