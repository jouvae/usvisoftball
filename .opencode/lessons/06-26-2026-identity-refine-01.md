---
id: L-identity-refine-01
date: 2026-06-26
feature: identity/refine
tier: T3
trigger: phase-boundary
category: learning
status: active
---

## Context
Empathize phase for `identity/refine` (auth/session/authz audit remediation). Audit
finding **M3** (registration enumeration) wanted a generic backend response, which
collided with two already-accepted scenarios (`identities-go-001`/`-web-001`) whose
`Then` clauses asserted an explicit "an account already exists for that email" browser
message. Resolved at the post-problem-statement checkpoint as **ADR-5 → amend**, guided
by `docs/features/identity/refine/anti-enumeration.md`.

## What happened
Account enumeration is a **cross-endpoint invariant, not a per-endpoint fix**: it leaks
from signup, login, AND password-reset, plus **timing** side-channels (early-return
paths that skip password hashing / row writes / mail are measurably faster). Fixing one
endpoint while another still distinguishes registered vs unregistered emails makes the
fix worthless. The distinguishing information ("you already have an account") must be
delivered to the **email inbox**, never the browser — the browser response must be
byte-identical (status, body, next step) for registered vs unregistered email.

A second-order lesson: a new audit finding that contradicts an *already-accepted*
scenario must be reconciled **on the source scenario** (amend its `Then`), not by adding
a parallel "non-enumerable" scenario beside it — otherwise the old enumerating spec
survives and gets implemented.

## What to do differently
When any finding/scenario touches signup messaging, treat anti-enumeration as a single
invariant spanning **signup + login + reset + response timing** and verify all of them
together (timing test included). Rule candidate for **go-implementer / go-tester /
security-review**: *an account-enumeration fix must make browser responses
byte-identical across signup/login/reset for existing vs non-existing identifiers,
normalize path timing, and move any distinguishing signal to the inbox; a fix touching
only one endpoint fails review.* `/improve` to generalize into an
`R-{agent}-anti-enumeration` record. Spec reference: `identity/refine/anti-enumeration.md`.
