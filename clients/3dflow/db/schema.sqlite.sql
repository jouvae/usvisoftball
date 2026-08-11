-- 3D-flow local backend — SQLite dialect.
-- Faithful mirror of the Supabase 3D store (the `3d-artifacts` skill's entity set).
-- The canonical schema referenced by the skill (clients/3dflow/db/schema.sql, Postgres)
-- was NOT present in the imported tooling; this file + schema.sql are the reconstruction.
-- Dialect deltas vs Postgres: jsonb->TEXT (JSON string), text[]->TEXT (JSON array),
-- boolean->INTEGER(0/1), now()->CURRENT_TIMESTAMP, generated severity via GENERATED column,
-- uuid/prefixed ids via a DEFAULT expression. Keep in lockstep with schema.sql.

PRAGMA foreign_keys = ON;

-- ── features (identity: group + name; name = flow path with '/'->'_') ──────────────
CREATE TABLE IF NOT EXISTS features (
  id             TEXT PRIMARY KEY DEFAULT ('ftr_' || lower(hex(randomblob(8)))),
  "group"        TEXT NOT NULL,
  name           TEXT NOT NULL,                     -- e.g. softball_init
  version        TEXT NOT NULL,                     -- last path segment (e.g. init / v2)
  pipeline_state TEXT NOT NULL DEFAULT 'discover',  -- discover|design|deliver|shipped|killed|paused
  default_tier   TEXT,                              -- T1|T2|T3
  tier_source    TEXT,
  problem        TEXT,                              -- validated problem statement
  backend        TEXT NOT NULL DEFAULT 'local',     -- which store this row was authored in
  started_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at   TEXT,
  paused_at      TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("group", name)
);

-- ── Discover: personas / crappies (pains) / happies (candidate solutions) ──────────
CREATE TABLE IF NOT EXISTS personas (
  id          TEXT PRIMARY KEY DEFAULT ('per_' || lower(hex(randomblob(8)))),
  name        TEXT NOT NULL,
  role        TEXT,
  description TEXT,
  goals       TEXT,                                 -- JSON array
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crappies (               -- pains
  id           TEXT PRIMARY KEY DEFAULT ('crp_' || lower(hex(randomblob(8)))),
  description  TEXT NOT NULL,
  pain_level   REAL NOT NULL DEFAULT 0,
  impact_score REAL NOT NULL DEFAULT 0,
  severity     REAL GENERATED ALWAYS AS (pain_level * impact_score) STORED,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS happies (                -- candidate solutions
  id          TEXT PRIMARY KEY DEFAULT ('hap_' || lower(hex(randomblob(8)))),
  description TEXT NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Discover: event storms ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_storms (
  id         TEXT PRIMARY KEY DEFAULT ('evs_' || lower(hex(randomblob(8)))),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  pass       INTEGER NOT NULL DEFAULT 1,
  model      TEXT,                                  -- JSON (actors/commands/events/policies/…)
  hotspots   TEXT,                                  -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Design: information architecture / models (lock state) ─────────────────────────
CREATE TABLE IF NOT EXISTS information_arch (
  id         TEXT PRIMARY KEY DEFAULT ('iar_' || lower(hex(randomblob(8)))),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  content    TEXT,                                  -- JSON (screens/routes/nav + domain IA)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
  id             TEXT PRIMARY KEY DEFAULT ('mdl_' || lower(hex(randomblob(8)))),
  feature_id     TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  content        TEXT,                              -- JSON (the Model+IA)
  ia_ref         TEXT,                              -- -> information_arch.id
  locked         INTEGER NOT NULL DEFAULT 0,        -- boolean 0/1 (model-lock gate)
  locked_at      TEXT,
  locked_globs   TEXT,                              -- JSON array of repo-relative path globs
  approval_token TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Scenarios (then = dcon expectation) + per-phase results ────────────────────────
CREATE TABLE IF NOT EXISTS scenarios (
  id                          TEXT PRIMARY KEY DEFAULT ('scn_' || lower(hex(randomblob(8)))),
  feature_id                  TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  slug                        TEXT NOT NULL,
  title                       TEXT,
  "given"                     TEXT,
  "when"                      TEXT,
  "then"                      TEXT,                  -- observable outcome (dcon expectation)
  data_validation_expectations TEXT,                -- JSON (dcon spec)
  lifecycle_state             TEXT NOT NULL DEFAULT 'modeled',
  approval_state              TEXT NOT NULL DEFAULT 'draft',
  tier_override               TEXT,                  -- may only ESCALATE above feature default
  priority                    TEXT,
  grp                         TEXT,                  -- scenario group (A/B/C…)
  stack                       TEXT,                  -- web|e2e|…
  created_at                  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (feature_id, slug)
);

CREATE TABLE IF NOT EXISTS scenario_phase_results (
  id          TEXT PRIMARY KEY DEFAULT ('spr_' || lower(hex(randomblob(8)))),
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  phase       TEXT NOT NULL,                        -- discover|design|deliver|dcon|red-team|…
  status      TEXT,
  result      TEXT,                                 -- JSON or text
  artifact_ref TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Canonical domain entity registry (Design MUST align to it) ─────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id             TEXT PRIMARY KEY DEFAULT ('ent_' || lower(hex(randomblob(8)))),
  kind           TEXT NOT NULL DEFAULT 'entity',    -- entity|context
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  section_no     TEXT,                              -- doc anchor
  status         TEXT NOT NULL DEFAULT 'proposed',  -- canonical|proposed|superseded
  authz_schema   TEXT,                              -- JSON
  source_feature TEXT,
  summary        TEXT,
  body           TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kind, slug)
);

-- ── Lessons (scoped retrieval + audit; never hard-deleted) ─────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id             TEXT PRIMARY KEY DEFAULT ('les_' || lower(hex(randomblob(8)))),
  "group"        TEXT,
  feature        TEXT,
  domain         TEXT,
  tags           TEXT,                              -- JSON array
  tier           TEXT,
  category       TEXT,                              -- learning|training|process-change
  content        TEXT NOT NULL,
  severity       REAL DEFAULT 0,
  ladder_stage   TEXT NOT NULL DEFAULT 'observation',
  archived_at    TEXT,                              -- prune = set this + archive_reason
  archive_reason TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Metrics + improvement opportunities ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  id          TEXT PRIMARY KEY DEFAULT ('mtr_' || lower(hex(randomblob(8)))),
  feature_id  TEXT REFERENCES features(id) ON DELETE SET NULL,
  scenario_id TEXT REFERENCES scenarios(id) ON DELETE SET NULL,
  phase       TEXT,
  event_type  TEXT NOT NULL,                        -- feature_started|phase_entered|gate_result|kill|pivot|error|…
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  duration_ms INTEGER,
  agent       TEXT,
  model       TEXT,
  payload     TEXT,                                 -- JSON
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS improvement_opportunities (
  id              TEXT PRIMARY KEY DEFAULT ('imp_' || lower(hex(randomblob(8)))),
  source          TEXT,
  source_ref      TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  rationale       TEXT,
  suggested_change TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Board notes (status_board is a view over features + scenarios) ─────────────────
CREATE TABLE IF NOT EXISTS board_notes (
  id         TEXT PRIMARY KEY DEFAULT ('brd_' || lower(hex(randomblob(8)))),
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  note       TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Relationship joins ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_personas (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, persona_id)
);
CREATE TABLE IF NOT EXISTS feature_crappies (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  crappy_id  TEXT NOT NULL REFERENCES crappies(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, crappy_id)
);
CREATE TABLE IF NOT EXISTS feature_happies (
  feature_id TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
  happy_id   TEXT NOT NULL REFERENCES happies(id) ON DELETE CASCADE,
  PRIMARY KEY (feature_id, happy_id)
);
CREATE TABLE IF NOT EXISTS crappy_happy (
  crappy_id TEXT NOT NULL REFERENCES crappies(id) ON DELETE CASCADE,
  happy_id  TEXT NOT NULL REFERENCES happies(id) ON DELETE CASCADE,
  PRIMARY KEY (crappy_id, happy_id)
);
CREATE TABLE IF NOT EXISTS scenario_links (
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  ref_kind    TEXT NOT NULL,                        -- entity|event_storm|persona|…
  ref_id      TEXT NOT NULL,
  PRIMARY KEY (scenario_id, ref_kind, ref_id)
);

-- ── Future-campaign seams (kept minimal for schema parity) ─────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id         TEXT PRIMARY KEY DEFAULT ('act_' || lower(hex(randomblob(8)))),
  feature_id TEXT REFERENCES features(id) ON DELETE CASCADE,
  payload    TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS insights (
  id         TEXT PRIMARY KEY DEFAULT ('ins_' || lower(hex(randomblob(8)))),
  feature_id TEXT REFERENCES features(id) ON DELETE CASCADE,
  payload    TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Helpful indexes (scoped-slice reads) ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scenarios_feature   ON scenarios(feature_id);
CREATE INDEX IF NOT EXISTS idx_spr_scenario        ON scenario_phase_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_event_storms_feature ON event_storms(feature_id);
CREATE INDEX IF NOT EXISTS idx_metrics_feature     ON metrics(feature_id);
CREATE INDEX IF NOT EXISTS idx_lessons_domain      ON lessons(domain);
CREATE INDEX IF NOT EXISTS idx_lessons_group       ON lessons("group");
CREATE INDEX IF NOT EXISTS idx_entities_slug       ON entities(slug);

-- ── status_board view (the resume/summary slice) ───────────────────────────────────
DROP VIEW IF EXISTS status_board;
CREATE VIEW status_board AS
SELECT
  f.id                AS feature_id,
  f."group"           AS "group",
  f.name              AS name,
  f.version           AS version,
  f.pipeline_state    AS pipeline_state,
  f.default_tier      AS default_tier,
  f.backend           AS backend,
  COUNT(s.id)                                                     AS scenarios_total,
  SUM(CASE WHEN s.approval_state = 'approved' THEN 1 ELSE 0 END) AS scenarios_approved,
  SUM(CASE WHEN s.lifecycle_state = 'modeled'  THEN 1 ELSE 0 END) AS scenarios_modeled,
  f.started_at        AS started_at,
  f.completed_at      AS completed_at
FROM features f
LEFT JOIN scenarios s ON s.feature_id = f.id
GROUP BY f.id;
