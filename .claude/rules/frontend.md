---
description: Ratified frontend and BFF rules for clients/web — error-code preservation, concurrent forwards, mock/contract parity, route↔type parity, and flow-step props. Loads when editing the web client.
paths:
  - "clients/web/**/*.ts"
  - "clients/web/**/*.tsx"
---

# Frontend & BFF rules

Ratified from defects that reached a running app. Design-system and component conventions live in
`DESIGN.md`; these are the behavioral rules. Security rules that touch the frontend (the
anti-enumeration UI invariant) are in `.claude/rules/security.md` §S2 and win where they overlap.

---

## F1. A BFF route preserves the structured error contract

**Applies to:** any route under `clients/web/src/app/api/**/route.ts` whose caller branches on a
structured response-body field on failure — `error_code`, `success`, or anything beyond
`error`/`message`.

On the catch/error path, **forward `error.response.data` and the upstream status verbatim** when
`error.response` exists. Fall back to a normalizing helper (`handleApiError`) **only** for true
transport errors, where there is no `.response`.

```ts
catch (error) {
  if (isAxiosError(error) && error.response) {
    // structured upstream failure — forward it intact
    return NextResponse.json(error.response.data, { status: error.response.status })
  }
  return handleApiError(error) // transport failure only
}
```

Never route a structured-contract response through a helper that reduces the body to `{ error }`.
It silently strips `error_code`/`success`, and the frontend collapses to a default — a rate-limit
lockout and an invalid credential become indistinguishable, and the lockout UI becomes unreachable.

**Deliberate exception:** anti-enumeration routes return a generic body on purpose
(`security.md` §S2).

---

## F2. Independent BFF forwards run concurrently

**Applies to:** a single BFF route handler making two or more **independent** backend forwards —
neither depends on the other's result (e.g. `GetListings` + `GetRules` to reconstruct a view).

Run them with `Promise.all`, not serial `await`s. A read's wall-clock is `max(calls)`, not their
sum; a serial pair silently ~doubles latency and can breach a p95 budget. Measured: serial
`GetListings` → `GetRules` put the index route at 500–559 ms versus 448 ms for the parallel route
doing identical work.

When one call is a **resilient enrichment** whose failure must not fail the read, give it its own
`.catch(() => fallback)` *inside* the `Promise.all` rather than wrapping everything in one
try/catch.

```ts
const [listings, rules] = await Promise.all([
  fetchListings(ctx),
  fetchRules(ctx).catch(() => []), // best-effort enrichment
])
```

---

## F3. A mock is never more permissive than the real contract

**Applies to:** a mock BFF route or client standing in for a backend RPC that will be wired later
(the Design-prototype → Deliver cutover), and to the cutover itself.

**Identifier ownership is part of the contract.** If the real RPC issues or owns an identifier —
`ImportListings` issues the `batch_id`; a create RPC returns the ULID — then:

- The client sends the **empty/absent** value on the first call and **adopts the server-returned
  id** for subsequent calls.
- The mock **rejects a client-invented id exactly as the real RPC does.**

A mock that accepts arbitrary client-supplied ids (a module-level `Map` keyed on whatever the
client sends) hides a client bug that only surfaces at cutover, when the real RPC 404s the invented
id. That is precisely what happened to `use-uploader.ts`.

**On mock → real cutover, re-read the real proto and handler** for who owns each identifier and
lifecycle field. Never assume the mock's shape was contract-faithful.

---

## F4. A response type change reaches the route that produces it

**Applies to:** a TS response type gaining a field (e.g. `payment_intents`).

Update the API route that produces the response to extract or flatten the new field from the
upstream service, in the same change. **A type contract without the route change is an
implementation gap**, not a partial implementation — the type compiles and the field is always
undefined at runtime.

This is the frontend half of the enum/field cross-reference rule
(`.claude/rules/contracts.md` §C1): a new enum value or response field must reach *every*
consumer — transition maps, route flattening, TS types, and `FromProto`/`ToProto`.

---

## F5. Flow step components take `flowData` through props

**Applies to:** a step component in a multi-step flow.

Destructure and render `flowData` / `updateFlowData` from props, so that data preservation across
steps is **observable and testable** rather than implicit in a context or module singleton. A step
that reaches for shared state directly cannot be asserted on in isolation.
