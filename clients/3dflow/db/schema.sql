-- 3D-flow canonical schema — Postgres / Supabase dialect.
-- This is the file the `3d-artifacts` skill references (clients/3dflow/db/schema.sql). It was
-- NOT present in the imported tooling; reconstructed from the skill's entity set. Its SQLite
-- twin is schema.sqlite.sql (the local/offline backend). Keep the two in lockstep.
--
-- Dialect deltas vs SQLite: jsonb (vs TEXT+JSON) · lessons.tags text[] (vs TEXT JSON array) ·
-- boolean (vs INTEGER 0/1) · now() (vs CURRENT_TIMESTAMP) · gen_random_bytes ids (pgcrypto).
-- Apply on Supabase via the MCP apply-migration/execute-sql, or `psql -f` on the direct DB URL.

create extension if not exists pgcrypto;

-- ── features ────────────────────────────────────────────────────────────────────────
create table if not exists features (
  id             text primary key default ('ftr_' || encode(gen_random_bytes(8),'hex')),
  "group"        text not null,
  name           text not null,
  version        text not null,
  pipeline_state text not null default 'discover',
  default_tier   text,
  tier_source    text,
  problem        text,
  backend        text not null default 'supabase',
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  paused_at      timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique ("group", name)
);

-- ── Discover artifacts ───────────────────────────────────────────────────────────────
create table if not exists personas (
  id text primary key default ('per_' || encode(gen_random_bytes(8),'hex')),
  name text not null, role text, description text, goals jsonb,
  created_at timestamptz default now()
);
create table if not exists crappies (
  id text primary key default ('crp_' || encode(gen_random_bytes(8),'hex')),
  description text not null,
  pain_level numeric not null default 0,
  impact_score numeric not null default 0,
  severity numeric generated always as (pain_level * impact_score) stored,
  created_at timestamptz default now()
);
create table if not exists happies (
  id text primary key default ('hap_' || encode(gen_random_bytes(8),'hex')),
  description text not null, created_at timestamptz default now()
);
create table if not exists event_storms (
  id text primary key default ('evs_' || encode(gen_random_bytes(8),'hex')),
  feature_id text not null references features(id) on delete cascade,
  pass int not null default 1, model jsonb, hotspots jsonb,
  created_at timestamptz default now()
);

-- ── Design artifacts ─────────────────────────────────────────────────────────────────
create table if not exists information_arch (
  id text primary key default ('iar_' || encode(gen_random_bytes(8),'hex')),
  feature_id text not null references features(id) on delete cascade,
  content jsonb, created_at timestamptz default now()
);
create table if not exists models (
  id text primary key default ('mdl_' || encode(gen_random_bytes(8),'hex')),
  feature_id text not null references features(id) on delete cascade,
  content jsonb, locked boolean not null default false, approval_token text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- ── Scenarios + per-phase results ──────────────────────────────────────────────────
create table if not exists scenarios (
  id text primary key default ('scn_' || encode(gen_random_bytes(8),'hex')),
  feature_id text not null references features(id) on delete cascade,
  slug text not null, title text, "given" text, "when" text, "then" text,
  data_validation_expectations jsonb,
  lifecycle_state text not null default 'modeled',
  approval_state  text not null default 'draft',
  tier_override text, priority text, grp text, stack text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (feature_id, slug)
);
create table if not exists scenario_phase_results (
  id text primary key default ('spr_' || encode(gen_random_bytes(8),'hex')),
  scenario_id text not null references scenarios(id) on delete cascade,
  phase text not null, status text, result jsonb, artifact_ref text,
  created_at timestamptz default now()
);

-- ── Canonical domain entity registry ────────────────────────────────────────────────
create table if not exists entities (
  id text primary key default ('ent_' || encode(gen_random_bytes(8),'hex')),
  kind text not null default 'entity', name text not null, slug text not null,
  section_no text, status text not null default 'proposed', authz_schema jsonb,
  source_feature text, summary text, body text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (kind, slug)
);

-- ── Lessons (scoped retrieval + audit) ──────────────────────────────────────────────
create table if not exists lessons (
  id text primary key default ('les_' || encode(gen_random_bytes(8),'hex')),
  "group" text, feature text, domain text, tags text[], tier text, category text,
  content text not null, severity numeric default 0,
  ladder_stage text not null default 'observation',
  archived_at timestamptz, archive_reason text, created_at timestamptz default now()
);

-- ── Metrics + improvement opportunities ─────────────────────────────────────────────
create table if not exists metrics (
  id text primary key default ('mtr_' || encode(gen_random_bytes(8),'hex')),
  feature_id text references features(id) on delete set null,
  scenario_id text references scenarios(id) on delete set null,
  phase text, event_type text not null,
  tokens_in int, tokens_out int, duration_ms int, agent text, model text, payload jsonb,
  created_at timestamptz default now()
);
create table if not exists improvement_opportunities (
  id text primary key default ('imp_' || encode(gen_random_bytes(8),'hex')),
  source text, source_ref text, title text not null, description text, rationale text,
  suggested_change text, status text not null default 'open', created_at timestamptz default now()
);

-- ── Board notes + joins + future seams ──────────────────────────────────────────────
create table if not exists board_notes (
  id text primary key default ('brd_' || encode(gen_random_bytes(8),'hex')),
  feature_id text not null references features(id) on delete cascade,
  note text not null, created_at timestamptz default now()
);
create table if not exists feature_personas (feature_id text references features(id) on delete cascade, persona_id text references personas(id) on delete cascade, primary key (feature_id, persona_id));
create table if not exists feature_crappies (feature_id text references features(id) on delete cascade, crappy_id text references crappies(id) on delete cascade, primary key (feature_id, crappy_id));
create table if not exists feature_happies (feature_id text references features(id) on delete cascade, happy_id text references happies(id) on delete cascade, primary key (feature_id, happy_id));
create table if not exists crappy_happy (crappy_id text references crappies(id) on delete cascade, happy_id text references happies(id) on delete cascade, primary key (crappy_id, happy_id));
create table if not exists scenario_links (scenario_id text references scenarios(id) on delete cascade, ref_kind text not null, ref_id text not null, primary key (scenario_id, ref_kind, ref_id));
create table if not exists actions  (id text primary key default ('act_' || encode(gen_random_bytes(8),'hex')), feature_id text references features(id) on delete cascade, payload jsonb, created_at timestamptz default now());
create table if not exists insights (id text primary key default ('ins_' || encode(gen_random_bytes(8),'hex')), feature_id text references features(id) on delete cascade, payload jsonb, created_at timestamptz default now());

create index if not exists idx_scenarios_feature    on scenarios(feature_id);
create index if not exists idx_spr_scenario         on scenario_phase_results(scenario_id);
create index if not exists idx_event_storms_feature on event_storms(feature_id);
create index if not exists idx_metrics_feature      on metrics(feature_id);
create index if not exists idx_lessons_domain       on lessons(domain);
create index if not exists idx_lessons_group        on lessons("group");
create index if not exists idx_entities_slug        on entities(slug);

-- ── status_board view ────────────────────────────────────────────────────────────────
create or replace view status_board as
select
  f.id as feature_id, f."group" as "group", f.name, f.version,
  f.pipeline_state, f.default_tier, f.backend,
  count(s.id)                                            as scenarios_total,
  count(s.id) filter (where s.approval_state='approved') as scenarios_approved,
  count(s.id) filter (where s.lifecycle_state='modeled') as scenarios_modeled,
  f.started_at, f.completed_at
from features f
left join scenarios s on s.feature_id = f.id
group by f.id;
