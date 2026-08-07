---
name: 3D Discover
description: Run the 3D flow's DISCOVER phase for a feature — understand the WHY. Ask the user for existing artifacts first, triage the tier, load scoped prior lessons, synthesize personas/crappies/happies, run event storming, and draft user-facing scenarios (each with data-validation expectations). Persists everything to Supabase. Invoke as /discover {group}/[{feature}/…]/{version} (e.g. /discover listings/search/v2 → feature 'listings_search_v2').
disable-model-invocation: true
argument-hint: "{group}/[{feature}/…]/{version}"
allowed-tools: ["Task", "Read", "Write", "Edit", "Bash"]
---

# 3D — Discover (understand the *why*)

Goal: produce a validated problem + the raw material Design will build against — **personas,
crappies (pains), happies (candidate solutions), an event-storm, and user-facing scenarios** — all
in **Supabase** (via the `3d-artifacts` skill). Give the human the wheel at each checkpoint. This
is the current ECA "Empathize", kept and slimmed. Full contract: `docs/features/3d/v1/3d-spec.md` §3.

**Feature identity.** `$ARGUMENTS` is a `/`-delimited path `{group}/[{feature}/…]/{version}` —
**group** first, **version** (`vN`) last. Derive the Supabase feature: **`name`** = the path with
`/`→`_` (e.g. `inspirations/v1`→`inspirations_v1`, `listings/search/v2`→`listings_search_v2`);
**`group`** = first segment; **`version`** = last segment. The feature's **doc folder** is
**`docs/features/{$ARGUMENTS}`** (slashes kept as nested dirs — organized by group, versioned).

## 0. Resume first (re-entrancy)
**First select the backend** per the `3d-artifacts` skill §Backend selection: `--local` (or
`THREEDFLOW_BACKEND`) forces it; else if the Supabase MCP is unavailable → **local SQLite**; else
**Supabase**. Everywhere this skill says "Supabase" means **the active backend** (the local SQLite
store at `clients/3dflow/db/3dflow.local.db` when local — same schema, via `local-db.mjs` /
the `local-artifact` subagent).

Read the feature's state from the active backend before anything (`3d-artifacts`): the `features` row
(found by `group` + `name`) + `status_board` + existing `scenarios`. If the feature exists, resume
from its `pipeline_state`; else create the `features` row (`group`, `name`, `version`,
`pipeline_state='discover'`, `backend`=<active>, `started_at=now()`).

## 1. Ask for existing artifacts (REQUIRED first action)
**Before generating anything, ask the human whether they already have** personas, event storms,
pain points, candidate solutions, research notes, sketches/Figma, or prior chat threads. **Ingest
whatever they provide** into Supabase rather than regenerating it. Only synthesize what's missing.

## 2. Triage (tier) — the first gate
Classify the feature's **default tier** (T1 Patrol / T2 Sortie / T3 Campaign) on reversibility ×
stakes + auto-escalation triggers (auth/money/PII/public-API/migration/security). Write
`features.default_tier` + `tier_source`. **Hybrid rule:** a scenario may later *escalate* above the
feature default, never lower it. Checkpoint **post-triage** (present + wait if selected).

## 3. Pre-flight: load scoped lessons
Query `lessons` for the **task-relevant slice only** (by domain + tags + same group, top-N by
recency×severity — never the whole corpus). Carry their guidance; record which applied.

## 4. Synthesize (research-synthesizer subagent)
Dispatch `research-synthesizer` with the human's raw research + mined codebase/issue/telemetry +
chaos signals. It returns **personas**, ranked **crappies** (`pain_level`, `impact_score` → generated
`severity`), and **happies**. Write them to Supabase + the relationship joins (feature↔persona↔
crappy↔happy). Research may arrive at any time — re-run as it lands.

## 5. Event storming (standard Discover step; depth scales with tier)
Run interactive Big-Picture event storming (actors → commands → domain events → policies →
aggregates → read models → hotspots). Grammar: events past-tense, commands imperative; every
"automatically/after N" is a policy. Hard-stop each pass for the human to refine. Persist to
`event_storms` (model jsonb + hotspots). This surfaces the open questions Design must weigh.
(Information Architecture is **NOT** here — it's a Design step.)

## 6. Draft user-facing scenarios
For each user-facing command→event pair, draft Given/When/Then into `scenarios`
(`lifecycle_state='modeled'`, `approval_state='draft'`). Write each **`then` as an observable
outcome** and capture its **`data_validation_expectations`** (jsonb) — these become the dcon spec
Deliver validates. Pure refactor/infra work gets no scenarios.

## 7. Problem statement + checkpoint (kill point)
Write/refresh the problem statement (depth per tier). Checkpoint **post-discover**: present the
validated problem + drafted scenarios and wait. **Kill is celebrated:** if research invalidates the
problem, record it (changelog + a `kill` metric) and close the feature — a first-class success.

## Always
- Write state to **the active backend** (Supabase, or the local SQLite store), not `status.md` (which
  is a pointer). Update the board every hand-off.
- Emit metrics (phase_entered/completed, kill/pivot) — the `metrics-writer` subagent handles writes on
  Supabase; in **local** mode write them to the local `metrics` table (via `local-artifact` /
  `local-db.mjs exec`).
- Surface any improvement opportunity you notice into `improvement_opportunities`.
- **Lessons live in the active backend's `lessons` table, not the repo** — query a SCOPED slice (by
  `domain`/`tags`/group, `limit 12`), never the whole table, and write new ones back there with
  `ladder_stage='observation'`. The repo holds only **ratified** rules in `.claude/rules/*.md`
  (`.claude/rules/LEARNING-LOOP.md`). Never write to `.opencode/` — that tree is legacy.

## Report
`Discover: {name} (tier {T}) — personas {n} · crappies {n} · happies {n} · event-storm
{passes}, {hotspots} open · scenarios {n} drafted · problem {validated|INVALIDATED→killed}.`
Next: `/design {$ARGUMENTS}` (or close, if killed).
