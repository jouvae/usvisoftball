# go-implementer — learned rules

Loaded by `.opencode/agents/go-implementer.md`. Schema + lifecycle:
[`../LEARNING-LOOP.md`](../LEARNING-LOOP.md). Budget: ~40 records.

---

### R-go-implementer-anti-enumeration
- trigger: implementing or modifying the signup, login, or password-reset response path (any account-identifier-keyed endpoint)
- rule: make the client-facing response byte-identical (status, body, next-step) for an existing vs non-existing identifier, and equalize path timing (e.g. dummy Argon2 verify on not-found); deliver any "you already have an account" signal to the email inbox only. A change touching one of the three endpoints must verify the other two hold the same property.
- status: provisional
- confidence: high
- source: L-identity-refine-01; audit M3; docs/features/identity/refine/anti-enumeration.md
- tier: T3
- promoted: 2026-06-26
- last_validated: 2026-06-26
- recurrences_after: 0
- gate: none
- note: SECURITY rule — promotion to `binding` requires the security-review gate (LEARNING-LOOP promotion policy).

### R-go-implementer-recovery-ratelimit-isolation
- trigger: wiring or choosing rate-limit middleware on an auth route that participates in a lockout→recover→retry loop — i.e. a verify/OTP route that can lock, a "resend/reissue" recovery route, or any route a user must re-hit to escape a throttle
- rule: make the per-identity/per-token throttle the PRIMARY limit. Any per-IP (or otherwise shared-key) limiter on these routes must (a) use its OWN counter — never share the counter between the recovery action and the action it recovers (a resend must not consume the verify budget), and (b) be a HIGH, configurable ceiling that comfortably exceeds one legitimate lockout→resend→retry cycle (~N attempts × resends), so it acts as a coarse DoS backstop, not a functional ceiling. Never gate a recovery action, or the action it recovers, with a low shared-counter limiter the recovery cannot reset.
- status: provisional
- confidence: high
- source: L-identity-refine-04; refine-go-004/refine-web-002 (H7); docs/features/identity/refine/changelog.md (2026-06-27/28)
- tier: T3
- promoted: 2026-06-28
- last_validated: 2026-06-28
- recurrences_after: 0
- gate: none
- note: recurred TWICE within one feature (resend sharing verify's rl:otp counter; verify's 5/15m per-IP ceiling breaking the resend→retry cycle). Stays provisional (one feature, not a security/data-loss Critical); promote to binding if it recurs in a second feature.
