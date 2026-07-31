# Lessons: create-reservations (Run 2)

**Date**: 2026-05-29
**Source**: /qa create-reservations run against plan-review-004.md (re-review after /fix)
**Session**: /qa → 4 Warnings found (0 Critical)

## Session Metrics

| Metric | Value |
|--------|-------|
| Reviews in session | 4 (plan-review-001 through plan-review-004) |
| Initial criticals | 11 (plan-review-001) |
| This review criticals | 0 |
| This review warnings | 4 |
| Total issues to date | 16 (3 Critical + 13 Warnings) |
| First-attempt pass | NO (4th QA round, still NEEDS_REVISION) |

## Issues Classified

| Issue ID | Error Type | Source Agent | Root Cause |
|----------|------------|-------------|------------|
| WARN-FE-01 | TEST_RULE_VIOLATION | nextjs-tester | E2E test files (full-flow.spec.ts, declined-card.spec.ts, back-navigation.spec.ts) use `page.locator('[data-testid="..."]')` instead of `page.getByTestId('...')`. Previous WARN-FE-11 fix only covered web-* spec files, not e2e spec files. |
| WARN-FE-02 | SCHEMA_MISMATCH | architect | `ReservationCreateBody` type and request mapping in API route omit `payment_shares` field, despite proto defining `repeated global.PaymentShare payment_shares = 21` on `ReservationRequest`. |
| WARN-FE-03 | IMPLEMENTATION_GAP | nextjs-implementer | Steps 3, 4, 5 destructure only `{ onNext, onBack }` from `CreateReservationStepProps`, ignoring `flowData`/`updateFlowData`. Previous WARN-FE-12 fix only covered steps 1 and 2. |
| WARN-BE-101 | SCHEMA_MISMATCH | architect | `global.proto` `ReservationLifecycleState` enum (values 0–6) missing `PENDING_PAYMENT = 7`, which exists in `reservations.proto`. Previous CRIT-FE-16 fix addressed TS transition maps but not the global.proto enum. |

## Regression Analysis

| Pattern | First Seen | Fixed In | Reappears In | Scope Gap |
|---------|-----------|----------|-------------|-----------|
| `page.locator` vs `page.getByTestId` | WARN-FE-11 (review-001) | review-003 (web-* only) | WARN-FE-01 (review-004, e2e-* files) | Fix only applied to web-* spec files, missed 3 e2e-* spec files |
| Step components ignoring flowData | WARN-FE-12 (review-001) | review-003 (steps 1, 2 only) | WARN-FE-03 (review-004, steps 3, 4, 5) | Fix only applied to step-1 and step-2, missed steps 3, 4, 5 |
| Proto enums out of sync | CRIT-FE-16 / WARN-BE-005 (review-001) | review-003 (TS maps only) | WARN-BE-101 (review-004, global.proto) | Fix only addressed TS-side `reservation-state.ts` maps, missed `global.proto` enum |

## Root Causes

### Warning Issues

1. **WARN-FE-01 (TEST_RULE_VIOLATION, partial fix regression)**: The fix for WARN-FE-11 replaced `page.locator('[data-testid="..."]')` with `page.getByTestId()` in the 7 web-*.spec.ts files but did not apply the same change to the 3 e2e-*.spec.ts files. The scope of the fix was incomplete — it followed the scope of the BDD scenarios (web-* only) rather than checking all test files for the same pattern.

2. **WARN-FE-02 (SCHEMA_MISMATCH)**: The API route body type `ReservationCreateBody` and its mapping to the backend request omit the `payment_shares` field. This is a new issue not previously identified — it exists because the API route was created before the payment shares feature was fully specified in the proto.

3. **WARN-FE-03 (IMPLEMENTATION_GAP, partial fix regression)**: The fix for WARN-FE-12 added `flowData`/`updateFlowData` destructuring to step-1-experience.tsx and step-2-addons.tsx but did not add it to step-3-payment-shares.tsx, step-4-review.tsx, or step-5-payment-entry.tsx. Same root cause as WARN-FE-12 but with incomplete scope.

4. **WARN-BE-101 (SCHEMA_MISMATCH, partial fix regression)**: The `PENDING_PAYMENT` value (7) was added to `reservations.proto`'s `ReservationLifecycleState` enum but not to `global.proto`'s copy of the same enum. The previous fix (CRIT-FE-16) only addressed the TS-side transition maps in `reservation-state.ts`, not the global proto enum. The `global.Reservation.ToProto()` path will silently map PENDING_PAYMENT → UNSPECIFIED.

## Applied Updates

None — all 4 issues are Warnings, not Criticals. Per improve-skill rule #9, only Critical-derived updates are auto-applied.

## Suggested But Not Applied

| Issue ID | Suggested Rule | Target | Reason Deferred |
|----------|---------------|--------|-----------------|
| WARN-FE-01 | nextjs-tester: When fixing test selectors, audit ALL test files (component + e2e) for the same pattern change | `nextjs-tester` | Warning, not Critical |
| WARN-FE-02 | architect: When creating API route types, verify every proto request field has a corresponding mapped field in the frontend route body | `architect` | Warning, not Critical |
| WARN-FE-03 | nextjs-implementer: When adding prop destructuring to step components, apply to ALL steps in the flow, not just the ones explicitly listed in the fix | `nextjs-implementer` | Warning, not Critical |
| WARN-BE-101 | architect: When adding an enum value to a service proto, verify the same value exists in global.proto if the proto defines a parallel enum | `architect` | Warning, not Critical |

## Trajectory

- **Prior sessions**: 1 (05-29-2026-create-reservations.md)
- **Persistent patterns**: Partial-fix regressions — patterns fixed in one location but not all locations (WARN-FE-01, WARN-FE-03, WARN-BE-101 are all instances of this)
- **Eliminated this session**: n/a (0 Criticals to eliminate)
- **First-attempt pass rate (rolling 1)**: 0% (never passed first QA)
