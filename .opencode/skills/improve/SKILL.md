---
name: improve
description: Close the learning loop. Default mode captures lessons from a feature's qa/fix cycle and promotes rules (gated). --consolidate mode runs the Verify & Prune pass (dedup, retire, graduate, gate, budget). Governed by .opencode/rules/LEARNING-LOOP.md.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Close the learning loop defined in [`.opencode/rules/LEARNING-LOOP.md`](../../rules/LEARNING-LOOP.md).
Two modes: **Capture** (default — turn a feature's failures into gated rules) and
**Consolidate** (`--consolidate` — the Verify & Prune pass that keeps the rule
corpus lean and honest). Read `LEARNING-LOOP.md` before running; it owns the rule
schema, the maturity ladder, and the promotion/verify/prune policies.

## Mode: Capture (default)

1. Read every `plan-review-*.md`, the scenarios directory, and the prior
   `.opencode/lessons/` for this feature's lineage.
2. Classify each issue into the error taxonomy:
   - SCHEMA_MISMATCH — Proto/migration/`.zed` field misalignment
   - MISSING_TEST — Scenario without test coverage
   - TEST_RULE_VIOLATION — Test pattern violation
   - CONVENTION_VIOLATION — Code convention not followed
   - SCOPE_CREEP — Implementation beyond agreed scope
   - MISSING_ARTIFACT — Referenced file doesn't exist
   - DEPENDENCY_ERROR — Dependency ordering mistake
   - SECURITY — auth/authz/secret/session/injection finding (cite the audit id)
   - IMPLEMENTATION_GAP / TYPE_ERROR — partial/incorrect implementation
3. **Update recurrence first.** For every existing rule in
   `.claude/metrics/aggregated/rule-effectiveness.json`, check whether its target
   error reappeared this feature. If yes → `recurrences_after += 1`,
   `features_clean = 0` (the rule is INEFFECTIVE — flag for rewrite/gate). If the
   error did NOT reappear and the rule is `binding` → `features_clean += 1`.
4. **Promote, gated** (see `LEARNING-LOOP.md` promotion policy):
   - New observation → `provisional` rule record in `.opencode/rules/agents/{agent}.md`.
   - `provisional` → `binding` only if it recurred in ≥2 features OR is a confirmed Critical.
   - Write rules as **records** (the `R-{agent}-{slug}` schema), never as inline
     prose appended to the agent's instruction file.
   - Add a matching entry to `rule-effectiveness.json`.
   - **Security rules and edits to shared agent files are reviewable** — list them
     under `suggested_updates` and let the human / security-review gate ratify
     before they go `binding`.
5. Compute quality, efficiency, behavioral, and trajectory metrics.
6. Root-cause analysis for each Critical issue.
7. Write the date-stamped lessons file to `.opencode/lessons/` and update
   `.opencode/lessons/index.md`.
8. Run `.claude/scripts/rule-stats.sh` and include its output in the report so
   ineffective/graduating/over-budget rules are visible.

## Mode: Consolidate (`--consolidate`)

The Verify & Prune pass. Run every ~5 features, or whenever `rule-stats.sh`
reports a per-agent file over budget or any INEFFECTIVE rule. Apply
`LEARNING-LOOP.md` prune policy:

1. **Dedup** overlapping rules in each `.opencode/rules/agents/{agent}.md` into one.
2. **Rewrite or gate INEFFECTIVE rules** (`recurrences_after > 0`): tighten the
   trigger, or if mechanically checkable, port to `.claude/scripts/*.sh` + CI and
   set `status: gated`.
3. **Graduate VALIDATED rules** (`binding` & `features_clean >= 3`): merge into the
   canonical standard (`.opencode/rules/go-standard.md` / `data.md`), delete the
   per-agent record, set `status: validated` in the json.
4. **Delete RETIRED tombstones** older than one consolidation cycle.
5. **Enforce the budget** (~40 active records / ~1500 tokens per agent file):
   drop the lowest-value provisional rules (oldest, never-recurred, low-confidence)
   and log what was dropped.
6. Update `rule-effectiveness.json`, the lessons index, and report a before/after
   record count per agent.

Consolidate NEVER deletes lessons files (the audit trail) — it prunes *rules*.

## Lessons File Format

```markdown
---
date: YYYY-MM-DD
feature: feature-name
iteration_count: N
final_verdict: PASS|NEEDS_REVISION|FAIL
critical_count: N
warning_count: N
applied_updates:
  - file: path/to/file.md
    change: description
suggested_updates:
  - target: path/to/file.md
    reason: description
---

## Summary

## Root Cause Analysis

### Critical Issues

### Persistent Patterns

## Metrics

## Rule Updates Applied
```

## Critical Rules

1. Never fabricate error types — only classify what you find.
2. High-confidence rule updates only — if uncertain, leave `provisional` / add to `suggested_updates`.
3. Update the lessons index AND `rule-effectiveness.json` after every run.
4. Promote `provisional` → `binding` only when the error recurred in ≥2 features OR is a confirmed Critical.
5. Persist every finding — even resolved issues go in the lessons file. Never delete a lessons file.
6. Rules are **records** (`R-{agent}-{slug}`) in `.opencode/rules/agents/`, never inline prose in agent instruction files.
7. A binding rule must have a falsifiable trigger. If you can't state how the error would be detected, keep it provisional.
8. The loop must shrink as well as grow — if a `--consolidate` pass graduates/retires nothing while files are over budget, that's a failure to report, not skip.
