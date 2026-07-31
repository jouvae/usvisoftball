---
name: status
description: Schema and regeneration rules for docs/features/{feature}/status.yaml. Auto-generated from embedded scenario blocks; never hand-edited.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Define the schema and regeneration rules for `docs/features/{feature}/status.yaml`, which is auto-generated from embedded scenario blocks.

## YAML Schema

```yaml
feature: string
created: date
updated: date
scenarios:
  - id: scenario-id
    stack: go|web|e2e
    priority: P0|P1|P2
    group: A|B|C|...
    status: pending|scaffolded|red|green|refactored|done
    tasks:
      - id: task-id
        domain: backend|frontend
        status: pending|in_progress|completed
```

## Status Precedence

pending → scaffolded → red → green → refactored → done

## Regeneration

Run `bash .claude/scripts/scenario-status.sh {feature}` to regenerate.

## When to Regenerate

- After any test file is created or modified
- After scenario blocks are embedded or updated
- After scenario status changes

## Hard Rules

1. Never edit status.yaml directly — always regenerate via the script.
2. The script is the single writer of status.yaml.
3. status.yaml is committed to the repo.
4. Stale status.yaml is OK (regenerate on demand); wrong status.yaml is not.
