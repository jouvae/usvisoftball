---
id: L-identity-refine-02
date: 2026-06-26
feature: identity/refine
tier: T3
trigger: phase-boundary
category: process-change
status: active
---

## Context
`identity/refine` predated the ECA flow: its directory held rich non-standard inputs
(`audit-report.md`, `instructions.md`, `refactor-plan.md`) and an empty `status.md`, and
a sibling feature dir (`identity/review`) already held 18 accepted `identities-*`
scenarios plus the data-model spike. `/empathize` had to formalize, not greenfield.

## What happened
The correct empathize move on a pre-ECA / mid-stream feature was to **adopt existing
artifacts as research signals** (the static audit became the primary signal in lieu of
absent telemetry), **reference sibling-feature scenarios as carried-forward** rather than
regenerate them, scaffold only the *missing* standard files (overview/status/changelog/
lessons), and draft **new scenarios only for the genuine gaps** the audit surfaced
(password reset, recovery change, device manager, safe redirect, OTP throttle). A
security-remediation feature is mostly **non-user-facing hardening with no scenario** —
validated by dcon + red-team, not BDD — so a thin scenario set is expected and correct,
not a coverage gap.

## What to do differently
When `/empathize` finds a populated feature dir with non-template artifacts, detect and
**ingest** them before any new synthesis; cross-link sibling-feature scenarios as
carried-forward and add only gap scenarios; do not treat "few new scenarios" as
under-coverage when the work is hardening. Process note: this also validated tier
calibration — T3 auto-escalated on six triggers (auth · money · PII · public-API ·
data-migration · security) with **no under-tiering**, the desired calibration signal.
