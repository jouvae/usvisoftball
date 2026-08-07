---
name: implement
description: Implementation phase skill. Two modes — Simple (ad-hoc tasks without pre-existing plan) and Full (BDD plan with scenarios and dependencies). Per-scenario TDD loop with tester → implementer → verify cycles.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Execute the implementation phase of the BDD feature flow. Provides two modes for different use cases.

## Three Modes

### Simple Mode (--simple)

For ad-hoc tasks without pre-existing plan:
1. Tester writes tests
2. Implementer makes them pass
3. Tester verifies (max 3 iterations)
4. No architect escalation, no status/files tracking

### Full Mode (default)

For BDD plan with scenarios and dependencies:
1. Read plan and load scenarios
2. Group scenarios by dependency (Group A parallel, Group B after A, etc.)
3. Per-scenario TDD loop:
   - Tester writes/refines tests
   - If types missing → ESCALATE to architect, then resume
   - Implementer makes tests pass
   - Tester verifies tests pass
   - If the scenario closes an audit finding → run the **security-review gate** (below)
4. Max 3 TDD iterations per scenario
5. Track status in graph or files

### Plan-driven Mode (--plan <path>)

For a phased master plan whose unit of work is a **phase + acceptance criteria +
audit finding IDs** rather than `scenario-NNN/` dirs — e.g.
`docs/features/identity/refactor/refactor-plan.md`. Use this when a plan merges a
security audit, a data-model refactor, and a permissions reconciliation.

1. Read the plan. Treat each phase's **work items** as the implementation targets
   and its **Acceptance** bullets + the audit finding IDs it closes (`§9 coverage
   map`) as the tests that must pass.
2. Honor the plan's **execution order** and **Depends on** lines for sequencing
   (Phase 0 → 1 → 2/4 → 3 → 5 → 6 → 7 → 8/9).
3. For each work item, run the same TDD loop as Full Mode (tester → architect on
   missing types → implementer → tester verify), then the **security-review gate**.
4. **Non-code phases are out of band.** Phase 0 (secret rotation), the secrets-
   manager / Redis-HA items in Phase 9, and any `[live]` item are operational —
   do NOT attempt them in the TDD loop. Surface them as a checklist for the human
   and STOP if a phase depends on one (e.g. don't build OAuth on un-rotated
   secrets).
5. Respect the conflict ledger: `configs/spicedb/main.zed` is authoritative;
   surface (don't silently resolve) the domain-object items in §4.C.
6. If a phase has work items but no failing test can express its acceptance
   (e.g. a pure schema reconciliation), first generate the missing scenarios via
   the `scenarios` skill, then implement — never implement security work without
   a regression test (audit §0.4).

## Security-review gate

After the tester verifies a scenario/work item that closes a Critical or High
audit finding, invoke the **reviewer** subagent (or the built-in
`/security-review`) focused on that finding's category before marking it done.
Block completion if: the fix lacks a regression test, a request-body ID is still
trusted without `CheckAccess`, a secret is introduced, or a retired domain object
reappears. Record the finding ID against the closed work item for traceability.

## Flags

- `--application-running`: Playwright tests against live app at `http://jouvae.local`
- `--group <letter>`: implement only scenarios in this group
- `--scenario <id>`: implement only this single scenario

## Files Mode vs Graph Mode

- Files mode: context from `docs/features/{feature}/scenarios/scenario-NNN/`
- Graph mode: context from Neo4j graph nodes

## Critical Rules

1. Tests ONLY make gRPC calls — never test internal methods.
2. Architect owns ALL types — tester and implementer never create types.
3. Sad path before happy path in every test function.
4. One scenario at a time per subagent invocation.
5. Independent scenarios run in parallel, dependent scenarios sequentially.
6. All pre-approved artifacts (protos, migrations, tests) are read-only.
7. Max 3 TDD iterations per scenario.
8. Escalation to architect pauses the scenario; resume after types are created.
9. SpiceDB schema (`configs/spicedb/*.zed`) and the `RelationName` enum are the architect's domain — escalate, never edit them in the tester/implementer loop. `main.zed` is authoritative; proto enums bend to it.
10. Every security fix carries a regression test (audit §0.4); Critical/High fixes pass the security-review gate before they count as done.
11. Operational / `[live]` items (secret rotation, secrets manager, Redis HA) are tracked as a human checklist, not implemented in the TDD loop.
