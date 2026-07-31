# Lessons: create-reservations (Run 3)

**Date**: 2026-05-29
**Source**: /fix create-reservations run against plan-review-004.md (final fix pass)
**Session**: /fix → 4 Warnings fixed (0 Critical)

## Session Metrics

| Metric | Value |
|--------|-------|
| Reviews in session | 4 (plan-review-001 through plan-review-004) |
| Initial criticals (session) | 11 (plan-review-001) |
| This pass criticals | 0 |
| This pass warnings | 4 |
| Total issues addressed this session | 4 |
| First-attempt fix pass | YES (all 4 warnings fixed on first attempt) |

## Issues Classified

| Issue ID | Error Type | Source Agent | Root Cause |
|----------|------------|-------------|------------|
| WARN-BE-101 | SCHEMA_MISMATCH | architect | `global.proto` `ReservationLifecycleState` enum missing `PENDING_PAYMENT = 7` that existed in `reservations.proto`. Previous CRIT-FE-16 fix addressed TS transition maps but not the global proto enum. |
| WARN-FE-02 | SCHEMA_MISMATCH | architect | `ReservationCreateBody` type and `reservationRequest` mapping in API route omitted `payment_shares` field, despite proto defining `repeated global.PaymentShare payment_shares = 21` on `ReservationRequest`. |
| WARN-FE-01 | TEST_RULE_VIOLATION | nextjs-tester | E2E test files use `page.locator('[data-testid="..."]')` instead of `page.getByTestId('...')`. Previous WARN-FE-11 fix only covered web-* spec files, not e2e-* spec files. |
| WARN-FE-03 | IMPLEMENTATION_GAP | nextjs-implementer | Steps 3, 4, 5 destructure only `{ onNext, onBack }` from `CreateReservationStepProps`, ignoring `flowData`/`updateFlowData`. Previous WARN-FE-12 fix only covered steps 1-2. |

## Regression Analysis

| Pattern | First Seen | Fixed In | Reappears In | Scope Gap |
|---------|-----------|----------|-------------|-----------|
| `page.locator` vs `page.getByTestId` | WARN-FE-11 (review-001) | review-003 (web-* only) | WARN-FE-01 (review-004, e2e-* files) | Fix applied to web-* but not e2e-* spec files |
| Step components ignoring flowData | WARN-FE-12 (review-001) | review-003 (steps 1, 2 only) | WARN-FE-03 (review-004, steps 3-5) | Fix applied to steps 1-2 but not 3-5 |
| Proto enum values out of sync | CRIT-FE-16 / WARN-BE-005 (review-001) | review-003 (TS maps only) | WARN-BE-101 (review-004, global.proto) | Fix applied to TS maps but not global.proto enum |

## Applied Updates

None — all 4 issues are Warnings, not Criticals. Per improve-skill rule #9, only Critical-derived updates are auto-applied.

## Suggested But Not Applied

| Issue ID | Suggested Rule | Target | Reason Deferred |
|----------|---------------|--------|-----------------|
| WARN-BE-101 | architect: When adding an enum value to a service proto, verify the same value exists in global.proto if the proto defines a parallel enum; check ALL locations (proto files, TS maps, Go maps) for the enum | `architect` | Warning, not Critical |
| WARN-FE-02 | architect: When creating/updating API route types, verify every proto request field has a corresponding mapped field in the frontend route body type | `architect` | Warning, not Critical |
| WARN-FE-01 | nextjs-tester: When fixing test selectors, audit ALL test files (component + e2e) for the same pattern — use glob-based search to find all occurrences | `nextjs-tester` | Warning, not Critical |
| WARN-FE-03 | nextjs-implementer: When adding prop destructuring to step components, apply to ALL steps in the flow by checking the interface definition — don't limit scope to the steps mentioned in a fix description | `nextjs-implementer` | Warning, not Critical |

## Trajectory

- **Prior sessions**: 2 (05-29-2026-create-reservations.md, 05-29-2026-create-reservations-02.md)
- **Persistent patterns**: Partial-fix regressions (scope gaps) — patterns fixed in one location but not all locations. All 4 warnings in this pass are instances of "fix was incomplete" across proto, test, and implementation domains.
- **Eliminated this session**: n/a (0 Criticals)
- **First-attempt pass rate (rolling 3)**: 0% (never passed first QA) — 4 QA rounds needed before plan was ready
- **Now ready for implementation**: YES — all 4 warnings addressed, 0 issues remain
