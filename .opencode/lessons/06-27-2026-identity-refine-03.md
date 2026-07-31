---
date: 2026-06-27
feature: identity/refine
iteration_count: 1
final_verdict: PASS
critical_count: 0
warning_count: 1
applied_updates:
  - file: .opencode/rules/agents/nextjs-implementer.md
    change: added provisional rule R-nextjs-implementer-bff-preserve-error-code (forward upstream body+status verbatim on error path when the FE branches on a structured field)
  - file: .claude/metrics/aggregated/rule-effectiveness.json
    change: mirrored R-nextjs-implementer-bff-preserve-error-code (provisional, IMPLEMENTATION_GAP, T3)
suggested_updates:
  - target: clients/web/src/app/api/identity/verify/route.ts
    reason: legacy verifyGuest path uses handleApiError; safe today (caller reads only `error`) but must adopt forward-verbatim if its backend ever returns a structured error_code
---

## Summary

Captured during `/conceptualize identity/refine` Phase 2, R5 OTP-throttle slice
(`refine-go-004` + `refine-web-002`, audit finding H7). The slice shipped a backend
OTP attempt throttle (per-identity, single-use, ≤10m expiry) and a frontend lockout
banner that branches on `error_code === "otp_rate_limited"`. The backend contract was
correct end to end, but the lockout banner was **unreachable** because the BFF route
`clients/web/src/app/api/auth/verify-signup/route.ts` ran every non-2xx through
`handleApiError`, which forwards only `{ error: data.error || data.message }` and the
status — silently dropping `error_code` and `success`. The apiClient then fell back to
its default (`otp_invalid`), so the FE could never distinguish rate-limited from invalid.

This is the headline lesson: a BFF error-normalizing helper that reduces the upstream
body to `{ error }` erases any structured response contract (`error_code`/`success`)
the frontend depends on. The fix forwards `error.response.data` + status verbatim on
the error path, falling back to `handleApiError` only for true transport errors.

A post-fix sweep of all `clients/web/src/app/api/**/route.ts` found verify-signup was
the ONLY active instance. `reset-password` already forwards `error_code`;
`signin`/`signup`/`forgot-password` are intentionally generic (anti-enumeration — the
deliberate exception); business routes only read `error`/`message`. `/api/identity/verify`
(legacy `verifyGuest`) is safe today but is the one to watch.

## Root Cause Analysis

### Critical Issues
None.

### Persistent Patterns
- **BFF error-normalization vs structured FE contracts (new).** Shared helpers that
  collapse an error body to `{ error }` are convenient but lossy. Whenever a frontend
  caller branches on a structured field (`error_code`, `success`, field-level
  validation), the BFF route must preserve that field on the error path. The failure is
  invisible at compile time (types still line up) and only surfaces as "the
  differentiated error UI never appears," which is exactly what live prototyping caught
  here. Related in spirit to R-nextjs-implementer-api-route-type-parity (a type contract
  is an implementation gap until the route actually carries the field) — same class, the
  error path instead of the success path.

## Metrics
- Slice scope: 2 scenarios (refine-go-004 backend, refine-web-002 web), 1 audit finding (H7).
- Files touched: identities.go (throttle + gormClient migration), http_middlewares.go
  (429 error_code alignment), verify-signup/route.ts (forward verbatim), verify.tsx +
  context/index.tsx (lockout UI + typed error). All builds/typecheck clean.
- Latent bugs found & fixed mid-slice: 1 (BFF error_code stripping) — would have made the
  whole lockout UI dead on arrival.
- BFF sweep: 1 active instance (fixed), 1 watch item (identity/verify), 0 other bugs.
- Decision captured: per-identity throttle made PRIMARY (threshold 3 < per-IP middleware 5).

## Rule Updates Applied
- **R-nextjs-implementer-bff-preserve-error-code** (provisional, medium, T3,
  IMPLEMENTATION_GAP) — added to nextjs-implementer rules + effectiveness ledger. Stays
  provisional (first occurrence; not a security/data-loss/build-break Critical). Promote
  to binding if it recurs in a second feature. Candidate to push down the ladder later:
  a mechanical check could flag BFF routes that call `handleApiError` while their
  apiClient caller reads `error_code`/`success`.
