# nextjs-implementer — learned rules

Loaded by `.opencode/agents/nextjs-implementer.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-nextjs-implementer-flowdata-props
- trigger: implementing a multi-step flow step component
- rule: destructure and render `flowData`/`updateFlowData` from props so data preservation across steps is observable and testable
- status: provisional
- confidence: medium
- source: 05-29-2026-create-reservations (WARN-FE-12, WARN-FE-15)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-nextjs-implementer-api-route-type-parity
- trigger: a TS response type gains a field (e.g. `payment_intents`)
- rule: update the API route that produces the response to extract/flatten the new field from the upstream service; a type contract without the route change is an implementation gap
- status: binding
- confidence: high
- source: 05-29-2026-create-reservations (CRIT-FE-15)
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-nextjs-implementer-anti-enumeration
- trigger: implementing the signup form (or any auth form that submits an email) success/error handling
- rule: render an identical affordance and next-step whether or not the email is already registered — no inline "account already exists" error, error styling, or differing navigation; the registered-vs-new distinction must never reach the browser (it is delivered to the inbox)
- status: provisional
- confidence: high
- source: L-identity-refine-01; audit M3; identities-web-001 (amended); docs/features/identity/refine/anti-enumeration.md
- tier: T3
- promoted: 2026-06-26
- last_validated: 2026-06-26
- recurrences_after: 0
- gate: none
- note: SECURITY rule — `binding` promotion requires the security-review gate.

### R-nextjs-implementer-bff-preserve-error-code
- trigger: authoring/editing a BFF route under `clients/web/src/app/api/**/route.ts` whose frontend caller branches on a structured response-body field on failure (`error_code`, `success`, or any field beyond `error`/`message`)
- rule: on the catch/error path, forward the upstream `error.response.data` + status verbatim when `error.response` exists; only fall back to a normalizing helper (`handleApiError`) for true transport errors (no `.response`). Never route a structured-contract response through a helper that reduces the body to `{ error }` — it silently strips `error_code`/`success` and the FE collapses to a default (e.g. rate-limit vs invalid becomes indistinguishable). Anti-enumeration routes that intentionally return a generic body are the deliberate exception.
- status: provisional
- confidence: medium
- source: L-identity-refine-03; refine-web-002 (H7); docs/features/identity/refine/changelog.md (2026-06-27)
- tier: T3
- promoted: 2026-06-27
- last_validated: 2026-06-27
- recurrences_after: 0
- gate: none

### R-nextjs-implementer-mock-mirrors-real-contract
- trigger: a mock BFF route (or client) stands in for a real backend RPC that will be wired later (a prototype→deliver mock→real cutover), OR replacing such a mock with the real forward
- rule: a mock must NOT be more permissive than the real RPC's contract — if the real RPC issues/owns an identifier (e.g. `ImportListings` issues the `batch_id`; a create RPC returns the ULID), the client must send the empty/absent value on first call and ADOPT the server-returned id for subsequent calls, and the mock must reject a client-invented id the same way the real RPC does. A mock that accepts arbitrary client-supplied ids (module-Map keyed on whatever the client sends) hides a client bug that only surfaces at the real cutover (the real RPC 404s the invented id). On mock→real cutover, re-read the real proto/handler for who owns each identifier and lifecycle field, and never assume the mock's shape was contract-faithful.
- status: provisional
- confidence: medium
- classification: IMPLEMENTATION_GAP
- source: L-data-v1-deliver-security-authz (07-19-2026); data/v1 Increment-D upload cutover (`use-uploader.ts` invented batch_id → real ImportListings 404)
- tier: any
- promoted: 2026-07-19
- last_validated: 2026-07-19
- recurrences_after: 0
- gate: none

### R-nextjs-implementer-parallelize-bff-forwards
- trigger: a single BFF route handler (`clients/web/src/app/api/**/route.ts`) makes two or more INDEPENDENT backend forwards (e.g. `GetListings` + `GetRules` to reconstruct a view), neither depending on the other's result
- rule: run independent forwards CONCURRENTLY with `Promise.all` (or `allSettled` when one is best-effort), not serial `await`s — the read's wall-clock is `max(calls)`, not their sum. A serial pair silently ~doubles latency and can breach a p95 budget (data/v1: serial GetListings→GetRules put the index route at 500–559 ms vs the parallel review route's 448 ms for identical work). When one call is a resilient enrichment (its failure must not fail the read), give it its own `.catch(() => fallback)` inside the `Promise.all` rather than wrapping the whole thing in one try/catch.
- status: provisional
- confidence: medium
- classification: IMPLEMENTATION_GAP
- source: L-data-v1-deliver-security-authz (07-19-2026); data/v1 load gate (get-BFF serialization defect)
- tier: any
- promoted: 2026-07-19
- last_validated: 2026-07-19
- recurrences_after: 0
- gate: none
