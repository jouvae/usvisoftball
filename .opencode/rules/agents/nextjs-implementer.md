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
