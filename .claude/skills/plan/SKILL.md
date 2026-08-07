---
name: plan
description: Planning phase skill. Creates code artifacts that make BDD scenarios implementable — protos, migrations, TS types, Go types, ID prefixes, route stubs, and test stubs.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Create all code artifacts that make BDD scenarios implementable — protos, migrations, TS types, Go types, ID prefixes, route stubs, and test stubs.

## Planning Sequence

1. Read scenarios
2. Architect creates types (protos, migrations, TS types, Go types, ID prefixes, route stubs)
3. Tester writes test stubs
4. Validate (proto compile, Go build, tests compile)
5. Update task references in graph or files

## What the Skill Creates

| Artifact | Location | Created by |
|----------|----------|-----------|
| Proto definitions | `apis/protos/{service}/` | architect |
| GORM migration types | `libs/go/postgres/migrations/` | architect |
| ID prefix constants | `libs/go/postgres/migrations/global.go` | architect |
| Go domain types | Within the relevant service module | architect |
| TypeScript types | `clients/web/src/types/` | architect |
| API route stubs | Dorothy gateway routes | architect |
| Test stubs | `services/alpha/modules/{svc}/tests/` | tester |

## Two Persistence Modes

### Files Mode (default)
- Scenarios read from `docs/features/{feature}/scenarios/`
- Artifacts written to filesystem
- Status tracked in `status.json`

### Graph Mode (--graph)
- Scenarios read from Neo4j graph
- Artifacts tracked via graph relationships
- Status tracked in graph node properties

## Create Mode Process

1. Determine mode (auto-detect or explicit)
2. Validate scenarios exist
3. Read existing scenarios and codebase patterns
4. Delegate type creation to architect
5. Delegate test writing to tester
6. Validate all artifacts compile
7. Update task references

## Update Mode

Applies QA review feedback:
- Address every Critical, no exceptions
- Edit only what the review flagged
- Never renumber existing scenario IDs
- Cross-domain consistency (proto → TS type sync)

## Critical Rules

1. Architect creates ALL types — never create types directly.
2. Tester creates ALL test stubs — never write tests directly.
3. Validate compilation before reporting success.
4. Read existing codebase patterns before creating new artifacts.
5. Proto first — all types derive from proto definitions.
6. Scenario names describe user/client behaviors, not internal functions.
7. Every scenario must include authorization coverage.
8. Test files go in `tests/` directory, not in `service/`.
