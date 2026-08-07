---
description: Ratified security invariants for the Jouvae platform — tenant authorization, account anti-enumeration, recovery-flow rate limiting, and the regression-test requirement. Loads when editing service handlers, auth code, BFF routes, or the authz schema.
paths:
  - "services/alpha/modules/**/*.go"
  - "clients/web/src/app/api/**/*.ts"
  - "configs/spicedb/**"
  - "libs/go/auth/**"
---

# Security invariants

Every rule here was ratified from a confirmed production-class defect — a live cross-tenant
IDOR, an enumeration oracle, a recovery flow a user could not escape. They are **binding**:
a change that violates one does not ship. Where a deterministic gate exists it is named;
the gate is the backstop, this file is the reason.

---

## S1. Tenant authorization — authorize the OWNING workspace before any DB operation

**Applies to:** any service RPC that reads or writes workspace-scoped tenant data — it takes a
`workspace_id`/slug, or acts on a resource, rule, listing, booking, or file that belongs to a
workspace.

**The rule.** Authorize the authenticated caller against the resource's **owning** workspace
**before** any DB read or write:

1. Resolve caller identity from the **session token** (`resolveRequestMode` / token decode) —
   never from the request body.
2. Resolve the target workspace **slug → ULID server-side** (`resolveActiveWorkspaceID`).
3. Call `s.idClient.CheckAccess{SubjectType: IDENTITY, ResourceType: WORKSPACE}` and read the
   right flag: `CanView` for reads, `CanEdit` for writes, `CanManage` on the `is_platform_root`
   workspace (`resolvePlatformWorkspaceID`) for cross-workspace/platform moderation.
4. On deny (`PermissionDenied`, or the flag is false) return **`codes.NotFound`** for ordinary
   reads and writes — never leak existence — and `codes.PermissionDenied` for platform moderation.

Mirror `bookings_projections.go`. Permission flags derive from the authz schema via
`CheckBulkPermissions`; never collapse a role string into "has all permissions" locally.

**Three things that look like authorization and are not:**

| Anti-pattern | Why it fails |
|---|---|
| `if workspace_id != "" { … }` | A presence check authorizes nothing. |
| Trusting a client-controlled scope — a request-body `workspace_id`, or an HTTP header like `Active-Workspace-Slug` | A header may **select** which data to act on; it may never **grant** access. A check that no-ops when the input is absent is not a check. |
| A list/query RPC that falls through to an unscoped all-tenant query when the scope is empty | This is the exact shape that dumped every tenant's rules. Reject empty scope with `codes.InvalidArgument`. |

**Gate:** `libs/scripts/check-workspace-authz.sh` — `make check-authz`, CI `test-alpha`, and the
Deliver Node-3 pre-gate. It fails if an enforced tenant RPC loses its `CheckAccess`. **Add every
new tenant-scoped RPC to its `AUTHZ_ENFORCED` list.**

> **Why this is gated and not just written down.** This rule existed as a prompt rule for the
> reviewer agent and still shipped a cross-tenant IDOR across every data/v1 listing RPC — because
> the 3D Deliver flow never invokes the reviewer, so the rule never fired. Red-team caught it. The
> deterministic gate is what makes the rule flow-independent; the prose is defense-in-depth.

---

## S2. Anti-enumeration — one invariant across signup, login, and reset

**Applies to:** signup, login, password-reset, and any endpoint or form keyed on an account
identifier.

Account enumeration is a **cross-endpoint invariant, not a per-endpoint fix.** Fixing signup while
login still distinguishes a registered from an unregistered identifier makes the fix worthless. A
change touching one of the three must verify the other two still hold.

**The response must be indistinguishable** for a registered vs unregistered identifier across
*every* observable channel:

- **Status code and body** — byte-identical, including any `error_code`.
- **Next step / redirect / set-cookie** — identical.
- **Timing** — equalize the paths. An early return that skips password hashing, a row write, or
  mail delivery is measurably faster and is itself the oracle. Do a dummy Argon2 verify on the
  not-found path.

**The distinguishing signal goes to the inbox, never the browser.** "You already have an account"
is an email, not an inline form error.

Per surface:

- **Backend** — identical response construction on both branches; timing normalized.
- **Frontend** — identical affordance and next step. No inline "account already exists" error, no
  error styling, no differing navigation. The distinction must never reach the browser. This is the
  deliberate exception to **F1** (BFF error-code preservation): these routes return a generic body
  on purpose.
- **Tests** — assert response parity (status + body) for registered vs unregistered, plus a timing
  parity check, across **all three** endpoints. A single-endpoint test leaves the oracle open.
- **Review** — block if the change distinguishes via status, body, redirect, set-cookie, or timing,
  or if it touches one endpoint while another still leaks.

Spec: `docs/features/identity/refine/anti-enumeration.md`.

---

## S3. Recovery-flow rate limiting — never throttle the escape hatch

**Applies to:** rate-limit middleware on any auth route in a lockout → recover → retry loop — a
verify/OTP route that can lock, a resend/reissue route, or any route a user must re-hit to escape
a throttle.

- **The per-identity / per-token throttle is the PRIMARY limit.**
- Any per-IP (or otherwise shared-key) limiter on these routes must:
  1. **Use its own counter.** A resend must never consume the verify budget. Sharing the counter
     means the recovery action burns the very budget it exists to restore.
  2. **Be a high, configurable ceiling** that comfortably exceeds one legitimate
     lockout → resend → retry cycle (~N attempts × resends). It is a coarse DoS backstop, not a
     functional ceiling.

**Never gate a recovery action — or the action it recovers — behind a low shared counter the
recovery cannot reset.** This broke recovery twice inside a single feature: first by sharing
verify's `rl:otp` counter, then with a per-IP ceiling too low for the resend→retry loop.

---

## S4. A security fix ships with a regression test

**Applies to:** any change that closes an audit finding (an id like `C1`, `H9`, `M11`) or a
red-team finding.

The test must **fail against the old behavior and pass against the fix**, and assert the explicit
gRPC status code — a generic error assertion is not a passing security test. Exercised through the
gRPC client like every other test. Review blocks approval without it.

Common shapes:

- **BOLA / object-level authz** — caller A creates a resource; caller B (authenticated, unrelated)
  requests it by id → `PermissionDenied` or `NotFound`. Also assert that a request-body
  `subject_id`/`workspace_id` belonging to someone else is rejected for a non-admin caller.
- **Session revocation** — sign in, capture the token, sign out or revoke → the same token is
  rejected on the next request.
- **OAuth** — an unverified-email, unsigned-`id_token`, empty-`state`, or off-site
  `last_active_uri` callback is rejected and sets no session.
- **Rate limit / OTP** — N+1 attempts → `ResourceExhausted` or lockout; a reused or expired OTP is
  rejected and single-use is enforced.
- **Anti-enumeration** — response and timing parity across signup, login, and reset (**S2**).
