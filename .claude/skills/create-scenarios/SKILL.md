---
name: create-scenarios
description: Generate BDD scenarios from a spike document and persist them to an on-disk file tree or the Neo4j context graph.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Generate BDD scenarios from a spike document and persist them to an on-disk file tree or the Neo4j context graph.

## Scenario Quality Standard

- Write in standard Gherkin (Given/When/Then)
- Describe observable user/client behavior only
- Never include implementation details, proto fields, struct names, or DB operations
- Each scenario must be independently testable

## Valid Tasks Structure

Each scenario includes tasks with: id, description, domain (backend/frontend), scope, acceptance criteria, references, and estimated effort.

## End-to-End Testability Gate

Every scenario must be verifiable through either:
- Playwright e2e tests (frontend)
- Go gRPC client tests (backend)
- Manual testing (documented)

## Two Persistence Modes

### Files Mode (default)
Scenarios stored as markdown files in `docs/features/{feature}/scenarios/`.

### Graph Mode (--graph)
Scenarios stored as Neo4j graph nodes.

## Process

1. Select persistence mode
2. Validate spike document exists
3. Check for scenario-init.md (Init Mode vs Spike Mode)
4. Read context (spike, existing codebase patterns, template)
5. Generate scenarios covering all behaviors
6. Self-validate (completeness, consistency, testability)
7. Persist to chosen mode (files or graph)

## Critical Rules

1. One behavior = one scenario. Do not merge independent behaviors.
2. Every scenario must have authorization coverage (unauthenticated + permission-denied).
3. CRUD operations are separate scenarios.
4. Validation rules are part of the relevant CRUD scenario, not separate.
5. Error conditions are part of each scenario's success criteria.
6. Scenario names describe user/client perspective, not internal functions.
7. Do not inline implementation details (protos, structs, DB schemas) in scenario files.
8. Each scenario must reference pre-existing types/schemas in the codebase.
9. Keep scenario set minimal — typically 3-10 scenarios per feature.
10. Stack-specific IDs: `{feature}-go-NNN`, `{feature}-web-NNN`, `{feature}-e2e-NNN`.
11. Group scenarios by dependency: independent in Group A, dependent in subsequent groups.
