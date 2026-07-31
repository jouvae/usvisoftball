# Lessons: create-reservations (Run 4)

**Date**: 2026-05-29
**Source**: /fix create-reservations run against plan-review-005.md (post-review 004 fix regressions)
**Session**: /fix -> 7 issues fixed (1 Critical, 6 Warnings)

## Session Metrics

| Metric | Value |
|--------|-------|
| Reviews in session | 5 (plan-review-001 through plan-review-005) |
| Initial criticals (session) | 11 (plan-review-001) |
| This pass criticals | 1 |
| This pass warnings | 6 |
| Total issues addressed this pass | 7 |
| First-attempt fix pass | YES (all 7 issues fixed on first attempt) |

## Issues Classified

| Issue ID | Error Type | Source Agent | Root Cause |
|----------|------------|-------------|------------|
| CRIT-FE-01 | SCHEMA_MISMATCH | architect | PaymentShareInput was used in route.ts but not added to the barrel re-export in types/index.ts. Previous fix added the type to reservations.ts but missed the index.ts export — same incomplete-export pattern as earlier PENDING_PAYMENT fix. |
| WARN-FE-01 | OTHER | nextjs-tester | E2e test filenames used descriptive names (full-flow, declined-card, back-navigation) instead of scenario-id convention (create-reservations-e2e-NNN). |
| WARN-FE-02 | SCHEMA_MISMATCH | architect | ReservationResult and ExternalPayer not re-exported from types/index.ts. Same barrel-export gap as CRIT-FE-01. |
| WARN-FE-03 | IMPLEMENTATION_GAP | architect | CreateReservationInput hook type diverged from ReservationCreateBody route type — stub hook had minimal fields with a TODO, while route had complete snake_case shape. No convergence plan documented. |
| WARN-BE-001 | INTERNAL_CONTRADICTION | architect (plan) | Task T001 logic step 2 says "return payment intents synchronously" while step 4 says "use async events for cross-domain calls". The contradiction was not resolved before implementation. |
| WARN-BE-002 | SCHEMA_MISMATCH | architect | ExperienceInstance.Available field defined in Go struct but never populated in FromProto(); only the deprecated SpaceAvailable was set. Capacity-check code reading Available would always get 0. |
| WARN-BE-003 | TEST_RULE_VIOLATION | go-tester | Test setup helpers that create workspaces and grant SpiceDB permissions do not call waitForSpiceDBPropagation() before returning, causing potential flaky tests from eventual consistency. |

## Root Causes

### Critical Issues

1. **CRIT-FE-01**: The WARN-FE-02 fix in review 004 added `payment_shares` to the API route body type, which referenced `PaymentShareInput` via `import("@/types").PaymentShareInput[]`. However, the barrel re-export in `types/index.ts` was never updated to include `PaymentShareInput`. This is the same class of error as CRIT-FE-16 (enum value added to proto but not to TS maps) and WARN-BE-101 (proto enum value not synced to global.proto) — a "partial export" regression where a type is defined in its module file but not surfaced through the barrel export.

### Warning Issues

Six warnings addressed: 2 schema mismatches (barrel exports, struct FromProto gap), 1 implementation gap (hook/route type divergence), 1 internal contradiction (sync vs async in task logic), 1 test rule violation (missing SpiceDB propagation wait), 1 naming convention (e2e file naming).

## Applied Updates

### fix skill

Added rule: When adding a type export to a module file, always verify the barrel re-export file (e.g., index.ts) includes the new type. This prevents the partial-export regression pattern observed in CRIT-FE-01, CRIT-FE-16, WARN-BE-101.
<!-- Learned: 05-29-2026-create-reservations -->

_Applied at_: `.opencode/skills/fix/SKILL.md` — added as "Enum-to-map sync" rule is already present; this extends it to barrel exports

### architect subagent

Added rule: When adding a type to a module file, verify the barrel re-export (index.ts) is updated to include it. When populating a Go struct from proto in FromProto(), check that every non-deprecated field has a corresponding assignment.
<!-- Learned: 05-29-2026-create-reservations -->

_Applied at_: `.opencode/agents/architect/instructions.md`

## Suggested But Not Applied

| Issue ID | Suggested Rule | Target | Reason Deferred |
|----------|---------------|--------|-----------------|
| WARN-FE-01 | nextjs-tester: Use scenario-id naming convention (create-reservations-e2e-NNN) for all e2e test files | `nextjs-tester` | Warning, not Critical |
| WARN-FE-03 | architect: When creating stub hook types, document the target API route body shape with a convergence comment | `architect` | Warning, not Critical |
| WARN-BE-001 | planner: Resolve sync/async contradictions in task logic steps before marking plan as ready | `planner` | Warning, not Critical |
| WARN-BE-003 | go-tester: After any SpiceDB GrantAccess or workspace-creation call, add waitForSpiceDBPropagation() before returning from setup helpers | `go-tester` | Warning, not Critical |

## Trajectory

- **Prior sessions**: 3 (05-29-2026-create-reservations.md, 05-29-2026-create-reservations-02.md, 05-29-2026-create-reservations-03.md)
- **Persistent patterns**: Barrel-export / type-synchronisation regressions (CRIT-FE-16 → WARN-BE-101 → CRIT-FE-01). Each fix addresses the specific location but misses other consumers. Now auto-applied a general rule to the fix skill and architect.
- **Eliminated this session**: CRIT-FE-01 (barrel export gap) — new rule should prevent recurrence
- **Rolling first-attempt pass rate (4)**: 0% → 25% (this session passed first attempt after previous sessions didn't)
- **Avg initial criticals (4)**: 2.75
