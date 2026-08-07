---
description: Creates a new flow doc in docs/flows/, derives its content from the live codebase, then updates any existing docs that should reference it.
---

# Create Flow Doc

You are entering flow documentation mode. Your job is to create a new, accurate flow doc for the **$1** flow and wire it into any existing docs that should know about it.

**User's description of the flow:** $2

## Phase 1 — Pre-flight Checks

1. Check whether `docs/flows/$1.md` already exists.
2. Confirm the `docs/flows/` directory exists.

## Phase 2 — Discover the Codebase

Using the user's description, systematically find relevant files:
1. **Entry points** — route handlers, API endpoints, UI components
2. **Backend logic** — gRPC handlers, HTTP handlers, service methods
3. **Shared infrastructure** — middleware, auth guards, cookies, queues
4. **Tests** — existing test files
5. **Related docs** — scan all files in `docs/flows/`

## Phase 3 — Draft the Flow Doc

Write `docs/flows/$1.md` following this structure:
- Overview
- High-Level Overview with ASCII flow diagram
- Prerequisites & Trigger Conditions
- Step-by-step (one file per step, inputs/outputs)
- Error States table
- Cookie / Token Reference
- Database / Redis Interactions
- Rate Limits & Security Controls
- Key File Index
- Related Flows

## Phase 4 — Update Existing Docs

For each existing doc related to this flow, add a reference.

## Phase 5 — Cross-reference Check

Verify every file in the Key File Index exists on disk.

## Phase 6 — Summary

```
✓ Created: docs/flows/$1.md
✓ Updated: [list]
```

## Behaviour Rules

- Read before you write
- Never fabricate file paths, function names, or error codes
- If the user's description conflicts with the code, trust the code

$ARGUMENTS
