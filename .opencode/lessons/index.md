# Lessons Index

> Part of the learning loop — see [`../rules/LEARNING-LOOP.md`](../rules/LEARNING-LOOP.md).
> Lessons here are the **audit trail** (never deleted). Promoted **rules** live as
> records in [`../rules/agents/`](../rules/agents/) and are tracked for effectiveness
> in `.claude/metrics/aggregated/rule-effectiveness.json` (report:
> `.claude/scripts/rule-stats.sh`). `/improve` captures + promotes;
> `/improve --consolidate` prunes.

## workspaces/providers

| Date | File | Issues Fixed | Criticals | Auto-applied Rules |
|------|------|-------------|-----------|-------------------|
| 2026-06-29 | [06-29-2026-workspaces-providers-01.md](./06-29-2026-workspaces-providers-01.md) | empathize phase-boundary (T3) — a scaffolded seam's imports are a claim, not evidence: `migrations.Manifest`/`ManifestPassenger`/`ManifestCrewAssignment` read as a "mislocated type" but `go build` proves them phantom (pkg doesn't compile) → manifest model is absent, define service-owned from scratch. Do differently: compile the referencing pkg + classify present/mislocated/phantom before recording a mined entity/convention finding | — | 0 (rule candidate → /improve) |
| 2026-06-29 | [06-29-2026-workspaces-providers-02.md](./06-29-2026-workspaces-providers-02.md) | conceptualize slice-1 verification (T3) — human feedback: (1) never bypass an entity's RPC to create/seed it (non-ULID `ins-…` id = bypass tell); (2) don't mint sessions via grpcurl / don't hit gRPC directly for e2e — service integration tests use `libs/go/tests` + fixture gRPC client + **testmode FLAG** (`TEST_MODE` env removed; OTP not gated under flag); Playwright e2e drives the real auth HTTP flow via the **dorothy proxy**; (3) every scenario gets a service integration test, frontend → Playwright e2e; (4) new RPC needs its dorothy `/api/v1` route. Wired into go-tester/go-implementer/nextjs-tester/playwright/conceptualize | — | 0 (rule candidates → /improve) |

## inspirations/refactor

| Date | File | Issues Fixed | Criticals | Auto-applied Rules |
|------|------|-------------|-----------|-------------------|
| 2026-06-26 | [06-26-2026-inspirations-refactor-01.md](./06-26-2026-inspirations-refactor-01.md) | convention — services drop the `repo` package/`Repository` interface; service layer uses `gormClient` directly + owns transactions (`docs/db-rules.md`; reservations is the live template, not the decommissioning novella). Corrects L-insp-refactor-03; flags `.claude/rules/data.md` + `.opencode/rules/data.md` as stale | — | 0 (rule candidate → /improve) |
| 2026-06-27 | [06-27-2026-inspirations-refactor-02.md](./06-27-2026-inspirations-refactor-02.md) | convention — three baseline rules: (1) total novella excision incl. env-var names; (2) each service owns its domain types, no shared `migrations` import; (3) domain services host no analytics. Meta: don't "decouple" by re-homing a thing that doesn't belong in the target domain — delete it from scope. Builds on L-insp-refactor-04 | — | 0 (rule candidate → /improve) |
| 2026-06-27 | [06-27-2026-entities-registry-living-artifact.md](./06-27-2026-entities-registry-living-artifact.md) | process — `docs/entities.md` is a first-class input/output of EVERY ECA phase: consult to ground research, update as discoveries land (marked *proposed* until /plan ratifies, version bumped at /actualize). Wired into empathize/conceptualize/actualize commands | — | 0 (rule candidate → /improve) |

## identity/refine

| Date | File | Issues Fixed | Criticals | Auto-applied Rules |
|------|------|-------------|-----------|-------------------|
| 2026-06-26 | [06-26-2026-identity-refine-01.md](./06-26-2026-identity-refine-01.md) | empathize lesson — anti-enumeration is a signup+login+reset+timing invariant (ADR-5) | — | 0 (rule candidate → /improve) |
| 2026-06-26 | [06-26-2026-identity-refine-02.md](./06-26-2026-identity-refine-02.md) | empathize lesson — formalizing a pre-ECA feature; thin-scenario hardening is correct; T3 calibration OK | — | 0 |
| 2026-06-26 | [06-26-2026-identity-refine-improve.md](./06-26-2026-identity-refine-improve.md) | /improve capture — promoted anti-enumeration (M3) rule candidate | 0 | 4 provisional (security-gated): R-{go-implementer,go-tester,nextjs-implementer,reviewer}-anti-enumeration |
| 2026-06-27 | [06-27-2026-identity-refine-03.md](./06-27-2026-identity-refine-03.md) | /conceptualize R5 capture — BFF `handleApiError` strips structured `error_code`/`success` the FE branches on (lockout UI was unreachable); fixed + swept all BFF routes (1 active instance) | 0 | 1 provisional: R-nextjs-implementer-bff-preserve-error-code |
| 2026-06-28 | [06-28-2026-identity-refine-04.md](./06-28-2026-identity-refine-04.md) | /conceptualize Resend capture — rate-limiter ↔ recovery-flow interaction broke recovery twice (resend shared verify's counter; verify per-IP ceiling too low for the resend→retry loop); fixed → per-identity primary + high own-counter per-IP backstop | 0 | 1 provisional: R-go-implementer-recovery-ratelimit-isolation |

## create-reservations

| Date | File | Issues Fixed | Criticals | Auto-applied Rules |
|------|------|-------------|-----------|-------------------|
| 2026-05-29 | [05-29-2026-create-reservations.md](./05-29-2026-create-reservations.md) | 12 (3 Critical + 9 Warnings) | 3 | 1 (enum-to-map sync rule in fix skill) |
| 2026-05-29 | [05-29-2026-create-reservations-02.md](./05-29-2026-create-reservations-02.md) | 4 Warnings (0 Critical) — partial-fix regressions | 0 | 0 (warnings only) |
| 2026-05-29 | [05-29-2026-create-reservations-03.md](./05-29-2026-create-reservations-03.md) | 4 Warnings (0 Critical) — final fix pass | 0 | 0 (warnings only) |
| 2026-05-29 | [05-29-2026-create-reservations-04.md](./05-29-2026-create-reservations-04.md) | 7 (1 Critical + 6 Warnings) — review-005 fix pass | 1 | 2 (barrel-export rule + FromProto field rule) |
