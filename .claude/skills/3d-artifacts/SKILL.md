---
name: 3D Artifacts (Supabase CRUD)
description: Read/write 3D-flow artifacts (features, personas, crappies, happies, scenarios, phase results, models, lessons, metrics, improvement opportunities) in Supabase — the flow's sole datastore. Use whenever a 3D phase skill (/discover, /design, /deliver) needs to create, update, or QUERY A SCOPED SLICE of flow state instead of loading large markdown. Always query the minimal slice; never SELECT * whole tables into context.
user-invocable: false
allowed-tools: []
---

# 3D Artifacts — the flow's shared memory (Supabase)

Supabase is the **sole datastore** for 3D-flow state. This skill is how any agent CRUDs it,
via the **Supabase MCP** tools (surfaced at runtime through tool-search, e.g. an SQL-exec /
apply-migration tool). Schema: `clients/3dflow/db/schema.sql`. Entities & rules: `docs/features/3d/v1/3d-spec.md` §4.

## The one rule: query the scoped slice, never the whole table

Context economy is the whole point of putting artifacts here (crappies C2/C5). Every read is a
**narrow, filtered** query — by `feature_id`, `scenario_id`, `domain`, `tags`, `status`, or a
`limit` — returning only the columns needed. Do **not** pull entire tables or `SELECT *` broad
result sets into context. If you need a summary, use the `status_board` view or an aggregate.

## Backend selection — Supabase MCP, or the local SQLite fallback

The store has **two interchangeable backends behind the SAME schema**
(`clients/3dflow/db/schema.sql` Postgres · `clients/3dflow/db/schema.sqlite.sql` SQLite):

- **Supabase (default)** — Supabase MCP `execute_sql`, delegated via the `supabase-artifact` /
  `metrics-writer` subagents.
- **Local SQLite (offline fallback / on request)** — a single **gitignored** repo-level store at
  `clients/3dflow/db/3dflow.local.db`, driven by `clients/3dflow/db/local-db.mjs` (better-sqlite3),
  delegated via the **`local-artifact`** subagent (Bash). `local-db.mjs exec "<SQL>" '<paramsJSON>'`
  is the local twin of `execute_sql` — same tables, same SQL surface.

**Choose the backend, in order:** (1) explicit — `--local` / `--supabase` on the phase command, or
`THREEDFLOW_BACKEND=local|supabase`; (2) else if the Supabase MCP is unavailable (no
`mcp__supabase__*` binding) → **local**; (3) else → **supabase**. Persist the choice on
`features.backend` so a feature stays on ONE backend for its lifetime (never split a feature's
artifacts across stores); at Step-0 resume, read from that feature's backend.

**Local usage (SQLite).** Once: `node clients/3dflow/db/local-db.mjs init`. Then
`node clients/3dflow/db/local-db.mjs exec "<SQL>" '<paramsJSON>'` (params = JSON array for positional
`?`, or object for named `:name`; pass SQL from stdin with `exec -` for complex statements), and
`… resume <group> <name>` for the Step-0 slice. **SQLite dialect deltas** (write SQLite-flavored SQL
in local mode): `jsonb`→TEXT holding a JSON string (pass JSON as a string param; no `::jsonb` casts) ·
`lessons.tags text[]`→TEXT JSON array (filter via `json_each`/`like` or in the caller) · `boolean`→0/1
· `now()`→`CURRENT_TIMESTAMP` · id/`gen_random_*` handled by the schema `DEFAULT`. `RETURNING`,
`ON CONFLICT`, the generated `severity`, and the `status_board` view all work locally.

## Entities (tables)

`features` (identity: `name` = the flow path `{group}/[{feature}/…]/{version}` with `/`→`_`, e.g.
`listings_search_v2`; `"group"` = first segment; `version` = last segment `vN`; unique on
(`group`,`name`)) · `personas` · `crappies` (pain; `severity` = pain×impact, generated) · `happies` ·
`event_storms` (Discover) · `information_arch` (Design) · `models` (lock state) · `scenarios`
(`then` = the dcon expectation; `lifecycle_state`, `approval_state`, `tier_override`) ·
`scenario_phase_results` (per-phase results) · `entities` (canonical domain registry — `kind`
`entity`|`context`, `status` canonical/proposed/superseded, `authz_schema`, `section_no` doc anchor;
Design MUST align to it) · `lessons` (scoped retrieval + audit) · `metrics` ·
`improvement_opportunities` · relationship joins (`feature_personas`, `feature_crappies`,
`feature_happies`, `crappy_happy`, `scenario_links`) · `actions`/`insights` (future-campaign seams) ·
`board_notes` + `status_board` (view).

## Common operations (illustrative SQL — run via the Supabase MCP)

- **Resume a feature (re-entrancy):**
  `select * from status_board where feature_id = :fid;`
  `select slug, lifecycle_state, approval_state from scenarios where feature_id = :fid;`
- **Scoped lesson pre-flight (§7.3):** by domain + tags + group, top-N by recency×severity —
  `select id, content, tags from lessons where archived_at is null and (domain = :domain or tags && :tags) order by created_at desc limit 12;`
- **Entity alignment slice (Design):** read only the entities a decision touches —
  `select section_no, name, status, summary, body, authz_schema from entities where kind='entity' and slug = any(:slugs);`
  New/changed entity → `insert into entities (kind,name,slug,section_no,status,source_feature,body) values ('entity',:name,:slug,:section_no,'proposed',:feature,:body);` (never edit `docs/entities.md`).
- **Advance a scenario + record phase result:**
  `update scenarios set lifecycle_state = :next where id = :sid;`
  `insert into scenario_phase_results (scenario_id, phase, status, result, artifact_ref) values (...);`
- **Write a metric (written by the `metrics-writer` subagent via MCP — decision (b), no service key):**
  `insert into metrics (feature_id, event_type, tokens_in, tokens_out, duration_ms, agent, model, payload) values (...);`
- **Surface an improvement opportunity:**
  `insert into improvement_opportunities (source, source_ref, title, description, rationale, suggested_change) values (...);`

## Invariants

- **Never hard-delete a lesson.** Prune = set `archived_at` + `archive_reason`.
- **status.md is not the source of truth** — the board lives here; the local file is a pointer
  (a hook enforces this once activated).
- **Model-lock:** do not modify a `models` row where `locked = true` without a matching
  `approval_token` — request explicit human instruction first (a hook enforces this once activated).
- **Entity alignment:** all feature changes MUST align with the `entities` registry. New/changed
  entities are written as `status='proposed'`; promotion to `canonical` (or `superseded`) needs
  explicit human ratification. `docs/entities.md` is a pointer — edit the table, never the doc.
- **Hybrid tier:** a `scenarios.tier_override` may only *escalate* above the feature's
  `default_tier`, never lower it.
- Heavy or multi-step queries → delegate to the `3d-supabase-artifact` subagent (isolated context).
