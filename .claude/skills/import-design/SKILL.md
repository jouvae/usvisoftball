---
name: import-design
description: Process externally authored design artifacts (protos, models, types, flows) from Claude Design and integrate them into the BDD feature pipeline.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Process externally authored design artifacts from Claude Design and integrate them into the BDD feature pipeline.

## Design Artifact Mapping

| Artifact Type | Target Location |
|---------------|-----------------|
| Proto definitions | `apis/protos/{service}/` |
| Domain models (Go) | `libs/go/postgres/migrations/` |
| TypeScript types | `clients/web/src/types/` |
| Design flows (md) | `docs/features/{feature}/` |
| Test files | `services/alpha/modules/{svc}/tests/` |

## Process

1. Download archive from URL
2. Extract and classify files by type
3. Stage artifacts to target locations
4. Generate spike document from design intent
5. Create scenarios from design artifacts
6. Run `/plan` to create code artifacts
7. Validate compilation

## Handling Ambiguity

- Placeholder types → flag for human review
- Conflicting definitions → preserve both, flag conflict
- Missing imports → add based on codebase conventions

## Validation Checklist

- All proto files compile
- All Go types build
- All TypeScript types type-check
- Test stubs exist for every scenario
- Spike document references every design artifact
