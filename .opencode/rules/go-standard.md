> **CANONICAL COPY: [`.claude/rules/go-standard.md`](../../.claude/rules/go-standard.md).** This
> file is the `.opencode` mirror, kept in sync by hand. Edit the `.claude` copy first.

# Go Service Standard — Func Flow & Patterns

**Principles, Patterns & Implementation Guide**

Version 2.2 · August 2026 · Internal Engineering Standard

---

## Contents

**[Part 0: Repository Conventions](#part-0-repository-conventions)**

**[Part I: Principles](#part-i-principles)**

1. [Transport and Domain Separation](#1-transport-and-domain-separation)
2. [Fail Before You Mutate](#2-fail-before-you-mutate)
3. [Permission-Scoped Projection](#3-permission-scoped-projection)
4. [Aggregate Atomicity](#4-aggregate-atomicity)
5. [Observability by Default](#5-observability-by-default)
6. [Idempotency at the Database](#6-idempotency-at-the-database)
7. [Retry Safety](#7-retry-safety)

**[Part II: Patterns Catalog](#part-ii-patterns-catalog)**

1. [Func Flow](#1-func-flow)
2. [Func Flow Phase Reference](#2-func-flow-phase-reference)
3. [Validation Tiers](#3-validation-tiers)
4. [The withTx Pattern](#4-the-withtx-pattern)
5. [Transaction Boundaries](#5-transaction-boundaries)
6. [Conflict Retry Loop](#6-conflict-retry-loop)
7. [Idempotency Key Design](#7-idempotency-key-design)
8. [Internal Function Contracts](#8-internal-function-contracts)
9. [Error Handling](#9-error-handling)
10. [Concurrency Guidance](#10-concurrency-guidance)
11. [Logging Expectations](#11-logging-expectations)
12. [Function Size and Extraction](#12-function-size-and-extraction)

**[Part III: Applicability](#part-iii-applicability)**

---

# Part 0: Repository Conventions

The structural facts about *this* codebase that Parts I–III assume. They are as binding as the
patterns below; a handler that follows Func Flow perfectly but reintroduces a `repo` package
is still wrong.

## 0.1 Service layer owns the database directly

There is **no `repo` package and no `Repository` interface** in new or refactored services. The
service layer uses `gormClient` directly and owns transactions directly:

```go
s.gormClient.WithContext(ctx).Model(&Listing{}).Where(…).Find(&rows)

s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
	svc := s.withTx(tx)
	return svc.executeListingCommand(ctx, cmd)
})
```

Live reference template: `services/alpha/modules/reservations/service/` (**not** the decommissioning
`novella` service). Endorsed query patterns: `docs/db-rules.md`.

## 0.2 Each service owns its domain types

Define entity types **inside the service directory** as `package service` (`models_*.go`, mirroring
the reservations service). Do **not** import domain entity types from `libs/go/postgres/migrations` —
that shared package is legacy and services are migrating off it. When localizing a legacy type, keep
only the fields and methods the service actually uses, and preserve any serialized (e.g. Meilisearch
JSONB) shape.

## 0.3 Schema comes from versioned SQL migrations, not AutoMigrate

Tables, columns, indexes, and constraints are created by **goose SQL migrations** under
`data/migrations/{service}/`, applied by `make {service}-migrate`. **`gorm.AutoMigrate` is frozen
legacy** — it still runs at boot for un-migrated services, but nothing new goes into it, and a
goose-owned model must never be registered in `doAutoMigrations`.

Full rules — migration authoring, the runner's invariants, model/tag discipline, hook discipline,
ID prefixes, and test wiring — live in **`.opencode/rules/data.md`**. Read it before touching a model,
a migration, or `repo_init.go`.

## 0.4 Generated code is generated

Never hand-edit anything under `apis/pb/go/**`. Change the `.proto`, then run `make apis`.

## 0.5 Authorization is not local

Services do not implement their own authorization logic. Permission decisions come from the identity
service / SpiceDB and arrive as a structured permission set (Part I §3, Part II §2.3). Every
workspace-scoped RPC authorizes against the **owning** workspace before any DB operation — enforced
independently of any prompt rule by `libs/scripts/check-workspace-authz.sh` (`make check-authz`, CI,
and the Deliver Node-3 pre-gate). A new tenant-scoped RPC must be added to that script's
`AUTHZ_ENFORCED` list.

## 0.6 Tests exercise the RPC surface

Service tests call the service through its gRPC client using one global fixture per test package
(`init_test.go` / `TestMain`), with shared setup from `libs/go/tests` and service-specific helpers in
the service's own `tests/` directory. Never seed by bypassing an entity's RPC — a non-ULID id is the
tell. Details: `.opencode/agents/go-tester.md`.

---

# Part I: Principles

These principles are the foundation of the standard. They change rarely. The patterns in Part II are implementations of these principles and will evolve as the system grows.

---

## 1. Transport and Domain Separation

Every service boundary creates two distinct worlds: the transport layer (gRPC, HTTP, message bus) and the domain layer (business logic, aggregates, events). These worlds must not bleed into each other.

**Protobuf messages are transport artifacts.** They must be converted into domain models at the boundary of every handler. Once inside the function body, business logic operates exclusively on internal types. Protobuf types re-appear only at the very end, when constructing the response.

This separation means internal functions never accept or return proto messages. It means RPCs are never called internally on the same service, because RPCs carry middleware (auth checks, rate limiting, tracing context creation) that will double-execute or behave unexpectedly when invoked from within the service itself. Internal orchestration uses internal methods directly.

> **Exception:** `global.Query` proto types may continue to be used internally because they are transient query descriptors that are never persisted.

---

## 2. Fail Before You Mutate

All validation must complete before any mutation, downstream call, or expensive computation begins. If a request is going to fail, it should fail cheaply. This principle reduces partial-failure states, wasted compute, and complexity in rollback logic.

Validation is not monolithic, however. Pure input validation (field presence, format, range) is distinct from permission resolution (identity service calls) and contextual validation (existence checks) that require I/O. All three must complete before writes, but they have different dependencies, testing characteristics, and outputs. See Part II for the validation tiers and the authenticate phase.

---

## 3. Permission-Scoped Projection

Every RPC call is made by a caller with a specific identity, and that identity determines both whether the call is allowed and what data is returned. Permissions are not a binary gate; they shape the response.

When a caller requests an aggregate (e.g., a reservation), the service does not return the full aggregate unconditionally. It queries the identity service for the caller's permissions, then constructs a projection of the aggregate that includes only the sub-resources the caller is authorized to view. A participant may see the reservation's dates and their own component, while an admin sees the full graph including payment shares, drifts, and events.

This means permissions are not an afterthought bolted onto the query or respond phase. They are a distinct phase of execution that runs after validation, produces a resolved permission set, and that permission set flows into both the query phase (to scope what data is loaded) and the respond phase (to scope what data is returned). The identity service is the single source of truth for permissions; services must not implement their own authorization logic.

---

## 4. Aggregate Atomicity

An aggregate and all of its owned entities must be created, updated, or deleted as a single atomic operation. Partial creation of sub-resources is never acceptable. If any part of the aggregate write fails, the entire operation rolls back.

For the reservation system, the Reservation is the aggregate root. It owns components, edges, snapshots, participants, drifts, events, the request, and payment shares. All of these are created or modified within a single transaction boundary.

---

## 5. Observability by Default

Every major function creates a span. Every span carries meaningful attributes and IDs. Errors are recorded. This is not optional instrumentation that teams add later; it is part of the function structure itself.

Over-instrumentation is a real cost. Tiny helpers, pure utility functions, and simple getters should not create spans. Spans are warranted when a function performs database operations, external service calls, expensive computations, or represents a major workflow boundary.

---

## 6. Idempotency at the Database

PostgreSQL is the source of truth for idempotency. Unique constraints and transactional conflict handling are the mechanism. Redis, in-memory caches, and application-level deduplication are not sufficient for write-path idempotency because they cannot guarantee consistency under failure.

---

## 7. Retry Safety

Transactional conflicts (serialization failures, deadlocks, optimistic version conflicts) are expected in a concurrent system. The architecture must support retry loops at the transaction level. Operations must be designed so that retrying a failed transaction is safe and produces the correct outcome.

---

# Part II: Patterns Catalog

These patterns implement the principles from Part I. They are expected to evolve as the system matures. When updating a pattern, verify it still aligns with the underlying principle.

---

## 1. Func Flow

**Func Flow** is the name of this codebase's function-body structure. Every RPC handler and every
major service-layer function moves through the same seven phases, in the same order:

```
instrument → validate → authenticate → idempotency → query → command → respond
```

Use labeled comments only for the phases the function actually uses; do not paste empty phase
markers.

| Phase | Purpose | Allowed Operations |
|---|---|---|
| **instrument** | Initialize telemetry, create the span, attach structured logging context and correlation IDs. | Span creation, attribute attachment, metric counters. |
| **validate** | Pure input validation — field presence, format, ranges, enum membership, mode compatibility — and conversion of proto into the domain command struct. | Deterministic checks and type conversion only. No I/O. |
| **authenticate** | Resolve the caller's permission set by calling the identity service. Reject unauthorized calls. The permission set flows into query and respond. | Identity service reads. No mutations. |
| **idempotency** | Check whether this request was already made, keyed on the idempotency key **and** the request body. | Idempotency-table reads. No mutations. Same key + different body → `AlreadyExists`. |
| **query** | Retrieve everything the command needs. Contextual validation (existence) happens here. Scope reads with the resolved permission set. | DB reads, downstream RPC reads, cache reads. |
| **command** | Perform all mutations: create/update/delete aggregates, emit events, grant permissions. | DB writes, event creation, transactional operations. |
| **respond** | Convert domain models to the transport response. Build a projection scoped to the caller's permissions. Attach metadata, map errors to transport codes. | Proto construction, projection filtering, header attachment, error mapping. |

### 1.1 Why this order — load-progressive execution

The order is not alphabetical or historical. **Each step is cheaper than the one after it**, so a
request that is going to fail does the least possible work before failing:

```
in-memory checks → one identity read → one idempotency read → domain reads → writes → serialization
     (µs)              (one RPC)          (one indexed read)     (I/O)      (txn)       (CPU)
```

A malformed request never reaches the identity service. An unauthorized caller never reaches the
database. A duplicate request never reaches the transaction. This is the *Fail Before You Mutate*
principle (Part I §2) expressed as a function body — and it is the reason phases may be **skipped**
but never **reordered**.

### 1.2 The step contract — every phase is an encapsulated step

A phase is not a block of inline code with a comment above it. **Each phase is its own method, and
every step method has the same shape:**

```go
func (s *ServiceImpl) <step>(ctx context.Context, cmd <x>Command) (<x>Command, error)
```

Context in, command in — command out, error out. Nothing else. That uniformity is what makes the
handler body readable at a glance: it becomes a list of steps that thread one value through,
and a reader can follow the whole request without opening a single step.

```go
func (s *ServiceImpl) CreateListings(ctx context.Context, req *rsvSvr.CreateListingsRequest) (*rsvSvr.CreateListingsResponse, error) {
	// ── instrument ──
	ctx, span := s.tracer.StartWithInfo(ctx)
	defer span.End()

	// ── validate ──
	cmd, err := s.validateCreateListings(ctx, req)
	if err != nil {
		return nil, err
	}

	// ── authenticate ──
	cmd, err = s.authenticateCreateListings(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// ── idempotency ──
	cmd, err = s.resolveCreateListingsIdempotency(ctx, cmd)
	if err != nil {
		return nil, err
	}
	if cmd.Replay != nil {
		return cmd.Replay, nil
	}

	// ── query ──
	cmd, err = s.resolveCreateListingsRefs(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// ── command ──
	cmd, err = s.executeCreateListings(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// ── respond ──
	return s.buildCreateListingsResponse(ctx, cmd), nil
}
```

The two boundary steps are the documented exceptions to the uniform signature, because they are
where transport meets domain:

- **validate** takes the proto request and returns the first command: `(ctx, *pb.XRequest) (xCommand, error)`.
- **respond** takes the final command and returns the proto response: `(ctx, xCommand) *pb.XResponse`.

Every step in between is `(ctx, cmd) (cmd, error)`.

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

// BAD — constructs a fresh command and silently drops every upstream field.
func (s *ServiceImpl) authenticateCreateListings(ctx context.Context, cmd createListingsCommand) (createListingsCommand, error) {
	permSet, err := s.resolvePermissions(ctx, cmd.CallerID, cmd.WorkspaceID)
	if err != nil {
		return createListingsCommand{}, err
	}
	return createListingsCommand{ // ← IdempotencyKey, Listings, WorkspaceID: all gone
		CallerID:      cmd.CallerID,
		PermissionSet: permSet,
	}, nil
}
```

The `BAD` shape compiles, passes a happy-path test that only asserts the fields the step happens to
copy, and loses data silently. Never build a command literal inside a step — mutate the received
copy and return it. Only `validate` constructs a command from nothing.

On the error path, return the command you were given (`return cmd, err`), not a zero value. The
caller must not read a command when `err != nil`, but returning `cmd` keeps the signature honest and
keeps a partially-populated command available to error logging.

#### Pass the command by value, not by pointer

**Steps take and return `xCommand`, never `*xCommand`.** This is deliberate on two grounds:

*Memory.* A command passed by value lives in the caller's stack frame. Take its address and hand
that to a method the compiler cannot prove is non-escaping, and Go's escape analysis moves the whole
struct to the heap — one allocation and one GC object per request, on the hottest path in the
service. Value semantics keep stack data on the stack.

*Correctness.* Each step gets its own copy, so a step physically cannot reach back and mutate the
caller's command. Data flows one way, through the return value, and it is visible in the handler
body. With a `*xCommand`, a step can mutate state the handler never assigned, and the handler stops
being a readable table of contents.

Keep the command cheap to copy so the default stays right:

- ✓ Scalars, small fixed-size fields, and IDs go directly in the struct.
- ✓ Bulk payloads go in as slices/maps — the header copies in a few words and the backing array is
  already shared; you do not need a pointer to avoid copying a slice.
- ✓ Shared infrastructure (`*gorm.DB`, clients, loggers) is reached through `s`, not carried in the
  command.
- ✗ Do not embed large fixed-size arrays or deeply nested value structs; that is what makes copying
  expensive, and the fix is to restructure the command, not to pointerize it.

**When the heap is the right answer** — use a pointer deliberately, and say why in a comment:

- The command genuinely carries a large payload copied at every step and profiling shows the copies
  matter. Measure first; do not assume.
- The value must be shared across goroutines (e.g. an `errgroup` fan-out in the query phase) or must
  outlive the request scope.
- A field is naturally a pointer already (a loaded aggregate, a nil-able optional). Pointer *fields*
  inside a value command are fine and normal — it is the command itself that is passed by value.

### 1.3 Func Flow is not only for RPC handlers

Any function that performs one or more of the phases follows the same progression — an internal
method that makes a network or DB call, or does heavy computation, orders its body light-to-heavy in
exactly this way. The labels are conceptual; a three-phase internal function is still Func Flow, and
its steps follow the same `(ctx, cmd) (cmd, error)` contract when it has more than one.

```go
// generateInspirations follows Func Flow: instrument → query → command → respond.
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

Functions genuinely exempt from Func Flow are listed in Part III: tiny helpers, pure mapping
functions, and small deterministic functions with no I/O.

---

## 2. Func Flow Phase Reference

### 2.1 instrument

Instrumentation is the first thing that happens inside a function. Create a span, defer its close, and attach any IDs available at entry time.

```go
ctx, span := s.tracer.StartWithInfo(ctx)
defer span.End()
```

- ✓ Attach meaningful attributes and IDs when available.
- ✓ Record important errors on the span.
- ✗ Create spans in tiny helpers that have no I/O.
- ✗ Create deeply nested spans for trivial operations.

### 2.2 validate

Pure input validation. This phase is deterministic: given the same input, it always produces the same result. No database calls, no network calls, no side effects.

```go
if req.GetExperienceId() == "" {
    return nil, status.Error(
        codes.InvalidArgument, "experience_id required")
}
```

Validation functions should return structured internal models whenever possible, converting transport types into validated domain inputs in a single step:

```go
params, err := validateCreateReservationInput(req)
```

### 2.3 authenticate

The authenticate phase resolves the caller's identity and authorization. This always involves a call to the identity service's permissions RPCs. The output is a resolved permission set: a structured representation of what the caller is allowed to do and what aggregate sub-resources they are allowed to see.

```go
permSet, err := s.identityClient.ResolvePermissions(ctx, &identity.ResolvePermissionsRequest{
    CallerID:     callerID,
    ResourceType: "reservation",
    ResourceID:   params.ReservationID,
})
if err != nil {
    return nil, fmt.Errorf("resolving permissions: %w", err)
}

if !permSet.Can(PermissionViewReservation) {
    return nil, ErrForbidden("caller lacks permission to view this reservation")
}
```

The permission set is not discarded after the access check. It flows forward into the query and respond phases:

- **Query phase:** The permission set may scope which sub-resources are loaded. If the caller can only see their own component, there is no need to load the full aggregate graph.
- **Respond phase:** The permission set determines the projection. The respond phase filters the aggregate to include only the sub-resources the caller is authorized to view.

```go
// Permission set flows through the remaining phases
cmd.PermissionSet = permSet
```

- ✓ Always call the identity service; never implement local authorization logic.
- ✓ Produce a structured permission set, not a bare boolean.
- ✓ Reject unauthorized calls immediately with a domain error.
- ✓ Pass the permission set forward to query and respond.
- ✗ Perform mutations.
- ✗ Load domain data (that belongs in query).
- ✗ Cache permission results across requests without explicit TTL and invalidation strategy.

> **Why a dedicated phase?** Authorization is not a contextual validation check like "does this entity exist." It is an external service call that produces a structured result used by multiple downstream phases. Burying it in the query phase obscures the authorization boundary, makes it unclear when the access decision happens, and leads to inconsistent projection logic across handlers.

### 2.4 idempotency

If the request carries an idempotency key, resolve it **before** any domain read or write. This phase is read-only: it looks up the stored record for `(service, key)` and decides one of three outcomes.

```go
cmd, err := s.resolveIdempotency(ctx, cmd)
if err != nil {
    return nil, err
}
if cmd.CachedResponse != nil {
    return cmd.CachedResponse, nil // replay — indistinguishable from the first call
}
```

| Stored state | Outcome |
|---|---|
| No record | Proceed. Reserve the key as `IN_PROGRESS` so a concurrent retry cannot double-execute. |
| `COMPLETED`, **same** request-body hash | Return the stored response. A duplicate must be indistinguishable from a successful first attempt. |
| `COMPLETED`, **different** request-body hash | `AlreadyExists` — the key was reused for a different request. |
| `IN_PROGRESS` | `FailedPrecondition` — the original call is still running. |

- ✓ Hash the request body and compare it; a key alone is not enough to prove sameness.
- ✓ Let PostgreSQL's unique constraint be the enforcement mechanism (Part I §6) — this phase is the
  fast path, not the guarantee.
- ✗ Perform any mutation other than reserving the key.
- ✗ Deduplicate in Redis or in process memory.

Key design — client-generated vs server-derived, scoping, retention — is in §7.

### 2.5 query

Retrieve everything the command phase will need. This is also where contextual validation lives: checking that referenced entities exist, resolving identities. These operations require I/O and are not deterministic, so they do not belong in the validate phase. Use the resolved permission set from the authenticate phase to scope queries where applicable — for example, loading only the components the caller is authorized to view rather than the full aggregate.

**Reads that must be transactionally consistent with a subsequent write belong inside the command transaction, not here.** The query phase handles reads that inform whether to proceed. Reads that must see the exact state being mutated (e.g., checking a row's version before updating it) must happen inside the same transaction as the write. Splitting them introduces TOCTOU race conditions.

### 2.6 command

All writes happen here. Mutations occur inside transaction boundaries. Aggregate consistency is enforced. Events are emitted. Retries and conflict handling are managed at this level.

```go
err := s.db.Transaction(func(tx *gorm.DB) error {
    svc := s.withTx(tx)
    return svc.executeReservationCommand(ctx, cmd)
})
```

> **Critical Rule:** Internal functions must never call RPC handlers on the same service. RPCs are transport boundaries that carry middleware (auth, rate limiting, context creation). Calling them internally causes double execution of that middleware. Use internal service methods directly.

```go
// BAD: calls RPC handler internally
s.InitializeReservation(...)

// GOOD: calls internal method
s.initializeReservationGraph(...)
```

### 2.7 respond

Convert domain models back into transport types. Attach cookies, tokens, headers, pagination metadata. Map domain errors to gRPC status codes. This is the only place proto construction should happen after the validate phase.

**Build the response projection using the permission set from the authenticate phase.** The caller receives only the aggregate sub-resources they are authorized to view. For example, a `GetReservation` response for a participant might include the reservation dates and their own component, while omitting payment shares, other participants' components, and internal drifts.

```go
// Build projection scoped to caller's permissions
resp := buildReservationResponse(reservation, permSet)
```

- ✗ Perform mutations.
- ✗ Execute expensive queries.
- ✗ Perform orchestration.

---

## 3. Validation Tiers

Validation is split into two distinct tiers based on whether the check requires I/O.

| Tier | Location | Characteristics | Examples |
|---|---|---|---|
| **Tier 1: Pure Input** | validate phase | Deterministic, no I/O, fully testable with unit tests, sub-millisecond. | Required fields, format checks, enum ranges, mode compatibility, request shape. |
| **Tier 2: Contextual** | query phase | Requires I/O, needs mocks/fixtures in tests, has latency, can fail with infrastructure errors. | Entity existence, token decoding, session validation, uniqueness. |

> **Note:** Permission checks are not a validation tier. They are a dedicated phase (`permissions`) that produces a structured permission set used downstream. See [Phase Reference 2.3](#23-permissions).

This separation keeps the validate phase fast and testable. Contextual checks that fail still fail before any mutation, preserving the Fail Before You Mutate principle, but they live alongside other query-phase reads rather than in a hybrid validation step.

---

## 4. The withTx Pattern

Service implementations support transaction propagation by cloning the service with a transaction-scoped database handle.

```go
func (s *ServiceImpl) withTx(tx *gorm.DB) *ServiceImpl {
    clone := *s
    clone.db = tx
    return &clone
}
```

> **Shallow Copy Warning:** This pattern performs a shallow copy of the service struct. If `ServiceImpl` holds mutable state beyond `db` (caches, counters, connection handles), the clone silently shares those references. Either treat `ServiceImpl` as effectively immutable outside of `db`, or extract a smaller `txScope` struct that carries only transactional dependencies.

---

## 5. Transaction Boundaries

Transactions wrap orchestration-level command execution. They should be as wide as the aggregate operation requires and as narrow as possible otherwise.

- ✓ Wrap the full aggregate command in a single transaction.
- ✓ Include transactionally-consistent reads inside the transaction when needed.
- ✗ Create per-row micro-transactions.
- ✗ Start nested independent transactions.
- ✗ Manually manage `Begin()`/`Commit()` when the ORM provides transaction callbacks.

---

## 6. Conflict Retry Loop

Retryable transactional conflicts (serialization failures, deadlocks, optimistic version mismatches) are handled with a bounded retry loop around the transaction.

```go
for attempt := 0; attempt < maxRetries; attempt++ {
    err := s.db.Transaction(func(tx *gorm.DB) error {
        svc := s.withTx(tx)
        return svc.executeCommand(ctx, cmd)
    })

    if !isRetryable(err) {
        return err
    }

    backoff(attempt)
}
```

- ✓ Use exponential or jittered backoff between retries.
- ✓ Log each retry attempt with the attempt number and error.
- ✓ Set a reasonable `maxRetries` (typically 3–5).
- ✗ Retry non-transactional errors (validation failures, not-found, permission denied).

---

## 7. Idempotency Key Design

PostgreSQL unique constraints are the enforcement mechanism, but the design of the idempotency key itself requires deliberate decisions per endpoint.

| Decision | Guidance |
|---|---|
| **Key source** | Client-generated (UUID in request header) for user-facing creation endpoints. Server-derived (hash of natural key) for internal or event-driven operations. |
| **Key scope** | Scope keys to the narrowest meaningful boundary: per-user, per-workspace, or per-entity. Global keys are rarely appropriate. |
| **TTL / retention** | Idempotency records should be retained long enough to cover the retry window (typically 24–48 hours for user-facing APIs). Implement a cleanup job for expired records. |
| **Duplicate response behavior** | On a duplicate request, return the original result (not a conflict error) whenever possible. The caller should be unable to distinguish a duplicate from a successful first attempt. |

---

## 8. Internal Function Contracts

Internal functions operate exclusively in the domain layer. They accept and return domain types, never proto messages.

```go
// BAD: leaks transport types into domain
func (s *ServiceImpl) initializeReservation(
    ctx context.Context,
    req *rsvSvr.InitializeReservationRequest,
) error

// GOOD: uses domain types
func (s *ServiceImpl) initializeReservationGraph(
    ctx context.Context,
    reservation *Reservation,
    params ReservationParams,
) error
```

> **Steps vs. helpers.** This section governs *helpers* — functions a step calls to do one job, which
> take the narrow domain input they need. A **step** (a Func Flow phase method) is different: it
> always takes and returns the command, `(ctx, cmd) (cmd, error)` (§1.2). If you are extracting a
> phase, write a step. If you are extracting work *inside* a phase, write a helper.

---

## 9. Error Handling

Domain functions return domain errors. The respond phase maps them to transport codes. This requires a canonical error type that carries enough information for the mapping.

### Canonical Domain Error

```go
type DomainError struct {
    Code    ErrorCode   // e.g., ErrNotFound, ErrConflict, ErrForbidden
    Message string      // human-readable description
    Cause   error       // underlying error (for wrapping)
}
```

### Transport Mapping

The respond phase (or a shared middleware) maps domain error codes to gRPC status codes:

| Domain Code | gRPC Status | When to Use |
|---|---|---|
| `ErrInvalidInput` | `InvalidArgument` | Tier 1 validation failures. |
| `ErrNotFound` | `NotFound` | Entity does not exist (Tier 2). |
| `ErrConflict` | `AlreadyExists` | Idempotency conflict, duplicate creation. |
| `ErrForbidden` | `PermissionDenied` | Authorization failure (authenticate phase). |
| `ErrPreconditionFailed` | `FailedPrecondition` | Business invariant violation. |
| `ErrInternal` | `Internal` | Unexpected system failure. |

- ✓ Wrap errors with context at each layer: `fmt.Errorf("loading experience: %w", err)`.
- ✓ Use sentinel error codes, not string matching, for control flow.
- ✗ Return raw gRPC status errors from domain functions.
- ✗ Swallow errors silently.

---

## 10. Concurrency Guidance

The query phase frequently involves multiple independent reads (experience, workspace, identity, permissions). The default approach is sequential execution. Parallelize with `errgroup` only when profiling demonstrates that the sequential latency is a bottleneck.

```go
// Parallel query pattern (use only when justified)
g, ctx := errgroup.WithContext(ctx)

var experience *Experience
g.Go(func() error {
    var err error
    experience, err = s.loadExperience(ctx, cmd.ExperienceID)
    return err
})

var workspace *Workspace
g.Go(func() error {
    var err error
    workspace, err = s.loadWorkspace(ctx, cmd.WorkspaceID)
    return err
})

if err := g.Wait(); err != nil {
    return err
}
```

- ✓ Default to sequential reads for simplicity and debuggability.
- ✓ Parallelize when latency measurements justify it.
- ✗ Parallelize by default "because it's faster." Premature parallelism adds complexity without measured benefit.

---

## 11. Logging Expectations

Structured logging complements tracing. Each phase has different logging expectations.

| Phase | What to Log | Level |
|---|---|---|
| **instrument** | Entry with correlation IDs, request type. | Info |
| **validate** | Validation failures with specific field names. | Warn |
| **permissions** | Permission denials with caller ID and required permission. Do not log the full permission set. | Warn |
| **query** | Entity-not-found results. Do not log full query results. | Warn / Debug |
| **command** | Mutation outcomes: created entity IDs, affected row counts. | Info |
| **respond** | Final status code. Do not log full response payloads. | Info |

- ✓ Use structured fields (key-value pairs), not interpolated message strings.
- ✓ Include entity IDs, operation names, and durations.
- ✗ Log full request or response payloads (PII risk, log volume).
- ✗ Log at Info level inside tight loops or per-row operations.

## 11.1 Tracing Expectations

- Expnsive and transactional methods (e.g. methods that do database reads and writes, api calls, computation, etc) **MUST** implement tracing using the service tracer. 
```go
func (s *ServiceImpl) generateInspiration(ctx) ([]*Insipiration, error) {
	// instrument
	// query 
	// command: apply generation strategy
	// command: save to db
	// response: inspirations
}
```
---

## 12. Function Size and Extraction

RPC handlers should remain orchestration-oriented. They coordinate the Func Flow phases but delegate complex logic to extracted functions.

When a function exceeds reasonable complexity, extract along phase boundaries: query functions that load and assemble data, command functions that perform atomic aggregate operations, and workflow functions that coordinate multi-step processes.

- ✓ Extract workflow functions for multi-step orchestration.
- ✓ Extract query functions when loading logic involves joins or assembly.
- ✓ Extract aggregate command functions when mutation logic is non-trivial.
- ✗ Inline all business logic in the RPC handler.
- ✗ Extract so aggressively that the handler becomes unreadable indirection.

### 12.1 RPC Handler as Thin Orchestrator

Every RPC handler must be a thin orchestrator. The handler's body must read as a table of contents — each phase body is extracted into a named private method with a descriptive name. A handler exceeding ~40 lines that is not delegating to extracted methods is a code smell.

**Canonical pattern — `CreateSourceUpload` (hermes service, `create_source_upload.go`).** This is a
live handler, not an idealized sketch; read it when you need a worked reference.

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

Key traits:
- Handler is ~35 lines; every phase is a single method call.
- Every step is `(ctx, cmd) (cmd, error)` (§1.2) — one value threads the whole flow, and `cmd` is
  reassigned, never shadowed into a new variable per phase.
- Steps take and return the command **by value**; `cmd.Replay`, `cmd.AuthzChecks`, and the results
  are fields the earlier steps added, still present at respond.
- Internal steps speak **domain types only** — no proto after validate, none before respond.
- Phase comments act as section headers; the handler reads as a table of contents.

> **Shared helpers are the one narrowing exception.** `authorizeWorkspaceAccessBulk` is a
> cross-RPC authorization helper, so it takes the narrow input it needs (`cmd.AuthzChecks`) rather
> than the whole command. Helpers reused across handlers may narrow; **steps written for one
> handler take the command.** Do not use this to justify a per-RPC step with a bespoke signature.

**Signature-widening anti-pattern.** When steps return bespoke values instead of the command, every
downstream step has to accept them all, and the signatures grow monotonically:

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

Adding a phase to the `BAD` shape means editing every signature after it. In the `GOOD` shape it
means adding one field to the command and one line to the handler.

**Anti-pattern — `CreatePaymentIntent` (finance service):**

```go
// CreatePaymentIntent creates one or more payment intents for an invoice.
func (s *ServiceImpl) CreatePaymentIntent(ctx context.Context, req *finSvc.CreatePaymentIntentRequest) (*finSvc.CreatePaymentIntentResponse, error) {
	// --- instrument ---
	ctx, span := s.tracer.StartWithInfo(ctx)
	defer span.End()

	// --- authenticate ---
	tokenData, err := s.tokenManager.DecodeTokenV2(ctx)
	if err != nil {
		s.logger.Err(err).Msg("CreatePaymentIntent: auth failed")
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}
	if !tokenData.Authenticated {
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}

	// --- validate ---
	invoice := req.GetInvoice()
	if invoice == nil {
		return nil, status.Error(codes.InvalidArgument, "invoice is required")
	}
	// ... 20 more lines of inline validation ...

	// --- validate (continued): quote validation ---
	var lineItemSum int64
	for _, li := range invoice.GetLineItems() {
		lineItemSum += li.GetAmountDue()
	}
	if lineItemSum != invoice.GetTotal() {
		return nil, status.Error(codes.InvalidArgument, "line item sum does not match invoice total")
	}

	// --- authenticate (TODO) ---

	// --- setup: inline variable extraction (there is no `setup` phase — this belongs in validate) ---
	invoiceID := invoice.GetId()
	total := invoice.GetTotal()
	paymentShares := invoice.GetPaymentShares()

	// --- query: idempotency check (inline, mixed with command) ---
	var idemRecID string
	if key := req.GetIdempotencyKey(); key != "" {
		existing, err := s.paymentsMod.GetIdempotencyRecord(ctx, s.serviceName, key)
		if err == nil {
			switch existing.Status {
			case "COMPLETED":
				reqHash := hashRequest(req)
				if existing.RequestHash == reqHash {
					var cachedResp finSvc.CreatePaymentIntentResponse
					if err := protojson.Unmarshal(existing.Response, &cachedResp); err != nil {
						return nil, status.Error(codes.Internal, "failed to unmarshal cached response")
					}
					return &cachedResp, nil
				}
				return nil, status.Error(codes.AlreadyExists, "idempotency key conflict")
			case "IN_PROGRESS":
				return nil, status.Error(codes.FailedPrecondition, "request already in progress")
			}
		}
		// ... 15 more lines of inline idempotency record creation ...
	}

	// --- command (inline, mixed with respond) ---
	var paymentIntents []*finance.PaymentIntent
	if len(paymentShares) == 0 {
		pi, err := s.paymentsMod.CreateIntent(ctx, invoiceID, total, "usd", req.GetIdempotencyKey())
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to create payment intent")
		}
		paymentIntents = append(paymentIntents, pi)
	} else {
		for _, share := range paymentShares {
			pi, err := s.paymentsMod.CreateIntent(ctx, invoiceID, share.GetAmount(), "usd", req.GetIdempotencyKey())
			if err != nil {
				return nil, status.Error(codes.Internal, "failed to create payment intent")
			}
			paymentIntents = append(paymentIntents, pi)
		}
	}

	// --- respond (inline) ---
	response := &finSvc.CreatePaymentIntentResponse{
		PaymentIntents: paymentIntents,
	}

	if idemRecID != "" {
		respBytes, marshalErr := protojson.Marshal(response)
		if marshalErr == nil {
			_ = s.paymentsMod.UpdateIdempotencyRecordStatus(ctx, idemRecID, "COMPLETED", respBytes)
		}
	}

	return response, nil
}
```

Problems:
- Handler is ~130 lines — every phase body is inline
- Authentication is inline instead of extracted as `s.authenticateCaller(ctx)`
- Validation is inline instead of `s.validateCreatePaymentIntentRequest(req)`
- Idempotency logic is inline, mixing query-phase reads with command-phase mutations and respond-phase side effects
- No domain command types — proto types (`*finSvc.CreatePaymentIntentRequest`) and raw proto fields flow through the entire function
- Response construction is inline, interleaved with idempotency record updates

### 12.2 The Command Type

**One command type per handler**, carrying every phase's contribution. It is the single value that
threads the flow (§1.2), so it is defined once and grows a field per phase — not a family of
per-phase output structs.

Group the fields by the phase that populates them, in flow order, and say so in comments. A reader
should be able to tell at a glance which phase owns a field, and a step author should be able to tell
which fields are already populated by the time their step runs.

```go
// createReservationsCommand threads the whole CreateReservations flow. Each step
// receives it by value, adds its own fields, and returns it (§1.2). Fields are
// grouped by the phase that populates them.
type createReservationsCommand struct {
	// -- validate -- (proto → domain; populated before any I/O)
	Requests       []reservationRequestCommand
	Mode           resolvedMode
	BatchJourneyID string
	IdempotencyKey string

	// -- authenticate --
	CallerID      string
	PermissionSet permissionSet

	// -- idempotency --
	Replay       bool
	ReplayResults []reservationResult

	// -- query --
	PrimaryIdentityIDByRequest map[string]string
	AdditionalIdentityIDs      map[string][]string
	Journey                    *journeyResolution

	// -- command --
	Results []reservationResult
	Cookies []*identity.ClientCookie
}
```

Protocol for the command type:

- **One per handler, named for the handler** — `createReservationsCommand`, not `validatePhaseOutput`.
  Service-local commands are **unexported**; they never leave the service package.
- **Cheap to copy** (§1.2): scalars and IDs inline, bulk payloads as slices/maps, shared
  infrastructure reached through `s` and never carried in the command.
- **A step mutates its copy and returns it.** Never construct a command literal inside a step; only
  `validate` builds one from nothing.
- **Never hold proto types.** Convert at the validate boundary, convert back only in respond.
  `global.Query` is the documented exception (Part I §1).
- **Define it beside the handler** — the command, its steps, and its sub-types live in the same file
  as the RPC they serve (e.g. `create_source_upload.go`), so the whole flow reads top to bottom.

Genuinely reusable value objects (a `permissionSet`, a shared result row) still get their own named
types — they are *fields on* the command, not replacements for it.

---

# Part III: Applicability

## Mandatory Scope

This standard is mandatory for all new development in the reservation system and applies to the following function types:

- gRPC handlers
- Aggregate command handlers
- Orchestration functions
- Major query functions
- Workflow functions
- Transactional operations

## Exempt Scope

The following function types are exempt from Func Flow. They should still follow general Go best practices but do not require labeled phases:

- Tiny helper functions
- Pure utility functions
- Pure mapping/conversion functions
- Simple getters and setters
- Small deterministic functions with no I/O

## Using This Document

Part I (Principles) is the foundation. Use it for architectural decisions, design reviews, and onboarding. The principles should rarely change.

Part II (Patterns Catalog) is the implementation reference. Use it for PR reviews, code generation, and as a checklist when writing new handlers. These patterns will evolve; when updating them, verify alignment with the underlying principles.

When a pattern and a principle conflict, the principle wins. When the document is silent on a specific case, reason from the principles.
