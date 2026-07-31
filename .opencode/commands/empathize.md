---
description: ECA Phase 1 (Empathize) — understand the why. Loads prior lessons FIRST, synthesizes human-supplied research + chaos/telemetry signals into personas/journeys/pains via the research-synthesizer subagent, runs an interactive EventStorming session, distils an Information Architecture artifact, drafts user-facing BDD scenarios, and writes the problem statement. "Problem invalidated" is a celebrated kill that closes the feature.
---

# Empathize Command

Drive the **Empathize** phase: understand the *why* before anything is built.
Human-driven research, agent-synthesized. Re-entrant — reads `status.md` first.

## Inputs

- Feature: `$1` (`{group}/{feature}` slug or a description)
- `--scope lt|md|hi` (default `lt`) — **research depth**, independent of tier.
  `lt` = mine what exists + one synthesis pass; `md` = + interview guides/surveys
  drafted and corroborating telemetry mined; `hi` = + multi-source triangulation,
  stakeholder map, and explicit invalidation attempts. Scope and tier inform each
  other but are separate knobs (tier governs downstream process weight).

## Procedure

### Step 1 — Create or resume the feature

If the directory is missing, create it from `docs/features/_template/` (see the
artifact-structure skill) and slug the feature. Otherwise read `status.md` and
resume from the recorded state.

### Step 2 — Triage first

Run `/triage {feature}` (the tier-classification skill) before research, so the
manifest governs how much apparatus this feature earns. Re-run triage if scope shifts
during empathy work.

### Step 3 — Load prior lessons (AUTOMATIC, before any new research)

Read `.opencode/lessons/index.md` and the per-agent rules, and surface lessons
relevant to this feature by **domain/problem similarity** (match on group, service,
and problem keywords). List the applicable lesson ids in `overview.md` §Research and
carry their guidance into the work. This is the pre-flight half of the learning loop
(see `.opencode/rules/LEARNING-LOOP.md`). A feature that references a prior lesson
counts toward the lessons-applied metric.

### Step 3.5 — Consult & reconcile the entity registry (`docs/entities.md`)

`docs/entities.md` is the **canonical, versioned registry of every platform entity
definition** (mental model, core entities, authz schema, changelog). It is a
first-class **input and output of every ECA phase**, not just this one.

- **Consult it first.** Before synthesizing, read the entity sections relevant to the
  feature so research is grounded in the *current* definitions (and so a "new" idea
  isn't already defined under another name). Note in `overview.md` §Research which
  entities this feature touches.
- **Reconcile it as discoveries land.** When the work introduces a new entity, renames
  one, changes a relationship/lifecycle, or supersedes a definition, **update
  `docs/entities.md`** — add the entity or amend the definition — and append a dated
  `Appendix A. Changelog` entry. Mark anything not yet ratified as *proposed —
  {feature} {phase}; ratify in /plan*. This continues through `/conceptualize` and
  `/actualize`; definitions are expected to evolve across phases.

### Step 4 — Ingest raw research + signals

Accept whatever the human supplies — interview notes, links, sketch/Figma
screenshots, ChatGPT/Claude threads — at any time. Also ingest **monitoring/chaos
signals** (from the chaos-monitor subagent, written under the feature dir or
`docs/features/{group}/{feature}/signals/`) as first-class research signals. The
human gathers; you synthesize.

### Step 5 — Synthesize

Dispatch the **research-synthesizer** subagent with the raw research + mined
codebase/issue/telemetry signal. It returns personas, journey maps, ranked pain
points, and an empathy/stakeholder view, and (on `--scope md|hi`, or on request)
interview guides and survey questions. Write its outputs into `overview.md` and
`docs/features/{group}/{feature}/research/`.

### Step 5.5 — Interactive EventStorming (STANDING STEP — `event-storm` skill)

Run the **`event-storm` skill** (`/event-storm {group}/{feature}`) as a **live
back-and-forth with the human in the main conversation** — propose the actors,
commands, domain events, policies, aggregates, read models, external systems, and
hotspots one pass at a time, hard-stopping after each pass for the human to refine,
until the model is shared and "good enough to prototype against." Persist it to
`event-storming.md`. This converts the synthesized *why* into a concrete domain model
and surfaces open questions (hotspots) the problem statement and `/triage` must weigh.
Grammar is enforced (events past-tense, commands imperative; every "automatically/after
N hours" is a policy). Re-entrant — resume from the last recorded pass.

### Step 5.6 — Information Architecture (STANDING STEP — `information-architecture` skill)

Run the **`information-architecture` skill** (`/information-architecture
{group}/{feature}`) to distil `event-storming.md` (+ research + `docs/entities.md` +
any `uxui.md`/`spec.md` companion) into `information-architecture.md` — **two halves**:
UX/product IA (screen & route inventory, navigation map, per-surface content, status
model) and domain IA (bounded contexts, aggregate/entity map, cross-context events).
Every screen traces to a read model; every entity to an aggregate. This is the
structure `/conceptualize` prototypes against, so the prototype builds the right thing.

### Step 6 — Draft user-facing BDD scenarios

Using the `scenarios` skill, draft Given/When/Then scenarios into `scenarios.md` for
**user-facing interactions only** — drawing directly on the `event-storming.md`
commands/events (each user-facing command→event pair is a candidate scenario) and the
`information-architecture.md` screens. The `Then` clauses are the canonical spec `dcon`
will later validate — write them as observable outcomes. Pure refactor/infra work
gets no scenarios. Set new rows to `draft` on the `status.md` board.

### Step 7 — Problem statement

Write/update the problem statement in `overview.md` (depth per tier).

## Kill point (celebrated)

If research **invalidates the problem**, that is a first-class success. Record it in
`changelog.md`, close the feature, and run `/aar {feature}` to capture why. Do not
treat a kill as failure.

## Checkpoint

**post-problem-statement** (default on): present the validated problem + drafted
scenarios and wait. This is also the empathize kill point. If unselected, proceed.

## On phase boundary / error

Run `/aar {feature}` automatically when this phase completes, at the kill point, and
if an error is hit and resolved mid-session (so the next session doesn't repeat it).

## Always update status (automatic — never wait to be asked)

A task is not done until the feature docs reflect it. At every hand-off / hard-stop,
phase completion, gate result, and kill/pivot — and BEFORE you report back — update the
feature docs yourself, without being prompted:

1. **`status.md`** — set `**Updated:**` to today's absolute date and `**Phase:**` to the
   current phase; refresh the scenario-board states; and keep a current top-of-file
   **▶ SESSION HANDOFF (<date>)** block: the one-line state, what's DONE, the single exact
   NEXT step, and branch + build/verification state — so a fresh session with no memory of
   this conversation can resume from it alone.
2. **`changelog.md`** — append a dated entry for what changed, was decided, or was verified
   (including kills/pivots and gate results).

This is a standing requirement, not something the user should have to request. (A full
session-clear that also writes durable memory is still `/checkpoint`; these in-repo status
docs stay current every time regardless.)

## Report

```
## Empathize: {group}/{feature}   (scope: {lt|md|hi}, tier: {T1|T2|T3})

- Prior lessons applied: {ids|none}
- Personas / journeys / pains: {written to overview.md + research/}
- Event storming: {passes complete → event-storming.md} ({N} hotspots open)
- Information architecture: {screens + contexts → information-architecture.md}
- Scenarios drafted: {N user-facing} (or "none — not user-facing")
- Problem: {validated | INVALIDATED → killed}

Next: /conceptualize {feature}   (or close, if killed)
```

## Constraints

- Load lessons before new research — always.
- **Consult `docs/entities.md` before synthesizing, and update it (with a changelog
  entry) whenever a definition changes** — it is the canonical entity registry and a
  living input/output of every phase.
- **Run EventStorming (Step 5.5) and Information Architecture (Step 5.6) as standing
  steps** between synthesis and scenarios — EventStorming is interactive (hard-stop per
  pass; the human refines), IA is derived from it. These artifacts feed `/conceptualize`.
- Draft scenarios only for user-facing interactions.
- You synthesize; the human gathers. Do not invent research findings.
- Do not write implementation or prototype code here.
- Draft scenarios only for user-facing interactions.
- You synthesize; the human gathers. Do not invent research findings.
- Do not write implementation or prototype code here.
- Keep `status.md` + `changelog.md` current at every hand-off automatically — never make the
  user ask for a status update.
