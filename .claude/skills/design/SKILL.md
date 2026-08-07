---
name: 3D Design
description: Run the 3D flow's DESIGN phase for a feature — the WHAT, rapidly. Node 1 Model+IA (domains/entities/contracts + UX information architecture), then LOCK the model. Node 2 Prototype — rapid, buildable slices on MOCKED data with NO dcon, in the live app. Persists to Supabase; enforces model-lock + re-approval gating. Invoke as /design {group}/[{feature}/…]/{version} (e.g. /design inspirations/v1 → feature 'inspirations_v1').
disable-model-invocation: true
argument-hint: "{group}/[{feature}/…]/{version}"
allowed-tools: ["Task", "Read", "Write", "Edit", "Bash"]
---

# 3D — Design (the *what*, rapidly)

Goal: turn Discover's *why* into a locked **Model + Information Architecture**, then **prototype
buildable slices as fast as possible on mocked data**. Buildable ≠ shippable — Deliver makes it
real. Two nodes. Full contract: `docs/features/3d/v1/3d-spec.md` §3 (Design). State in Supabase via
`3d-artifacts`.

**Feature identity.** `$ARGUMENTS` is a `/`-delimited path `{group}/[{feature}/…]/{version}` —
**group** first, **version** (`vN`) last. Supabase **`name`** = the path with `/`→`_` (e.g.
`inspirations/v1`→`inspirations_v1`, `listings/search/v2`→`listings_search_v2`); **`group`** = first
segment; **`version`** = last segment; **doc folder** = `docs/features/{$ARGUMENTS}` (nested by group,
versioned). **Resume first**: read the feature (by `group` + `name`) + `models` + `scenarios` from
Supabase.

## Node 1 — Model + Information Architecture
You may only design once Discover has established the wants/needs (that's why IA lives here, not in
Discover).
- **Contracts (architect subagent):** domains, entities, protos/types, **goose SQL migrations**, ID
  prefixes, authz schema, route stubs. The `architect` owns ALL contracts; it never writes tests/impl.
  A schema contract is a numbered migration in `data/migrations/{service}/` (Up + Down) plus the
  service-owned GORM model that maps to it — **never** a new registration in `doAutoMigrations`
  (`gorm.AutoMigrate` is frozen legacy; see `.claude/rules/data.md`).
- **Information Architecture:** screen & route inventory, navigation map, per-surface content, status
  model. **Every screen traces to a read model; every entity to an aggregate.** Write to
  `information_arch`; link `models.ia_ref`.
- **Entity alignment** (hard gate below): every domain/entity in the contracts and every
  screen/aggregate in the IA **must trace to a canonical row in the Supabase `entities` table**.
  Reconcile *there*, not in `docs/entities.md` (now a pointer to the table).

### ⚖️ Entity alignment (hard gate — applies to every design decision)
**All feature changes MUST align with the entity definitions in the Supabase `entities` table** —
the canonical domain registry (migrated from `docs/entities.md`). Query the **scoped slice** via
`3d-artifacts` (`kind='entity'`, by `slug` / `section_no` / `status`), never the whole table.
- **Read before deciding:** for every domain, entity, aggregate, or authz relation the contracts or
  IA touch, read its `entities` row(s). Information-architecture and system-architecture decisions
  must be **inline with those definitions** (fields, relationships, lifecycle, SpiceDB `authz_schema`).
- **Conform, don't diverge:** a design decision that contradicts a `canonical` entity definition is
  **blocked** until either the design is corrected, or the definition is deliberately changed.
- **Write back:** when the design introduces or changes an entity, **update the `entities` table** —
  insert/revise the row as `status='proposed'` with `source_feature={group}/…/{version}` and a stable
  `section_no`. Promoting `proposed`→`canonical` (or marking `superseded`) needs **explicit human
  ratification** (as `docs/entities.md` always required). Never edit the doc; edit the table.
- **At lock time** the Model+IA and every `entities` row it depends on must be consistent.

### 🔒 Model-lock (first-class gate)
When the human agrees the Model+IA, **LOCK it** in Supabase: set `models.locked=true`,
`locked_at=now()`, and record the locked artifacts' path globs in `models.locked_globs` (text[],
repo-relative — the model-lock hook reads these to block unapproved edits). **After locking, you
MUST request explicit human instruction before changing any locked-model artifact.** Checkpoint
**post-prototype/model-lock**.

### ⚠️ Access-model credential-feasibility (check BEFORE locking a datastore access model)
When the Model+IA locks an **access model that depends on a credential** (service key, service_role,
API secret, signed token), confirm the **verify + deploy environment can actually obtain that
credential** before locking — otherwise Deliver stalls: it can't self-verify (violating the
3-checks-before-human rule) and needs a human to hand over a secret. Prefer **least-privilege keys the
flow can self-serve** (e.g. a publishable/anon key + narrow read-only RLS over a service_role key +
"RLS stays closed") — they are both self-verifiable and lower blast-radius. Record the credential the
chosen model needs and where it comes from. (Lesson from `3d/v2` dogfood: the locked service_role
model was infeasible because the Supabase MCP exposes only publishable keys — Deliver pivoted to
publishable + read-only RLS.)

### Re-approval gating
Editing a **locked Model+IA** or an **approved scenario** re-opens its gate: set the scenario's
`approval_state='reopened'`, invalidate its downstream `scenario_phase_results`, and **block forward
jumps** until re-approved. (This is the backlog's "redo scenarios first, then change the logic".)

## Node 2 — Prototype (rapid, buildable, mocked)
A **primary goal of Design is to prototype as fast as possible.** Reuse the existing live
environment — do **not** rebuild it: `next dev` hot-reload on :3000, the `/proto` engine, the
dorothy proxy for real auth in e2e. Prototype against the current app or greenfield, one visible
slice at a time; hard-stop for the human to confirm each slice in the browser.
- **Buildable = compiles/runs on MOCKED data, NO dcon.** Do not wire the real backend here — mocks
  keep iteration fast. Mark each confirmed slice's scenario `lifecycle_state='prototyped'`.
- **If a slice touched Go, run `go-qa-reviewer` (`PHASE=design`) before marking it prototyped.** It
  reviews correctness, contracts, and standards conformance and returns a fix order you hand to
  `go-implementer`. At this phase it will **not** fault the slice for being a prototype — mocked data
  and unwired backends are the point — so its findings are real defects worth fixing now, while they
  are cheap. Load, dcon, and security stay in Deliver.
- **Kill/pivot is celebrated:** "the prototype flopped / users didn't want it" is a first-class,
  recorded outcome (changelog + a `pivot` metric), not a failure.

## Always
- State → **Supabase** (board is canonical; `status.md` is a pointer). Update the board each hand-off.
- **Every design decision aligns with the `entities` registry** — read the scoped slice before
  deciding, conform IA/architecture to canonical definitions, and write new/changed entities back as
  `proposed` (⚖️ gate above).
- Emit metrics; surface `improvement_opportunities` as you learn.
- Do not run dcon, load, or security here — those are Deliver.
- **Lessons and metrics go to SUPABASE, not the repo** (`lessons` / `metrics` rows via
  `3d-artifacts` + `metrics-writer`). The repo holds only ratified rules in `.claude/rules/*.md`.
  Never write to `.opencode/`.

## Report
`Design: {name} — Model+IA {locked?} · scenarios prototyped {n}/{total} · {kills/pivots}.`
Next: `/deliver {$ARGUMENTS}` (wires the buildable slices to the backend and hardens them).
