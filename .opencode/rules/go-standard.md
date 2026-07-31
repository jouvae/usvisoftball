# Service Function Structure Standard

**Principles, Patterns & Implementation Guide**

Version 2.1 · May 2026 · Internal Engineering Standard

---

## Contents

**[Part I: Principles](#part-i-principles)**

1. [Transport and Domain Separation](#1-transport-and-domain-separation)
2. [Fail Before You Mutate](#2-fail-before-you-mutate)
3. [Permission-Scoped Projection](#3-permission-scoped-projection)
4. [Aggregate Atomicity](#4-aggregate-atomicity)
5. [Observability by Default](#5-observability-by-default)
6. [Idempotency at the Database](#6-idempotency-at-the-database)
7. [Retry Safety](#7-retry-safety)

**[Part II: Patterns Catalog](#part-ii-patterns-catalog)**

1. [Function Phase Structure](#1-function-phase-structure)
2. [Phase Reference](#2-phase-reference)
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

Validation is not monolithic, however. Pure input validation (field presence, format, range) is distinct from permission resolution (identity service calls) and contextual validation (existence checks) that require I/O. All three must complete before writes, but they have different dependencies, testing characteristics, and outputs. See Part II for the validation tiers and the permissions phase.

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

## 1. Function Phase Structure

Every RPC handler and major service-layer function follows a seven-phase conceptual order. The phases always appear in this sequence. Use labeled comments only for phases the function actually uses; do not paste empty phase markers.

| Phase | Purpose | Allowed Operations |
|---|---|---|
| **instrument** | Initialize telemetry, create spans, attach structured logging context and correlation IDs. | Span creation, attribute attachment, metric counters. |
| **validate** | Pure input validation: field presence, format, ranges, enum membership, mode compatibility. | Deterministic checks only. No I/O. |
| **permissions** | Resolve the caller's permission set by calling the identity service. Reject unauthorized calls. Produce a scoped permission set that flows into query and respond. | Identity service RPC reads. No mutations. |
| **setup** | Convert proto messages to domain types, initialize command structs, normalize inputs, apply defaults. | Type conversion, default population, struct initialization. |
| **query** | Retrieve all data needed for execution. Contextual validation (existence) happens here. Scope queries using the resolved permission set where applicable. | DB reads, downstream RPC reads, cache reads. |
| **command** | Perform all mutations: create/update/delete aggregates, emit events, grant permissions. | DB writes, event creation, transactional operations. |
| **respond** | Convert domain models to transport response. Build a projection of the aggregate scoped to the caller's permissions. Attach metadata, map errors to transport codes. | Proto construction, projection filtering, header attachment, error mapping. |

> **Key Change from v1:** Permission checks are now a dedicated phase (`permissions`) that runs immediately after validation, rather than being mixed into the query phase. The permissions phase calls the identity service, resolves the caller's permission set, and that set is used to scope both queries and the response projection. Lightweight DB existence checks have moved from `validate` to `query`. The validate phase is now purely deterministic.

---

## 2. Phase Reference

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

### 2.3 permissions

The permissions phase resolves the caller's identity and authorization. This always involves a call to the identity service's permissions RPCs. The output is a resolved permission set: a structured representation of what the caller is allowed to do and what aggregate sub-resources they are allowed to see.

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

> **Why a dedicated phase?** Permissions are not a contextual validation check like "does this entity exist." They are an external service call that produces a structured result used by multiple downstream phases. Burying them in the query phase obscures the authorization boundary, makes it unclear when the access decision happens, and leads to inconsistent projection logic across handlers.

### 2.4 setup

Convert any remaining transport types into domain types. After this phase, protobuf messages should not appear again until the respond phase.

```go
cmd := &CreateReservationCommand{
    ExperienceID: params.ExperienceID,
    StartDate:    params.StartDate,
}
```

- ✗ Mutate incoming proto messages.
- ✗ Perform persistence or orchestration.

### 2.5 query

Retrieve everything the command phase will need. This is also where contextual validation lives: checking that referenced entities exist, resolving identities. These operations require I/O and are not deterministic, so they do not belong in the validate phase. Use the resolved permission set from the permissions phase to scope queries where applicable — for example, loading only the components the caller is authorized to view rather than the full aggregate.

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

Convert domain models back into transport types. Attach cookies, tokens, headers, pagination metadata. Map domain errors to gRPC status codes. This is the only place proto construction should happen after the setup phase.

**Build the response projection using the permission set from the permissions phase.** The caller receives only the aggregate sub-resources they are authorized to view. For example, a `GetReservation` response for a participant might include the reservation dates and their own component, while omitting payment shares, other participants' components, and internal drifts.

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
| `ErrForbidden` | `PermissionDenied` | Authorization failure (permissions phase). |
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

---

## 12. Function Size and Extraction

RPC handlers should remain orchestration-oriented. They coordinate the seven phases but delegate complex logic to extracted functions.

When a function exceeds reasonable complexity, extract along phase boundaries: query functions that load and assemble data, command functions that perform atomic aggregate operations, and workflow functions that coordinate multi-step processes.

- ✓ Extract workflow functions for multi-step orchestration.
- ✓ Extract query functions when loading logic involves joins or assembly.
- ✓ Extract aggregate command functions when mutation logic is non-trivial.
- ✗ Inline all business logic in the RPC handler.
- ✗ Extract so aggressively that the handler becomes unreadable indirection.

### 12.1 RPC Handler as Thin Orchestrator

Every RPC handler must be a thin orchestrator. The handler's body must read as a table of contents — each phase body is extracted into a named private method with a descriptive name. A handler exceeding ~40 lines that is not delegating to extracted methods is a code smell.

**Canonical pattern — `CreateReservations` (reservations service):**

```go
// CreateReservations is the canonical entry point for aggregate-oriented
// reservation creation. Flow: validate → resolve identities → resolve journey
// → execute (idempotency + aggregate transaction) → grant permissions →
// respond.
func (s *ServiceImpl) CreateReservations(ctx context.Context, req *rsvSvr.CreateReservationsRequest) (*rsvSvr.CreateReservationsResponse, error) {
	ctx, span := s.tracer.StartWithInfo(ctx)
	defer span.End()

	// ── validate + setup ──
	cmd, err := s.validateCreateReservationsRequest(ctx, req)
	if err != nil {
		s.logger.Err(fmt.Errorf("failed to validate create reservations request: %v", err)).Send()
		return nil, err
	}

	// ── permissions ──
	// ***** TODO: need to implement permission checking.

	// ── query: identities + journey ──
	ident, err := s.resolveIdentities(ctx, cmd)
	if err != nil {
		s.logger.Err(fmt.Errorf("failed to resolve identities: %v", err)).Send()
		return nil, status.Error(codes.Internal, err.Error())
	}

	journey, err := s.resolveJourney(ctx, cmd, ident)
	if err != nil {
		s.logger.Err(fmt.Errorf("failed to resolve journey: %v", err)).Send()
		return nil, status.Error(codes.Internal, err.Error())
	}

	// ── command: aggregate persistence (idempotency + transaction) ──
	results, err := s.executeReservationCreation(ctx, cmd, ident, journey)
	if err != nil {
		s.logger.Err(fmt.Errorf("failed to execute reservation creation: %v", err)).Send()
		return nil, status.Error(codes.Internal, err.Error())
	}

	// ── command: permissions after commit ──
	s.createPermissions(ctx, cmd, results)

	// ── respond ──
	return s.buildCreateReservationsResponse(ctx, cmd, ident, journey, results), nil
}
```

Key traits:
- Handler is ~40 lines, each phase is a single method call
- Internal methods return **domain types** (not proto): `CreateReservationCommand`, `IdentityResolutionResult`, `JourneyResolution`, `ReservationAggregateResult`
- Data flows explicitly: each method consumes previous results and produces typed outputs
- Phase comments act as section headers

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

	// --- permissions (TODO) ---

	// --- setup (inline variable extraction) ---
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

### 12.2 Domain Command and Result Types

Every multi-phase RPC handler should define domain types that carry data between phases. These types serve as the contract between extraction boundaries and make the data flow explicit and type-safe.

```go
// CreateReservationCommand carries the validated, proto-free request payload
// downstream from the validate phase. All fields are immutable once the
// command is built.
type CreateReservationCommand struct {
	Requests       []ReservationRequestCommand
	Mode           ResolvedMode
	BatchJourneyID string
	IdempotencyKey string
}

// IdentityResolutionResult is the output of the resolve-identities phase.
type IdentityResolutionResult struct {
	PrimaryIdentityIDByRequest map[string]string
	AdditionalIdentityIDs      map[string][]string
	Cookies                    []*identity.ClientCookie
}

// ReservationAggregateResult is the persisted output of one aggregate creation.
type ReservationAggregateResult struct {
	RequestID         string
	Reservation       *migrations.Reservation
	Request           *migrations.ReservationRequest
	Err               error
	PermissionWarning string
}
```

Protocol for domain types:
- **Name by domain concept**, not by phase position (e.g., `CreateReservationCommand`, not `ValidatePhaseOutput`)
- **Group related domain types** in a single file alongside the methods that produce/consume them (e.g., `reservations_entities.go`)
- **Never pass proto types** between extracted phase methods — convert at the validate/setup boundary and convert back only in respond

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

The following function types are exempt from the phase structure. They should still follow general Go best practices but do not require labeled phases:

- Tiny helper functions
- Pure utility functions
- Pure mapping/conversion functions
- Simple getters and setters
- Small deterministic functions with no I/O

## Using This Document

Part I (Principles) is the foundation. Use it for architectural decisions, design reviews, and onboarding. The principles should rarely change.

Part II (Patterns Catalog) is the implementation reference. Use it for PR reviews, code generation, and as a checklist when writing new handlers. These patterns will evolve; when updating them, verify alignment with the underlying principles.

When a pattern and a principle conflict, the principle wins. When the document is silent on a specific case, reason from the principles.
