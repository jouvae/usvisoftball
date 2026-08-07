---
description: The Go service standard for the Jouvae backend — repository conventions plus Func Flow (the seven-phase function-body structure), the step contract, transactions, errors, and observability. Loads when editing backend service or shared-library Go files.
paths:
  - "services/**/*.go"
  - "libs/go/**/*.go"
---

# Go Service Standard — Func Flow & Patterns

Version 2.3 · August 2026 · Internal Engineering Standard

**Part 0** is the structural facts about this codebase. **Part I** is the principles (they rarely
change). **Part II** is the enforceable patterns. **Part III** says what is exempt. When a pattern
and a principle conflict, the principle wins; when this file is silent, reason from the principles.

---

# Part 0: Repository Conventions

As binding as anything below. A handler that follows Func Flow perfectly but reintroduces a `repo`
package is still wrong.

**0.1 The service layer owns the database directly.** No `repo` package, no `Repository` interface.
The service uses `gormClient` directly and owns transactions directly:

```go
s.gormClient.WithContext(ctx).Model(&Listing{}).Where(…).Find(&rows)

s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
	svc := s.withTx(tx)
	return svc.executeListingCommand(ctx, cmd)
})
```

Live template: `services/alpha/modules/reservations/service/` (**not** the decommissioning
`novella`). Query patterns: `docs/db-rules.md`.

**0.2 Each service owns its domain types.** Define them in the service dir as `package service`
(`models_*.go`). Do **not** import entity types from `libs/go/postgres/migrations` — that package is
legacy. When localizing a legacy type, keep only the fields the service uses and preserve any
serialized (e.g. Meilisearch JSONB) shape.

**0.3 Schema comes from goose migrations, not AutoMigrate.** Tables, columns, indexes, and
constraints are created by versioned SQL under `data/migrations/{service}/`, applied by
`make {service}-migrate`. `gorm.AutoMigrate` is **frozen legacy**; nothing new goes into it and a
goose-owned model is never registered in `doAutoMigrations`. Full rules — migration authoring, model
tags, hook discipline, ID prefixes, test wiring — in **`.claude/rules/data.md`**.

**0.4 Generated code is generated.** Never hand-edit `apis/pb/go/**`. Change the `.proto`, run
`make apis`. Contract rules — enum cross-references, `main.zed`, gateway routes, toolchain pinning,
service scaffolding — in **`.claude/rules/contracts.md`**.

**0.5 Authorization is not local.** Permission decisions come from the identity service / SpiceDB as
a structured permission set (Part I §3, Part II §2.3). Every workspace-scoped RPC authorizes against
the **owning** workspace before any DB operation, enforced independently by
`libs/scripts/check-workspace-authz.sh` (`make check-authz`, CI, Deliver Node-3). Add every new
tenant RPC to its `AUTHZ_ENFORCED` list. Full rules in **`.claude/rules/security.md`**.

**0.6 Tests exercise the RPC surface.** One global fixture per test package, gRPC-client-only, shared
setup in `libs/go/tests`, service-specific helpers in the service's own `tests/`. Never seed by
bypassing an entity's RPC — a non-ULID id is the tell. Full rules in **`.claude/rules/testing.md`**.

---

# Part I: Principles

1. **Transport and domain separation.** Protobuf messages are transport artifacts, converted to
   domain models at every handler boundary and reappearing only when building the response. Internal
   functions never accept or return proto. RPCs are never called internally on the same service —
   they carry middleware (auth, rate limiting, tracing) that would double-execute.
   *Exception:* `global.Query` may be used internally; it is a transient descriptor, never persisted.

2. **Fail before you mutate.** All validation completes before any mutation, downstream call, or
   expensive computation. If a request will fail, it should fail cheaply. Validation is not
   monolithic — pure input checks, authorization, and contextual existence checks have different
   dependencies and live in different phases, but all precede writes.

3. **Permission-scoped projection.** Permissions are not a binary gate; they shape the response. The
   caller's resolved permission set scopes both what is **loaded** and what is **returned**. A
   participant sees the reservation dates and their own component; an admin sees the full graph.

4. **Aggregate atomicity.** An aggregate and its owned entities are created, updated, or deleted as
   one atomic operation. Partial creation of sub-resources is never acceptable.

5. **Observability by default.** Every function doing I/O, a downstream call, heavy computation, or
   a workflow boundary creates a span with meaningful attributes, and records errors. Tiny helpers,
   pure utilities, and simple getters do not — over-instrumentation is a real cost.

6. **Idempotency at the database.** PostgreSQL is the source of truth: unique constraints and
   transactional conflict handling. Redis, in-memory caches, and application-level dedup are **not**
   sufficient for write-path idempotency — they cannot guarantee consistency under failure.

7. **Retry safety.** Transactional conflicts are expected in a concurrent system. Operations must be
   designed so retrying a failed transaction is safe and produces the correct outcome.

---

# Part II: Patterns Catalog

## 1. Func Flow

**Func Flow** is this codebase's function-body structure. Every RPC handler and every major
service-layer function moves through the same seven phases, in the same order:

```
instrument → validate → authenticate → idempotency → query → command → respond
```

Label only the phases the function actually uses; do not paste empty markers.

| Phase | Purpose | Allowed |
|---|---|---|
| **instrument** | Telemetry: span, structured logging context, correlation IDs. | Span creation, attributes, metric counters. |
| **validate** | Pure input validation — presence, format, ranges, enum membership — **and** conversion of proto into the domain command. | Deterministic checks and type conversion. **No I/O.** |
| **authenticate** | Resolve the caller's permission set from the identity service. Reject unauthorized calls. | Identity reads. No mutations. |
| **idempotency** | Has this request already been made? Keyed on the idempotency key **and** the request-body hash. | Idempotency-table reads; reserving the key. |
| **query** | Load everything the command needs. Contextual validation (existence) lives here. Scope reads with the permission set. | DB reads, downstream RPC reads, cache reads. |
| **command** | All mutations: aggregates, events, permission grants — inside a transaction. | DB writes, event creation. |
| **respond** | Domain → transport. Build the permission-scoped projection, attach metadata, map errors to codes. | Proto construction, projection filtering, error mapping. |

### 1.1 Why this order — load-progressive execution

Each phase is cheaper than the one after it, so a request that will fail does the least possible
work before failing:

```
in-memory checks → one identity read → one idempotency read → domain reads → writes → serialization
     (µs)              (one RPC)          (one indexed read)      (I/O)      (txn)       (CPU)
```

A malformed request never reaches the identity service. An unauthorized caller never reaches the
database. A duplicate never reaches the transaction. This is *Fail Before You Mutate* expressed as a
function body, and it is why phases may be **skipped** but never **reordered**.

### 1.2 The step contract — every phase is an encapsulated step

A phase is not a block of inline code under a comment. **Each phase is its own method, and every
step method has the same shape:**

```go
func (s *ServiceImpl) <step>(ctx context.Context, cmd <x>Command) (<x>Command, error)
```

Context in, command in — command out, error out. Nothing else. That uniformity is what makes the
handler readable at a glance: it becomes a list of steps threading one value, followable without
opening a single step.

Two documented exceptions, both where transport meets domain:

- **validate** takes the proto request and returns the first command: `(ctx, *pb.XRequest) (xCommand, error)`.
- **respond** takes the final command and returns the proto response: `(ctx, xCommand) *pb.XResponse`.

A **shared helper reused across handlers** may narrow to the input it needs. A step written for one
handler takes the command.

#### The command accumulates — it never resets

**A step returns the command it received, plus whatever it added or changed.** The command grows as
it moves down the flow; it never shrinks.

```go
// GOOD — carry the input forward, then add.
func (s *ServiceImpl) authenticateCreateListings(ctx context.Context, cmd createListingsCommand) (createListingsCommand, error) {
	permSet, err := s.resolvePermissions(ctx, cmd.CallerID, cmd.WorkspaceID)
	if err != nil {
		return cmd, fmt.Errorf("resolving permissions: %w", err)
	}
	cmd.PermissionSet = permSet // everything validate set is still here
	return cmd, nil
}

// BAD — a fresh literal silently drops every upstream field.
	return createListingsCommand{ // ← IdempotencyKey, Listings, WorkspaceID: all gone
		CallerID:      cmd.CallerID,
		PermissionSet: permSet,
	}, nil
```

The `BAD` shape compiles, passes a happy-path test that only asserts the fields it happens to copy,
and loses data silently. **Never build a command literal inside a step** — mutate the received copy
and return it. Only `validate` constructs a command from nothing.

On the error path return the command you were given (`return cmd, err`), not a zero value. The caller
must not read a command when `err != nil`, but returning it keeps the signature honest and keeps a
partially-populated command available for error logging.

#### Pass the command by value, not by pointer

**Steps take and return `xCommand`, never `*xCommand`**, on two independent grounds:

- **Memory.** A value command lives in the caller's stack frame. Take its address and hand it to a
  method the compiler cannot prove non-escaping, and escape analysis moves the whole struct to the
  heap — one allocation and one GC object per request, on the hottest path in the service.
- **Correctness.** Each step gets its own copy, so a step physically cannot reach back and mutate
  the caller's command. Data flows one way, through the return value, visible in the handler body.

Keep the command cheap to copy so the default stays right:

- ✓ Scalars, small fixed-size fields, and IDs go directly in the struct.
- ✓ Bulk payloads go in as slices/maps — the header copies in a few words and the backing array is
  already shared. You do not need a pointer to avoid copying a slice.
- ✓ Shared infrastructure (`*gorm.DB`, clients, loggers) is reached through `s`, never carried in
  the command.
- ✗ Do not embed large fixed-size arrays or deeply nested value structs. That is what makes copying
  expensive, and the fix is to restructure the command, not to pointerize it.

**When the heap is right** — use a pointer deliberately and say why in a comment: a large payload
where profiling shows the copies matter (measure first); a value shared across goroutines or
outliving the request; a field that is naturally a pointer. Pointer *fields* inside a value command
are fine and normal — it is the command itself that is passed by value.

### 1.3 Func Flow is not only for RPC handlers

Any function performing one or more of the phases follows the same progression — an internal method
that makes a network or DB call, or does heavy computation, orders its body light-to-heavy the same
way. A three-phase internal function is still Func Flow, and its steps follow the same
`(ctx, cmd) (cmd, error)` contract when it has more than one.

```go
// generateInspirations follows Func Flow: instrument → query → command.
func (s *ServiceImpl) generateInspirations(ctx context.Context, cmd generateCommand) (generateCommand, error) {
	// ── instrument ──
	ctx, span := s.tracer.StartWithInfo(ctx)
	defer span.End()

	// ── query ── load the source material
	cmd, err := s.loadGenerationSources(ctx, cmd)
	if err != nil {
		return cmd, err
	}

	// ── command ── apply the generation strategy, persist
	return s.persistGeneratedInspirations(ctx, cmd)
}
```

Exempt functions are listed in Part III.

---

## 2. Phase Reference

Only the non-obvious per-phase detail. The phase table in §1 is the definition.

### 2.1 instrument

```go
ctx, span := s.tracer.StartWithInfo(ctx)
defer span.End()
```

First thing in the function. ✓ Attach meaningful attributes and IDs; record important errors on the
span. ✗ No spans in tiny helpers with no I/O; no deeply nested spans for trivial operations.

### 2.2 validate

Deterministic: same input, same result, always. No database calls, no network calls, no side effects.
Prefer a validator that returns the built command in one step rather than scattered field checks:

```go
cmd, err := s.validateCreateReservationsRequest(req)
```

### 2.3 authenticate

Calls the identity service and produces a **resolved permission set** — a structured representation
of what the caller may do and which sub-resources they may see. The set is not discarded after the
access check; it flows forward:

- **query** — scope which sub-resources are loaded. If the caller can only see their own component,
  do not load the full aggregate graph.
- **respond** — determine the projection (§2.7).

✓ Always call the identity service; never implement local authorization logic. ✓ Produce a
structured set, not a bare boolean. ✓ Reject unauthorized calls immediately with a domain error.
✗ No mutations. ✗ No domain data loading (that is query). ✗ No caching permission results across
requests without an explicit TTL and invalidation strategy.

> **Why a dedicated phase?** Authorization is not a contextual check like "does this entity exist."
> It is an external call producing a structured result used by multiple downstream phases. Burying
> it in query obscures the authorization boundary and leads to inconsistent projection logic.

Enforcement detail — which flag, which error code, and the three non-authorizations —
`.claude/rules/security.md` §S1.

### 2.4 idempotency

If the request carries an idempotency key, resolve it **before** any domain read or write.

| Stored state | Outcome |
|---|---|
| No record | Proceed. Reserve the key as `IN_PROGRESS` so a concurrent retry cannot double-execute. |
| `COMPLETED`, **same** body hash | Return the stored response. A duplicate must be indistinguishable from a successful first attempt. |
| `COMPLETED`, **different** body hash | `AlreadyExists` — the key was reused for a different request. |
| `IN_PROGRESS` | `FailedPrecondition` — the original call is still running. |

✓ Hash the request body and compare it; a key alone does not prove sameness. ✓ Let the Postgres
unique constraint be the enforcement (Part I §6) — this phase is the fast path, not the guarantee.
✗ No mutation other than reserving the key. ✗ Never dedup in Redis or process memory. Key design: §7.

### 2.5 query

Loads everything the command needs, and is where contextual validation lives (existence checks,
identity resolution) — I/O-bound and non-deterministic, so not the validate phase. Scope reads with
the permission set where applicable.

**Reads that must be transactionally consistent with a subsequent write belong inside the command
transaction, not here.** Query handles reads that inform *whether to proceed*. A read that must see
the exact state being mutated (checking a row's version before updating it) must happen inside the
same transaction as the write. Splitting them is a TOCTOU race.

### 2.6 command

All writes, inside transaction boundaries, with aggregate consistency enforced and events emitted.

```go
err := s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
	svc := s.withTx(tx)
	return svc.executeReservationCommand(ctx, cmd)
})
```

> **Critical rule:** internal functions must never call RPC handlers on the same service. RPCs carry
> middleware (auth, rate limiting, context creation) that will double-execute.
> `s.InitializeReservation(...)` ✗ — `s.initializeReservationGraph(...)` ✓.

### 2.7 respond

Domain → transport. The only place proto construction happens after validate. Attach cookies,
tokens, headers, pagination metadata; map domain errors to gRPC codes (§9).

**Build the projection using the permission set from authenticate.** A `GetReservation` response for
a participant includes the dates and their own component while omitting payment shares, other
participants' components, and internal drifts.

✗ No mutations, no expensive queries, no orchestration.

---

## 3. Validation Tiers

| Tier | Phase | Characteristics | Examples |
|---|---|---|---|
| **1: Pure input** | validate | Deterministic, no I/O, unit-testable, sub-millisecond. | Required fields, format, enum ranges, mode compatibility, request shape. |
| **2: Contextual** | query | Requires I/O, needs fixtures, has latency, can fail on infrastructure. | Entity existence, token decoding, session validation, uniqueness. |

Authorization is **not** a validation tier — it is the `authenticate` phase (§2.3), because it
produces a structured result consumed downstream. Tier-2 checks still fail before any mutation,
preserving *Fail Before You Mutate*; they simply live alongside other query-phase reads.

---

## 4. The withTx Pattern

Transaction propagation by cloning the service with a transaction-scoped handle:

```go
func (s *ServiceImpl) withTx(tx *gorm.DB) *ServiceImpl {
	clone := *s
	clone.gormClient = tx
	return &clone
}
```

> **Shallow copy warning.** If `ServiceImpl` holds mutable state beyond `gormClient` (caches,
> counters, connection handles), the clone silently shares those references. Either treat
> `ServiceImpl` as effectively immutable outside `gormClient`, or extract a smaller `txScope` struct
> carrying only transactional dependencies.

---

## 5. Transaction Boundaries

As wide as the aggregate operation requires, as narrow as possible otherwise.

✓ Wrap the full aggregate command in a single transaction. ✓ Include transactionally-consistent
reads inside it when needed. ✗ No per-row micro-transactions. ✗ No nested independent transactions.
✗ Do not hand-manage `Begin()`/`Commit()` when the ORM provides transaction callbacks.

---

## 6. Conflict Retry Loop

Retryable conflicts (serialization failures, deadlocks, optimistic version mismatches) get a bounded
retry loop around the transaction:

```go
for attempt := 0; attempt < maxRetries; attempt++ {
	err := s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.withTx(tx).executeCommand(ctx, cmd)
	})
	if !isRetryable(err) {
		return err
	}
	backoff(attempt)
}
```

✓ Exponential or jittered backoff. ✓ Log each attempt with its number and error. ✓ `maxRetries` 3–5.
✗ Never retry non-transactional errors (validation, not-found, permission denied).

---

## 7. Idempotency Key Design

| Decision | Guidance |
|---|---|
| **Key source** | Client-generated (UUID in a request header) for user-facing creation endpoints. Server-derived (hash of a natural key) for internal or event-driven operations. |
| **Key scope** | The narrowest meaningful boundary — per-user, per-workspace, per-entity. Global keys are rarely appropriate. |
| **Retention** | Long enough to cover the retry window (typically 24–48h for user-facing APIs). Implement a cleanup job. |
| **Duplicate behavior** | Return the original result, not a conflict error, whenever possible. The caller should not be able to tell a duplicate from a successful first attempt. |

---

## 8. Internal Function Contracts

Internal functions operate exclusively in the domain layer — domain types in, domain types out,
never proto messages.

```go
// BAD: leaks transport into the domain
func (s *ServiceImpl) initializeReservation(ctx context.Context, req *rsvSvr.InitializeReservationRequest) error

// GOOD: domain types
func (s *ServiceImpl) initializeReservationGraph(ctx context.Context, reservation *Reservation, params ReservationParams) error
```

> **Steps vs. helpers.** This section governs *helpers* — functions a step calls to do one job,
> taking the narrow domain input they need. A **step** (a Func Flow phase method) always takes and
> returns the command (§1.2). Extracting a phase → write a step. Extracting work *inside* a phase →
> write a helper.

---

## 9. Error Handling

Domain functions return domain errors; the respond phase maps them to transport codes.

```go
type DomainError struct {
	Code    ErrorCode // ErrNotFound, ErrConflict, ErrForbidden, …
	Message string
	Cause   error
}
```

| Domain code | gRPC status | When |
|---|---|---|
| `ErrInvalidInput` | `InvalidArgument` | Tier-1 validation failure. |
| `ErrNotFound` | `NotFound` | Entity does not exist (Tier 2), **and** every authorization denial on a read or write — no existence leak (`security.md` §S1). |
| `ErrConflict` | `AlreadyExists` | Idempotency conflict, duplicate creation. |
| `ErrForbidden` | `PermissionDenied` | Authenticate-phase failure on platform moderation. |
| `ErrPreconditionFailed` | `FailedPrecondition` | Business invariant violation; in-flight idempotent request. |
| `ErrInternal` | `Internal` | Unexpected system failure. |

✓ Wrap with context at each layer: `fmt.Errorf("loading experience: %w", err)`. ✓ Use sentinel error
codes, not string matching, for control flow. ✗ Never return raw gRPC status errors from domain
functions. ✗ Never swallow an error silently.

---

## 10. Concurrency Guidance

The query phase often makes several independent reads. **Default to sequential** for simplicity and
debuggability; parallelize with `errgroup` only when profiling shows the sequential latency is a
bottleneck. Premature parallelism adds complexity without measured benefit.

```go
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error { var err error; experience, err = s.loadExperience(ctx, cmd.ExperienceID); return err })
g.Go(func() error { var err error; workspace, err = s.loadWorkspace(ctx, cmd.WorkspaceID); return err })
if err := g.Wait(); err != nil {
	return cmd, err
}
```

> The BFF has the opposite default: independent forwards there run concurrently because the latency
> is user-visible and measured (`.claude/rules/frontend.md` §F2).

---

## 11. Logging & Tracing

| Phase | What to log | Level |
|---|---|---|
| **instrument** | Entry with correlation IDs, request type. | Info |
| **validate** | Validation failures with specific field names. | Warn |
| **authenticate** | Permission denials with caller ID and required permission. **Never** the full permission set. | Warn |
| **idempotency** | Replay hits and key conflicts, with the key. | Info / Warn |
| **query** | Entity-not-found. **Never** full query results. | Warn / Debug |
| **command** | Mutation outcomes: created entity IDs, affected row counts. | Info |
| **respond** | Final status code. **Never** full response payloads. | Info |

✓ Structured fields (key-value), not interpolated message strings. ✓ Include entity IDs, operation
names, durations. ✗ Never log full request/response payloads (PII, volume). ✗ Never log at Info
inside tight loops or per-row operations.

**No wrapper/helper logging functions.** The logger records caller file:line and function; a shared
log helper collapses every call site to the helper's own line. Log inline.

**Tracing is mandatory** on any method doing DB reads/writes, API calls, or heavy computation — use
the service tracer, per Part I §5 and the example in §1.3.

---

## 12. Function Size and Extraction

Handlers coordinate the Func Flow phases and delegate complex logic. Extract along phase boundaries:
query functions that load and assemble, command functions that perform atomic aggregate operations,
workflow functions that coordinate multi-step processes.

✗ Do not inline all business logic in the handler. ✗ Do not extract so aggressively that the handler
becomes unreadable indirection.

### 12.1 RPC Handler as Thin Orchestrator

The handler body reads as a table of contents. **A handler past ~40 lines that is not delegating to
extracted steps is a code smell.**

**Canonical pattern — `CreateSourceUpload`** (hermes, `create_source_upload.go`). A live handler, not
an idealized sketch:

```go
func (s *ServiceImpl) CreateSourceUpload(ctx context.Context, req *hmsSvr.CreateSourceUploadRequest) (*hmsSvr.CreateSourceUploadResponse, error) {
	// -- instrument --
	ctx, span := s.tracer.StartWithInfo(ctx)
	defer span.End()

	// -- validate --
	cmd, err := s.validateCreateSourceUpload(req)
	if err != nil {
		return nil, err
	}

	// -- authenticate -- (per-workspace IDOR gate on EACH item's target workspace)
	if _, err := s.authorizeWorkspaceAccessBulk(ctx, cmd.AuthzChecks); err != nil {
		return nil, err
	}

	// -- idempotency -- (dedupe the batch on the client key; replay ⇒ return early)
	cmd, err = s.resolveCreateSourceUploadIdempotency(ctx, cmd)
	if err != nil {
		return nil, err
	}
	if cmd.Replay {
		cmd, err = s.buildReplayResults(ctx, cmd)
		if err != nil {
			return nil, err
		}
		return s.buildCreateSourceUploadResponse(cmd), nil
	}

	// -- command -- (land one source_document + running run per item, then enqueue parse)
	cmd, err = s.executeCreateSourceUpload(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// -- respond --
	return s.buildCreateSourceUploadResponse(cmd), nil
}
```

Key traits: ~35 lines; every phase a single method call; every step `(ctx, cmd) (cmd, error)` with
`cmd` **reassigned**, never shadowed per phase; command passed by value, carrying each step's
additions through to respond; domain types only between validate and respond; phase comments as
section headers.

> `authorizeWorkspaceAccessBulk` narrows to `cmd.AuthzChecks` because it is a **cross-RPC helper**.
> Helpers reused across handlers may narrow; steps written for one handler take the command. Do not
> use this to justify a bespoke per-RPC step signature.

**Anti-pattern: signature widening.** When steps return bespoke values, every downstream step must
accept them all and signatures grow monotonically:

```go
// BAD — each step adds a parameter; by respond there are five.
ident,   err := s.resolveIdentities(ctx, cmd)
journey, err := s.resolveJourney(ctx, cmd, ident)
results, err := s.executeReservationCreation(ctx, cmd, ident, journey)
return s.buildCreateReservationsResponse(ctx, cmd, ident, journey, results), nil

// GOOD — the command absorbs each result; signatures stay fixed.
cmd, err = s.resolveIdentities(ctx, cmd)
cmd, err = s.resolveJourney(ctx, cmd)
cmd, err = s.executeReservationCreation(ctx, cmd)
return s.buildCreateReservationsResponse(ctx, cmd), nil
```

Adding a phase to `BAD` means editing every signature after it; in `GOOD` it is one field and one
line.

**Anti-pattern: the inline handler.** `CreatePaymentIntent` (finance) is the worked counter-example
in the codebase — ~130 lines with every phase body inline. Its specific failures, each of which this
section forbids:

- Authentication inline instead of an extracted step.
- ~25 lines of inline validation instead of `s.validateCreatePaymentIntentRequest(req)`.
- Idempotency inline, **mixing query-phase reads, command-phase mutations, and respond-phase side
  effects in one block** — the phase boundaries are gone.
- No domain command type: `*finSvc.CreatePaymentIntentRequest` and raw proto fields flow through the
  entire function, violating Part I §1.
- Response construction inline, interleaved with idempotency record updates.

### 12.2 The Command Type

**One command type per handler**, carrying every phase's contribution — not a family of per-phase
output structs. Group fields by the phase that populates them, in flow order, and label them, so a
step author can see at a glance what is already populated when their step runs.

```go
// createReservationsCommand threads the whole CreateReservations flow. Each step
// receives it by value, adds its own fields, and returns it (§1.2).
type createReservationsCommand struct {
	// -- validate -- (proto → domain; populated before any I/O)
	Requests       []reservationRequestCommand
	Mode           resolvedMode
	IdempotencyKey string

	// -- authenticate --
	CallerID      string
	PermissionSet permissionSet

	// -- idempotency --
	Replay        bool
	ReplayResults []reservationResult

	// -- query --
	PrimaryIdentityIDByRequest map[string]string
	Journey                    *journeyResolution

	// -- command --
	Results []reservationResult
	Cookies []*identity.ClientCookie
}
```

- **One per handler, named for the handler** — `createReservationsCommand`, not
  `validatePhaseOutput`. Service-local commands are **unexported**; they never leave the package.
- **Cheap to copy** (§1.2): scalars and IDs inline, bulk payloads as slices/maps, infrastructure
  reached through `s`.
- **A step mutates its copy and returns it.** Only `validate` builds one from nothing.
- **Never holds proto types.** Convert at validate, convert back only in respond. `global.Query` is
  the documented exception.
- **Defined beside the handler** — command, steps, and sub-types in the same file as the RPC they
  serve, so the whole flow reads top to bottom.

Genuinely reusable value objects (a `permissionSet`, a shared result row) still get their own named
types — they are *fields on* the command, not replacements for it.

---

# Part III: Applicability

**Mandatory** for all new development: gRPC handlers, aggregate command handlers, orchestration
functions, major query functions, workflow functions, and transactional operations.

**Exempt** from Func Flow (still subject to general Go practice and Part 0): tiny helpers, pure
utility functions, pure mapping/conversion functions, simple getters and setters, and small
deterministic functions with no I/O.
