# go-implementer — learned rules

Loaded by `.opencode/agents/go-implementer.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-go-implementer-anti-enumeration
- trigger: implementing or modifying the signup, login, or password-reset response path (any account-identifier-keyed endpoint)
- rule: make the client-facing response byte-identical (status, body, next-step) for an existing vs non-existing identifier, and equalize path timing (e.g. dummy Argon2 verify on not-found); deliver any "you already have an account" signal to the email inbox only. A change touching one of the three endpoints must verify the other two hold the same property.
- status: provisional
- confidence: high
- source: L-identity-refine-01; audit M3; docs/features/identity/refine/anti-enumeration.md
- tier: T3
- promoted: 2026-06-26
- last_validated: 2026-06-26
- recurrences_after: 0
- gate: none
- note: SECURITY rule — promotion to `binding` requires the security-review gate (LEARNING-LOOP promotion policy).

### R-go-implementer-recovery-ratelimit-isolation
- trigger: wiring or choosing rate-limit middleware on an auth route that participates in a lockout→recover→retry loop — i.e. a verify/OTP route that can lock, a "resend/reissue" recovery route, or any route a user must re-hit to escape a throttle
- rule: make the per-identity/per-token throttle the PRIMARY limit. Any per-IP (or otherwise shared-key) limiter on these routes must (a) use its OWN counter — never share the counter between the recovery action and the action it recovers (a resend must not consume the verify budget), and (b) be a HIGH, configurable ceiling that comfortably exceeds one legitimate lockout→resend→retry cycle (~N attempts × resends), so it acts as a coarse DoS backstop, not a functional ceiling. Never gate a recovery action, or the action it recovers, with a low shared-counter limiter the recovery cannot reset.
- status: provisional
- confidence: high
- source: L-identity-refine-04; refine-go-004/refine-web-002 (H7); docs/features/identity/refine/changelog.md (2026-06-27/28)
- tier: T3
- promoted: 2026-06-28
- last_validated: 2026-06-28
- recurrences_after: 0
- gate: none
- note: recurred TWICE within one feature (resend sharing verify's rl:otp counter; verify's 5/15m per-IP ceiling breaking the resend→retry cycle). Stays provisional (one feature, not a security/data-loss Critical); promote to binding if it recurs in a second feature.

### R-go-implementer-dorothy-fiber-gateway
- trigger: exposing a gRPC RPC over HTTP through the Dorothy gateway (a new `/api/v1/...` endpoint for an existing service RPC)
- rule: Dorothy is a Fiber app that maps HTTP paths → `handle*` methods, NOT grpc-gateway `google.api.http` proto annotations. Add a gateway route by (1) writing a `handle*` method in the matching `services/alpha/modules/dorothy/service/http_*.go` (copy `handleGetListings`: span → `utils.DecodeFiberRequest` → RPC via the injected client `s.rsvClient`/`s.vaultClient`/etc → `s.sendHttpOkJSON`), and (2) registering `r.app.Post("/api/v1/...", r.handleX)` in `init_http.go`. NO proto edit / `make apis` is needed. Before adding, grep `init_http.go` — the handler may already exist under a different path (e.g. `AttachResourceFile` at `/api/v1/vault/resources/attach`); do not create a duplicate.
- status: provisional
- confidence: high
- source: L-data-v1-deliver-improve (07-17-2026); data/v1 Increment-D gateway foundation
- tier: any
- promoted: 2026-07-17
- last_validated: 2026-07-17
- recurrences_after: 0
- gate: none

### R-go-implementer-workspace-authz
- trigger: implementing or modifying a service RPC that reads or writes workspace-scoped tenant data — it takes a `workspace_id`/slug in the request, or acts on a resource/rule/listing id that belongs to a workspace
- rule: AUTHORIZE the authenticated caller against the resource's OWNING workspace BEFORE any DB read/write. Resolve caller identity from the session token (`resolveRequestMode`/token decode, never the request body); resolve the target workspace **slug→ULID server-side** (`resolveActiveWorkspaceID`); call `s.idClient.CheckAccess{SubjectType=IDENTITY, ResourceType=WORKSPACE}` and read the right flag — `CanView` for reads, `CanEdit` for writes, `CanManage` on the `is_platform_root` workspace (`resolvePlatformWorkspaceID`) for cross-workspace/platform moderation. Deny (PermissionDenied or flag false) → `codes.NotFound` for reads/writes (no existence leak), `codes.PermissionDenied` for platform-moderation. Mirror `bookings_projections.go`. THREE anti-patterns that are NOT authorization: (a) a `workspace_id != ""` presence check; (b) authorizing on a value the client controls — a request-body `workspace_id` OR an HTTP header like `Active-Workspace-Slug` (a header may SELECT which data to act on, never GRANT access), and a check that no-ops when that input is absent is not a check; (c) a list/query RPC that, on an empty/missing workspace scope, falls through to an unscoped all-tenant query — reject empty scope with `codes.InvalidArgument`.
- status: binding
- confidence: high
- classification: SECURITY
- source: L-data-v1-deliver-security-authz (07-19-2026); data/v1 Deliver red-team (both levels BLOCKED, live IDOR); recurrence of reviewer R-reviewer-bola-body-id
- tier: T3
- promoted: 2026-07-19
- last_validated: 2026-07-19
- recurrences_after: 0
- gate: script:libs/scripts/check-workspace-authz.sh
- note: BINDING — ratified by the human (security-review gate) 2026-07-19. Confirmed Critical. Backed by the deterministic gate `check-workspace-authz.sh` (in CI `test-alpha` + Deliver Node-3 pre-gate + `make check-authz`): fails if an enforced tenant RPC loses its CheckAccess. Add any new tenant RPC to the gate's `AUTHZ_ENFORCED`.

### R-go-implementer-dep-go-version-vs-container
- trigger: `go get`-ing or upgrading a dep whose own/transitive `go` directive would raise this module's `go`/`toolchain` in `go.mod`/`go.work` above the container's pinned Go (**1.25.6, `GOTOOLCHAIN=local`**)
- rule: keep the resulting `go` directive in BOTH `go.mod` and `go.work` ≤ the container Go. `go mod tidy` only RAISES it and a passing HOST build won't catch it (host may run newer Go). If a dep forces higher, pin an older compatible release (`go list -m -versions <dep>`; `-f '{{.GoVersion}}'`) instead of bumping. A raised directive breaks air's in-container rebuild (`go.work requires go >= X`) → backend frozen on the stale binary; verify with an IN-CONTAINER `go build`.
- status: provisional
- confidence: high
- classification: DEPENDENCY_ERROR
- source: L-data-v1-deliver-hermes-phase0 (07-23-2026); goose v3.27.3 (+go-mssqldb) forced go 1.25.7 vs container 1.25.6/GOTOOLCHAIN=local → air rebuild broke
- tier: T3
- promoted: 2026-07-23
- last_validated: 2026-07-23
- recurrences_after: 0
- gate: none
- note: Confirmed Critical (build-break); proposed for binding + a `go`-directive-≤-container-Go gate (awaiting ratification).

### R-go-implementer-service-clone-scrub
- trigger: cloning an existing service's scaffold to stand up a new `services/alpha/modules/{new}`
- rule: scrub source-service identifiers before wiring — (a) every `*_GRPC_SERVER_ADDRESS` env tag must name the NEW service (a leftover tag makes two services bind one port → boot conflict; give it its own sequential port); (b) the embedded `Unimplemented{X}ServiceServer`/`Register{X}ServiceServer` must be the new service's generated type (watch typos like `HermessService`); (c) delete canonical-table reads/AutoMigrates it must not own (go through the owning service's RPC); (d) remove dead cloned methods referencing absent struct fields. Prove with an IN-CONTAINER build + boot, not just host.
- status: provisional
- confidence: high
- classification: CONVENTION_VIOLATION
- source: L-data-v1-deliver-hermes-phase0 (07-23-2026); hermes was an unscrubbed reservations clone
- tier: any
- promoted: 2026-07-23
- last_validated: 2026-07-23
- recurrences_after: 0
- gate: none
