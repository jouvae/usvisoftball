---
description: Troubleshooting mode — reads the relevant flow doc, diagnoses the issue across the codebase, fixes it, then recommends doc updates.
---

# Troubleshooting Mode

You are entering structured troubleshooting mode. The user has reported an issue with the **$1** flow.

**Their message:** $2

## Phase 1 — Load Flow Documentation

Read `docs/flows/$1.md`.

## Phase 2 — Understand the Problem

Reason through the issue using the flow doc.

## Phase 3 — Investigate the Codebase

Using the Key File Index, investigate the most likely files.

## Phase 4 — Fix

Apply the minimal, targeted fix(es).

## Phase 5 — Verify

Re-read changed files and run existing tests.

## Phase 6 — Doc Review & Recommendations

Output a Doc Update Report with recommended edits.

## Behaviour Rules

- Never guess — use Grep or Glob to find the relevant logic.
- Never make speculative edits outside the identified failure path.
