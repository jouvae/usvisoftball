---
name: grapher
description: Interface with project semantic memory via Neo4j graph database. Source of truth for graph-mode planning, implementation tracking, and organizational learning.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Interface with project semantic memory via Neo4j graph database. Source of truth for graph-mode planning, implementation tracking, and organizational learning.

## Related Commands

- `/graph add` — Add entity to graph
- `/graph status` — Check graph status
- `/graph query` — Query the graph
- `/graph report` — Generate reports

## Prerequisites

- NEO4J_URI (default: bolt://localhost:7687)
- NEO4J_USER (default: neo4j)
- NEO4J_PASSWORD

## Graph Schema

### Node Types

| Node | Properties |
|------|-----------|
| Spike | id, name, description, status, created_at |
| Scenario | id, name, feature, stack, priority, group, status, given, when_clause, then_clause |
| Task | id, name, description, domain, scope, acceptance_criteria, status, references |
| Plan | id, feature, version, status |
| Error | id, feature, category, description, severity, root_cause |
| Lesson | id, feature, date, description, applied_updates, suggested_updates |
| Rule | id, name, description, target_file, priority |
| Signal | id, type, description, source, timestamp |

### Key Relationships

| From | To | Type |
|------|----|------|
| Spike | Scenario | HAS_SCENARIO |
| Scenario | Task | HAS_TASK |
| Scenario | Scenario | BLOCKS (dependency) |
| Task | Task | BLOCKS (dependency) |
| Task | Error | HAS_ERROR |
| Scenario | Lesson | HAS_LESSON |
| Task | Rule | CONSTRAINED_BY |

## CLI Commands

- `init` — Initialize graph for a feature
- `add` — Add nodes (spike, scenario, task, etc.)
- `status` — Check status of feature/scenario/task
- `query` — Query graph with Cypher
- `report` — Generate report
- `do` — Execute graph operation
- `complete` — Mark node as complete
- `update` — Update node properties
- `error` — Record error
- `lesson` — Record lesson
- `signal` — Record signal
- `audit` — View history

## Workflow Integration

Used by plan, implement, qa, and improve skills for graph-mode operation.
