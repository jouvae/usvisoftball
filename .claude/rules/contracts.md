---
description: Ratified contract and scaffolding rules — enum/field cross-references, the authoritative SpiceDB schema, retired domains, Dorothy gateway routes, toolchain pinning, and standing up a new service. Loads when editing protos, the authz schema, the gateway, or module manifests.
paths:
  - "apis/protos/**"
  - "configs/spicedb/**"
  - "services/alpha/modules/dorothy/**"
  - "go.mod"
  - "go.work"
---

# Contracts & scaffolding

Rules governing the shared surfaces — protobuf, the authorization schema, the HTTP gateway, and the
toolchain. A contract change that lands in only one of its consumers is the single most recurrent
critical class in this codebase's history; §C1 exists because of it.

---

## C1. An enum value or response field reaches EVERY consumer, in the same change

**Applies to:** adding a value to an enum, or a field to a response message.

Before you finish, grep the enum's consumers and update all of them **in the same change**:

- Go `map`/`switch` statements and transition tables that require every enum value
- TypeScript `Record<>`-typed maps and union types
- `FromProto` / `ToProto` conversion functions
- API-route flattening in the BFF (`.claude/rules/frontend.md` §F4)
- Any exhaustiveness-checked consumer that will silently take a default branch

A `Record<Enum, T>` that is missing the new key, or a `switch` that falls through, compiles cleanly
and fails at runtime on the one input that matters. **Missing cross-references were the top
recurring critical class** across the create-reservations feature.

Proto field numbers: new tags go **above the current maximum**. Never renumber, never reuse a
retired tag. Regenerate with `make apis` — never hand-edit `apis/pb/go/**`.

---

## C2. `main.zed` is the authoritative authorization schema

**Applies to:** touching any reservation, booking, section, or calendar relation, or the
`RelationName` enum.

`configs/spicedb/main.zed` is authoritative. Update **together, in one change**:

1. `configs/spicedb/main.zed`
2. the `RelationName` enum
3. `relationNameToString`

then run the identity test suite. **Proto enums bend to the schema, never the reverse.**

> **Migration hazard.** Removing a definition from `main.zed` while relationships referencing it
> still exist crashes SpiceDB on write. Drain or migrate the relationships first.

---

## C3. Never reintroduce a retired domain or subject type

**Applies to:** defining or referencing a SpiceDB definition or subject type.

- **Retired object types:** `experience_domain`, `identity_domain`, `vault_domain` — replaced by
  the `workspace_*_section` types (`workspace_listings_section` for listings/resources/rules/menus,
  `reservations_section` for bookings/journeys/reservations).
- **Retired subject:** `guest` — now `identity` (`idn_…`).
- Do **not** expand the `experience` / `experience_provider` surface without a confirmed domain
  decision (ADR-6, experiences → listings).

A stale enum-to-object-type mapping here produced a 400 on every contacts request and took a live
debugging session to find. The object type on the wire must match the definition name in
`main.zed` exactly.

---

## C4. The Dorothy gateway is Fiber routes, not proto annotations

**Applies to:** exposing a gRPC RPC over HTTP as a new `/api/v1/...` endpoint.

Dorothy is a **Fiber app mapping HTTP paths → `handle*` methods**. It does **not** use grpc-gateway
`google.api.http` proto annotations, and **no proto edit or `make apis` is needed** to add a route.

1. Write a `handle*` method in the matching `services/alpha/modules/dorothy/service/http_*.go`.
   Copy `handleGetListings`: span → `utils.DecodeFiberRequest` → RPC via the injected client
   (`s.rsvClient` / `s.vaultClient` / …) → `s.sendHttpOkJSON`.
2. Register it in `init_http.go`: `r.app.Post("/api/v1/...", r.handleX)`.

**Grep `init_http.go` first** — the handler may already exist under a different path (e.g.
`AttachResourceFile` at `/api/v1/vault/resources/attach`). Do not create a duplicate.

Every new RPC the frontend calls needs its Dorothy route; an RPC with no route is unreachable from
the browser.

---

## C5. Keep the `go` directive at or below the container's Go

**Applies to:** `go get`-ing or upgrading any dependency.

The dev container pins **Go 1.25.6 with `GOTOOLCHAIN=local`**. The resulting `go` directive in
**both `go.mod` and `go.work`** must stay **≤ the container Go**.

- `go mod tidy` only ever **raises** the directive.
- **A passing host build will not catch this** — the host may run a newer Go. Verify with an
  **in-container** `go build`.
- If a dependency forces a higher directive, **pin an older compatible release** instead of
  bumping: `go list -m -versions <dep>`, and `go list -m -f '{{.GoVersion}}' <dep>` to read what it
  demands.

A raised directive breaks air's in-container rebuild (`go.work requires go >= X`) and freezes the
backend on the stale binary while the host build stays green — a build-break that masquerades as
"my change didn't take effect". This is exactly how goose v3.27.3 (via transitive `go-mssqldb`)
forced 1.25.7 and froze the backend.

---

## C6. Scrub a cloned service scaffold before wiring it

**Applies to:** standing up `services/alpha/modules/{new}` from an existing service's scaffold.

Cloning is fine; shipping the source service's identifiers is not. Before wiring:

- **Env tags** — every `*_GRPC_SERVER_ADDRESS` tag must name the **new** service. A leftover tag
  makes two services bind one port → boot conflict. Give the new service its own sequential port
  (ports run sequentially from 50001; **50055 is SpiceDB and off-limits**).
- **Generated types** — the embedded `Unimplemented{X}ServiceServer` and `Register{X}ServiceServer`
  must be the new service's generated types. Watch for typos (`HermessService`).
- **Canonical reads** — delete table reads and AutoMigrates the new service must not own. Go
  through the owning service's RPC instead.
- **Dead methods** — remove cloned methods referencing struct fields the new service doesn't have.

**Prove it with an in-container build and boot**, not just a host build.

---

## C7. Entity definitions are the source of truth for domain shape

Before changing any entity-related contract — a proto message, a domain/migration type, or service
logic touching an entity (contact, identity, workspace, listing, …) — **read that entity's
canonical definition from the Supabase `entities` registry** (scoped slice via the `3d-artifacts`
skill; `docs/entities.md` is a pointer, not the record).

Do not invent fields or semantics: a proto or domain field with no backing canonical definition is
**unratified** and must be flagged for human ratification, never treated as settled. New or changed
entities are written back as `status='proposed'`; promotion to `canonical`/`superseded` requires
explicit human ratification.

> Skipping this produced an off-model `contact.role` field and contacts on a claimable workspace —
> a Contact carries no role, and is created only when an identity *interacts with* a workspace.
