---
date: 2026-06-28
feature: identity/refine
iteration_count: 1
final_verdict: PASS
critical_count: 0
warning_count: 1
applied_updates:
  - file: .opencode/rules/agents/go-implementer.md
    change: added provisional rule R-go-implementer-recovery-ratelimit-isolation (per-identity throttle primary; per-IP limiters on recovery loops must use own counter + high configurable ceiling)
  - file: .claude/metrics/aggregated/rule-effectiveness.json
    change: mirrored R-go-implementer-recovery-ratelimit-isolation (provisional, CONVENTION_VIOLATION, T3)
suggested_updates:
  - target: .opencode/agents/architect.md (or its rules file)
    reason: the architect's slice shaping recommended putting the shared-counter rateLimitOTP on BOTH the verify and resend routes — the design origin of the bug. Shaping of recovery-loop routes should specify counter isolation + a high backstop, not the default OTP limiter.
  - target: .opencode/rules/agents/reviewer.md
    reason: reviewer should flag any auth recovery route (resend/reissue) or lockable verify route that shares a low rate-limit counter with the action it recovers.
---

## Summary

Captured during `/conceptualize identity/refine` Phase 2, across the R5 OTP-throttle and
new-model Resend slices (audit finding H7). The headline lesson is a rate-limiter ↔
recovery-flow interaction that broke the feature TWICE from the same root cause, both
surfaced by live browser testing (not by types or unit logic):

1. **Resend shared the verify counter.** The resend route was initially wired with the
   per-IP `rateLimitOTP` middleware — the SAME `rl:otp:<ip>` counter as verify-signup. So
   issuing a fresh code (the recovery action) consumed the very verify budget the user
   needed to use that fresh code; the post-resend verify got a 429.

2. **The verify per-IP ceiling was too low for the recovery loop.** Even after decoupling
   resend, verify-signup kept the coarse per-IP `rateLimitOTP` (5 requests / 15 min,
   IP-only because the verify body carries no email). A single legitimate
   "3 wrong attempts → Resend → retry" cycle is ~6 verify requests — already over 5 — and
   accumulated testing pushed the human's IP counter to 10, so every verify returned
   `otp_rate_limited` regardless of token state. The coarse per-IP ceiling structurally
   defeats a per-identity throttle + resend recovery and punishes shared NAT.

**Resolution arc (the right end state):** the per-identity, per-token throttle
(`maxSignUpOTPAttempts=3`, in the `VerifySignUpOtp` RPC) is the PRIMARY limit; resend has
a per-identity cap (`maxSignUpResends=3`/15m) on its OWN logic; and the per-IP limiter was
re-introduced as `rateLimitSignupVerify` — a HIGH, env-configurable backstop
(`SIGNUP_VERIFY_IP_MAX` default 50, `SIGNUP_VERIFY_IP_WINDOW_SEC` default 900) with its
OWN counter key `rl:signup-verify:<ip>`, deliberately above a legit recovery cycle so it is
a DoS backstop, not a functional ceiling. Verified: two back-to-back lockout→resend→verify
cycles from one IP (~12 verify requests) both succeed; the backstop counts (~5) without
blocking.

Two FE issues from the same browser test were also fixed (duplicate resend countdowns →
single control for the signup flow; countdowns lost on modal close/reopen → deadline-based
localStorage persistence) — see changelog; they are UX, not the rate-limit lesson.

## Root Cause Analysis

### Critical Issues
None (no security/data-loss/build-break). The rate-limit interaction was a functional/UX
break, caught before any ship.

### Persistent Patterns
- **Rate-limit layering vs recovery loops (new).** A throttle and its recovery action form
  a loop. If the recovery action shares a counter with the throttled action — or if a
  coarse shared-key (per-IP) limiter sits at a threshold near the throttle's — the recovery
  cannot complete: the system locks the user out of the escape hatch. The fix pattern:
  (a) per-identity/per-token limit is primary and precise; (b) per-IP limiters are HIGH,
  configurable, own-counter backstops; (c) a recovery action never consumes the budget of
  the action it recovers. This is the same family as last cycle's BFF lesson — a contract
  that "looks fine" statically but fails only in the live end-to-end path; both were caught
  by live `/conceptualize` testing, reinforcing that recovery/error paths need live
  exercise, not just type-checking.
- **Design-origin in the shaping step.** The architect's slice sketch explicitly
  recommended `rateLimitGlobal + rateLimitOTP` on both verify and resend routes. The lesson
  belongs partly upstream in shaping (suggested_update for architect), not only in wiring.

## Metrics
- Slices: R5 OTP throttle (refine-go-004/refine-web-002) + new-model Resend (recovery path).
- Live-caught defects this cycle: 2 (resend counter sharing; verify per-IP ceiling) — same
  root cause; both fixed and re-verified. Plus 2 FE UX fixes (duplicate counter, persistence).
- Backend: identities.go (ResendSignUpOtp), http_middlewares.go (rateLimitSignupVerify +
  envIntOr), init_http.go (route chains). FE: apiClient, BFF resend route, context, verify.tsx.
  All builds/tsc clean.
- Rate-limit end state: per-identity primary (3) + resend cap (3/15m) + high per-IP backstop
  (default 50/15m, env-tunable, own counter) + rateLimitGlobal (30/30s).

## Rule Updates Applied
- **R-go-implementer-recovery-ratelimit-isolation** (provisional, high, T3,
  CONVENTION_VIOLATION) — added to go-implementer rules + effectiveness ledger. Recurred
  twice within this one feature; stays provisional per the ≥2-features / Critical gate.
  Promote to binding on a second-feature recurrence. Candidate to push down the ladder: a
  reviewer checklist item, or a mechanical check that flags a resend/reissue route sharing
  a rate-limit counter with its paired verify route. Suggested upstream updates logged for
  architect (shaping) and reviewer (gate).
