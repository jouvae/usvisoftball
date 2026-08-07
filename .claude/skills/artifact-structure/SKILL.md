---
name: artifact-structure
description: The canonical ECA feature directory — the system of record. Defines the five required files (overview, scenarios, status, lessons, changelog), their schemas, and how to create or import a feature folder. Every ECA command reads and writes through this structure; subagents hand off exclusively through these files.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Define and template the **feature artifact directory** — the only channel through
which ECA commands and isolated subagents share state. Subagents have isolated
context windows and cannot share memory; they read inputs from these files and
write outputs back to them. **Artifacts are the memory.**

Read me whenever a command creates a feature, imports an existing one, or needs to
know the schema of a feature file.

## The directory

Every feature lives at:

```
docs/features/{group}/{feature}/
```

`{group}` is the domain (`identity`, `finance`, `calendar`, …); `{feature}` is the
kebab-case slug. A feature directory **must** contain these five files. The flow is
re-entrant: any command re-run reads `status.md` first to learn where things stand,
then does only the work that state implies.

| File | Owner phase | Role |
|---|---|---|
| `overview.md` | Triage / Empathize | Problem, users, scope, **tier + activation manifest**, design/RFC notes (depth scales with tier), research links |
| `scenarios.md` | Empathize | BDD Given/When/Then. **User-facing interactions only.** The `Then` clauses are the canonical data-consistency spec `dcon` validates against. Pure refactors/infra get none |
| `status.md` | every command | The re-entrancy anchor. Per-scenario lifecycle board + active tier + checkpoint opt-ins |
| `lessons.md` | AAR | Tier-tagged lessons captured during this feature's lifecycle (per-feature view; the durable corpus lives in the Supabase `lessons` table) |
| `changelog.md` | every command | Chronological record of decisions, kills/pivots, and gate results |

Two **Empathize-phase artifacts** appear when `/empathize` runs its standing
EventStorming + Information Architecture steps (5.5/5.6), owned by their own skills:

| File | Owner step | Role |
|---|---|---|
| `event-storming.md` | Empathize 5.5 (`event-storm` skill) | Interactive Big-Picture EventStorming model: actors, commands, domain events, policies, aggregates, read models, external systems, bounded contexts, and 🔴 hotspots. The shared domain model |
| `information-architecture.md` | Empathize 5.6 (`information-architecture` skill) | UX/product IA (screen & route inventory, navigation map, status model) + domain IA (bounded contexts, aggregate/entity map). The structure `/conceptualize` prototypes against |

Two more files appear when Actualize runs, owned by the existing pipeline — they are
**not** ECA-specific and are documented in their own skills: `plan.md` (scope
contract, `plan` skill) and `plan-review-{N}.md` (`qa` skill). `status.yaml`
(auto-generated test state, `status` skill) coexists with `status.md`; `status.md`
is the human/ECA board, `status.yaml` is the machine test-state mirror.

## Creating a feature

`/empathize` (or `/triage`) creates the directory by copying every file from
`docs/features/_template/` and filling `{feature-name}` / `{group}`. Never create a
partial directory — all five files exist from creation, even if mostly placeholder.

## Importing an existing / manual feature

A human can drop an existing folder under `docs/features/{group}/{feature}/` and run
the flow against it. To import:

1. Ensure the five files exist; copy any missing one from `_template/`.
2. Run `/triage {feature}` to classify the tier and write the activation manifest.
3. Run `/status {feature}` to render the board. The flow picks up from there.

## File schemas

### `overview.md`
```markdown
# {feature-name}

## Problem statement
{Why this exists. One sentence for T1; a paragraph for T2; full framing for T3.}

## Target users
{Who. Link personas in research notes.}

## Scope
**In:** {…}
**Out:** {…}

## Tier & activation manifest
<!-- Written by /triage. Downstream commands read this and activate ONLY what it names. -->
- **Tier:** T1 Patrol | T2 Sortie | T3 Campaign
- **Reversibility:** reversible | irreversible
- **Stakes:** low | high  (high uncertainty = high stakes)
- **Auto-escalation triggers fired:** {none | auth | money | PII | public-API | data-migration | security}
- **Active subagents:** {research-synthesizer?, dcon?, red-team-code?, red-team-interactive?, chaos?}
- **Active checkpoints:** {see status.md}
- **Required artifacts:** {design doc? prototype? full BDD traceability?}
- **De-escalation rationale:** {required and logged to lessons.md if the human lowered the auto-tier}

## Design / RFC notes
{Depth scales with tier: T1 none, T2 one page, T3 full RFC + two review passes.}

## Research
{Links to interviews, telemetry, chaos signals, prior lessons applied.}
```

### `status.md`
```markdown
# Status: {feature-name}

**Active tier:** {T1|T2|T3}   **Updated:** {YYYY-MM-DD}

## Checkpoints (human-in-the-loop)
<!-- Default: all selected. Unselected checkpoints proceed automatically. -->
- [x] post-triage
- [x] post-problem-statement
- [x] post-prototype / pre-build
- [x] pre-merge
- [x] pre-deploy

## Scenario board
<!-- One row per scenario. State machine:
     draft → prototyped → tests-backfilled → dcon-passed → red-team-passed → shipped
     (dcon-passed only for data-writing scenarios; non-user-facing work has no scenarios) -->
| Scenario | State | Notes |
|---|---|---|
| {feature}-web-001 | draft | |

## Open loops
{Backward loops in flight: red-team-failed → back to build, prototype flopped → back to empathize, etc.}
```

### `lessons.md`
Per-feature, tier-tagged. Mirrors the durable record written to the Supabase `lessons` table
by `/aar`. See the `aar` skill for the full lesson record schema. Minimum row:
```markdown
# Lessons: {feature-name}

| id | date | tier | category | what happened | what to do differently | status |
|---|---|---|---|---|---|---|
```

### `changelog.md`
```markdown
# Changelog: {feature-name}

<!-- Chronological. Record decisions, kills/pivots (celebrated outcomes), and gate results. -->
- {YYYY-MM-DD} — {event}
```

## Critical rules

1. **All five files exist from creation.** A feature with a missing required file is
   malformed — copy the missing file from `_template/` before proceeding.
2. **`status.md` is the re-entrancy anchor.** Every command reads it first and resumes
   from the recorded state. Never assume a clean forward pass.
3. **Scenarios are user-facing only.** Pure refactors/infra produce no `scenarios.md`
   rows — and therefore no `dcon`/BDD obligations.
4. **The `Then` clauses are the canonical spec.** `dcon` validates DB state against
   them and nothing else. Write them as observable outcomes, not implementation notes.
5. **Subagents communicate only through these files.** No out-of-band state. An agent's
   inputs come from the directory; its outputs go back to it.
