# Lessons: create-reservations

**Date**: 2026-05-29
**Source**: /fix create-reservations run against plan-review-003.md
**Session**: /fix → 12 issues fixed (3 Critical, 9 Warnings)

## Session Metrics

| Metric | Value |
|--------|-------|
| Reviews in session | 3 (plan-review-001, plan-review-002, plan-review-003) |
| Initial criticals | 11 (plan-review-001) |
| Final criticals (after fixes) | 0 |
| Total issues fixed this run | 12 |
| First-attempt pass | NO (3 QA rounds needed) |

## Issues Classified

| Issue ID | Error Type | Source Agent | Root Cause |
|----------|------------|-------------|------------|
| CRIT-FE-14 | TEST_RULE_VIOLATION | nextjs-tester | E2E test selectors for steps 4/5 used `continue-button` but components render `submit-button` and `pay-button` |
| CRIT-FE-15 | IMPLEMENTATION_GAP | nextjs-implementer | API route type and flattening omitted `payment_intents` despite type contract existing |
| CRIT-FE-16 | TYPE_ERROR | architect | `PENDING_PAYMENT` added to `ReservationLifecycleState` enum but not to `VALID_LIFECYCLE_TRANSITIONS` or `OPERATOR_LIFECYCLE_TRANSITIONS` |
| WARN-FE-10 | MISSING_TEST | nextjs-tester | Auth failure test not included alongside happy-path e2e test |
| WARN-FE-11 | TEST_RULE_VIOLATION | nextjs-tester | Used `page.locator('[data-testid="..."]')` instead of `page.getByTestId('...')` |
| WARN-FE-12 | IMPLEMENTATION_GAP | nextjs-implementer | Step 1 and Step 2 didn't destructure `flowData`/`updateFlowData` from props |
| WARN-FE-13 | OTHER | planner | Form step tasks lacked Zod schema + React Hook Form validation references |
| WARN-FE-14 | OTHER | planner | Add-on data-fetching strategy (SWR) not explicitly named |
| WARN-FE-15 | IMPLEMENTATION_GAP | nextjs-implementer | Step components didn't render `flowData`, preventing data-preservation validation |
| WARN-BE-008 | MISSING_TEST | go-tester | Capacity test (go-004) had no experience instance with limited capacity |
| WARN-BE-009 | OTHER | go-tester | Test BDD blocks declared `group: B` but scenario files said `group: A` |
| WARN-BE-010 | OTHER | planner | Error approach (gRPC status vs response-body fields) underspecified in tasks |

## Root Causes

### Critical Issues

1. **CRIT-FE-14**: Previous fix for CRIT-FE-10 updated E2E tests to click "Continue" but didn't account for steps 4 and 5 having differently-named action buttons (`submit-button`, `pay-button`). The fix was scoped to the auto-advance timer issue and missed the downstream selector mismatch.

2. **CRIT-FE-15**: The `CreateReservationsResponse` TS type was updated to include `payment_intents` (CRIT-FE-11 fix), but the API route that produces the response was not updated to extract it from the Sagas service response. Cross-reference validation was missed.

3. **CRIT-FE-16**: The `PENDING_PAYMENT` enum value was added to the `ReservationLifecycleState` enum (WARN-BE-005 fix), but the two `Record<>`-typed maps in `reservation-state.ts` that require every enum value as a key were not updated. No validation step verified that all enum consumers were updated.

### Warning Issues

7 warnings addressed — primarily missing test coverage (WARN-FE-10, WARN-BE-008), convention deviations (WARN-FE-11, WARN-BE-009), underspecified task descriptions (WARN-FE-13, WARN-FE-14, WARN-BE-010), and incomplete component implementations (WARN-FE-12, WARN-FE-15).

## Applied Updates

### nextjs-tester (architect)

Added rule: verify button data-testid selectors match actual component attributes before writing tests
<!-- Learned: 05-29-2026-create-reservations -->

_Applied at_: `.opencode/agents/nextjs-tester/instructions.md` — added as selector validation step

### architect

Added rule: when adding enum values to Record<>-typed maps, update all consumer maps that key on that enum
<!-- Learned: 05-29-2026-create-reservations -->

_Applied at_: `.opencode/agents/architect/instructions.md` — added as enum validation step

## Suggested But Not Applied

| Issue ID | Suggested Rule | Target | Reason Deferred |
|----------|---------------|--------|-----------------|
| WARN-FE-10 | nextjs-tester: Include auth failure test alongside every e2e happy path | `nextjs-tester` | Warning, not Critical |
| WARN-FE-11 | nextjs-tester: Use `page.getByTestId()` not `page.locator()` for testid selectors | `nextjs-tester` | Warning, not Critical |
| WARN-FE-12 | nextjs-implementer: Destructure all props from step component interfaces | `nextjs-implementer` | Warning, not Critical |
| WARN-FE-13 | planner: Reference Zod schema approach in form step task descriptions | `planner` | Warning, not Critical |
| WARN-FE-15 | nextjs-implementer: Render flowData in step components for data-preservation | `nextjs-implementer` | Warning, not Critical |
| WARN-BE-008 | go-tester: Create fixture helpers for constraint-based tests | `go-tester` | Warning, not Critical |
| WARN-BE-010 | planner: Specify error approach (gRPC status vs response-body) in tasks | `planner` | Warning, not Critical |

## Trajectory

- **Prior sessions**: 0 (first learning loop run for this project)
- **Persistent patterns**: n/a
- **Eliminated this session**: n/a
