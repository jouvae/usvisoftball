> **CANONICAL COPY: [`.claude/rules/data.md`](../../.claude/rules/data.md).** This file is the
> `.opencode` mirror, kept in sync by hand. Agent, command, skill, and rule definitions for
> Claude Code now live under `.claude/` — edit there first.

# Database schema & persistence rules

> ## 🚨 The headline rule (2026-08-01)
>
> **Schema is created and changed by versioned goose SQL migrations under `data/migrations/{service}/`.**
> **`gorm.AutoMigrate` is FROZEN LEGACY.** It still runs at boot for the services that have not
> been migrated yet, but it is **not** the way you add a table or a column any more. Do not
> extend it. Every new table, column, index, constraint, or backfill ships as a numbered
> `.sql` migration with an `Up` **and** a `Down`.
>
> If a task tells you to "add the type and register it in `doAutoMigrations`", that instruction
> is stale — write the migration instead, and say so.

---

## Contents

1. [Why we left AutoMigrate](#1-why-we-left-automigrate)
2. [Where things live](#2-where-things-live)
3. [Writing a migration](#3-writing-a-migration)
4. [Applying migrations](#4-applying-migrations)
5. [Standing up migrations for a service that has none](#5-standing-up-migrations-for-a-service-that-has-none)
6. [The GORM model beside the migration](#6-the-gorm-model-beside-the-migration)
7. [Hook discipline (`BeforeCreate` and friends)](#7-hook-discipline-beforecreate-and-friends)
8. [ID prefixes](#8-id-prefixes)
9. [Tests must apply the migrations](#9-tests-must-apply-the-migrations)
10. [Working on a table that is still AutoMigrated](#10-working-on-a-table-that-is-still-automigrated)
11. [Common field patterns](#11-common-field-patterns)
12. [Checklist](#12-checklist)

---

## 1. Why we left AutoMigrate

`AutoMigrate` reads the Go struct and mutates the live schema at service boot. That gives:

- **No history and no down path.** You cannot see what changed, when, or roll it back.
- **Boot-time schema mutation.** Every replica racing to alter the same tables; under `air` a
  save-triggered restart re-runs DDL against the dev DB.
- **Silent no-ops.** AutoMigrate never drops a column, never narrows a type, never fixes a
  constraint. The struct and the table drift apart and nothing tells you.
- **Warn-and-continue.** The existing `doAutoMigrations` bodies swallow "already exists" errors,
  so a genuinely broken migration can look fine.
- **No data migrations.** Backfills, seeds, and renames have nowhere to live.

Versioned SQL fixes all five: ordered, reversible, reviewable, explicit, and **operator-invoked**.

**Current state of the migration (know which half you are in):**

| Surface | Schema owner |
|---|---|
| `staging` schema (hermes) | **goose** — `data/migrations/hermes/` |
| `listing_taxonomy` schema (reservations) | **goose** — `data/migrations/reservations/` |
| Everything else (identity, content, circles, finance, calendar, inspirations, the rest of reservations) | **legacy `AutoMigrate`** — frozen, being paid down |

---

## 2. Where things live

```
data/migrations/{service}/NNNNN_short_name.sql   # the migrations (source of truth for schema)
services/alpha/cmd/{service}-migrate/main.go     # the goose runner for that service
Makefile: {service}-migrate / {service}-migrate-down
services/alpha/modules/{service}/service/models_*.go   # the GORM model that MAPS to the table
```

Reference implementations — copy these, do not invent a new shape:

- **Runner:** `services/alpha/cmd/reservations-migrate/main.go` (or `cmd/hermes-migrate`, the pilot).
- **Migration:** `data/migrations/reservations/00005_listing_facet.sql`.
- **Model:** `services/alpha/modules/reservations/service/models_listing_facet.go`.
- **Test wiring:** `services/alpha/modules/reservations/tests/init_test.go` (`applyReservationsMigrations`).

---

## 3. Writing a migration

File name: `NNNNN_snake_case_description.sql`, zero-padded, strictly increasing **within that
service's directory**. Two services may reuse the same numbers — that is why each has its own
goose version table (§4).

```sql
-- +goose Up
-- listing_facet — the per-listing derived/asked facet projection (data/v1,
-- listings-taxonomy.md rev-8 §6). Explain WHAT this table is and WHY it exists;
-- the migration is the schema's documentation.
CREATE TABLE listing_taxonomy.listing_facet (
    id              TEXT PRIMARY KEY,                       -- prefixed ULID (lfp-)
    listing_id      TEXT NOT NULL,
    facet_key       TEXT NOT NULL,
    facet_value_id  TEXT REFERENCES listing_taxonomy.facet_values(id),
    value           TEXT,
    source          TEXT NOT NULL DEFAULT 'derived'
        CHECK (source IN ('asked','derived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON listing_taxonomy.listing_facet (listing_id);

-- +goose Down
DROP TABLE IF EXISTS listing_taxonomy.listing_facet;
```

Rules:

- **Every migration ships `-- +goose Up` AND `-- +goose Down`.** A `Down` that cannot restore
  the data must still restore the *schema*, and must say so in a comment.
- **The SQL is the source of truth for schema.** Types, `NOT NULL`, `DEFAULT`, `CHECK`, `UNIQUE`,
  indexes, and foreign keys are declared **here**, not in Go struct tags.
- **Comment the intent.** A migration is read years later by someone who has no context. Say what
  the table is, which doc/section it implements, and any non-obvious storage decision.
- **Never edit an applied migration.** Once a migration has been applied anywhere (including a
  teammate's dev DB), it is immutable — write a new one.
- **Own your schema.** A service migrates only its own tables. Cross-service references are
  *logical* (a `TEXT` column holding the other service's ULID), not a foreign key across domains —
  see the `listing_id` comment in the example above.
- **Data migrations are migrations too.** Seeds, backfills, and renames get their own numbered
  file (e.g. `00002_listing_taxonomy_seed.sql`).
- Statements that goose cannot split (functions, `DO $$ … $$`) need
  `-- +goose StatementBegin` / `-- +goose StatementEnd`.

---

## 4. Applying migrations

```bash
make reservations-migrate         # apply all pending
make reservations-migrate-down    # roll back the most recent
make hermes-migrate               # same, per service
```

Non-negotiable properties of the runner (already implemented — preserve them if you touch it):

- **Discrete and operator-invoked.** Migrations are **never** a service-boot side-effect and
  **never** an `air` watch target. A backend save must not run DDL.
- **Postgres session advisory lock** held across the whole apply on a pinned `*sql.Conn`, so
  concurrent appliers (multi-replica boot, CI) serialize instead of racing.
- **Per-service goose version table** — `goose.SetTableName("goose_db_version_{service}")`.
  The services share one dev database and their version numbers collide; without this, goose's
  default table skews every service's state.
- **Fail loud.** Any error is fatal with a non-zero exit. There is no warn-and-continue.

---

## 5. Standing up migrations for a service that has none

When a service (or a new schema inside one) needs versioned migrations:

1. `mkdir data/migrations/{service}` and write `00001_*.sql`.
2. Copy `services/alpha/cmd/reservations-migrate/main.go` to `cmd/{service}-migrate/main.go`.
   Change exactly three things: the **advisory-lock key** (a new, stable, never-reused constant —
   e.g. ascii of the service abbreviation), the **default migrations dir**, and the
   **goose table name** `goose_db_version_{service}`.
3. Add `{service}-migrate` / `{service}-migrate-down` targets to the `Makefile` (and to `.PHONY`),
   modelled on the reservations targets.
4. Apply the same migrations in the service's `TestMain` (§9).
5. Make sure the new tables are **not** registered in `doAutoMigrations`.

---

## 6. The GORM model beside the migration

The Go struct still exists — it is the **read/write mapping**, not the schema definition.

```go
package service

// ListingFacet maps 1:1 to listing_taxonomy.listing_facet, created by
// data/migrations/reservations/00005_listing_facet.sql.
//
// NEVER registered with gorm.AutoMigrate — the table is applied ONLY via goose.
type ListingFacet struct {
	ID           string    `json:"id" gorm:"column:id;primaryKey"`
	ListingID    string    `json:"listing_id" gorm:"column:listing_id"`
	FacetKey     string    `json:"facet_key" gorm:"column:facet_key"`
	FacetValueID string    `json:"facet_value_id" gorm:"column:facet_value_id"`
	Value        string    `json:"value" gorm:"column:value"`
	Source       string    `json:"source" gorm:"column:source"`
	CreatedAt    time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"column:updated_at"`
}

// TableName pins the schema-qualified table name.
func (ListingFacet) TableName() string { return "listing_taxonomy.listing_facet" }
```

Rules:

- **The service owns its domain types** (2026-06-27 directive). Define them in the service
  directory as `package service` (`models_*.go`). Do **not** add new domain types to
  `libs/go/postgres/migrations` — that shared package is legacy and services are moving off it.
- **`gorm:` tags on a goose-owned model are MAPPING ONLY.** Use `column:`, `primaryKey`, and
  `TableName()`. Do **not** carry DDL tags — `not null`, `default:`, `index`, `uniqueIndex`,
  `type:` — on a goose-owned model. They generate nothing (the model is never AutoMigrated) and
  they lie about where the constraint lives. Declare it in the SQL.
- **Never register a goose-owned model in `doAutoMigrations`.** Say so in the model's doc comment,
  as the reference model does — it is the single easiest mistake to make.
- `TableName()` is required for any table in a non-`public` schema.
- Service layer uses `gormClient` **directly** and owns transactions directly
  (`s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error { … })`). There is **no**
  `repo` package and **no** `Repository` interface in new or refactored services. Query patterns:
  `docs/db-rules.md`; live template: `services/alpha/modules/reservations/service/`.

---

## 7. Hook discipline (`BeforeCreate` and friends)

GORM hooks are the most-abused escape hatch in this codebase. They run invisibly, outside the
handler's Func Flow phases, and **are silently skipped** by `Session{SkipHooks: true}` bulk writes
(`docs/db-rules.md` §10) — so anything load-bearing inside one is a latent data bug.

**`BeforeCreate` may do exactly one thing: mint the prefixed ULID when the ID is unset.**

```go
// BeforeCreate assigns a prefixed ULID ("lfp-") when the id is unset.
func (f *ListingFacet) BeforeCreate(_ *gorm.DB) (err error) {
	if f.ID == "" {
		f.ID, err = utils.NewULID(utils.ListingFacetPrefix)
	}
	return err
}
```

Do **not**:

- ❌ **Set `CreatedAt`/`UpdatedAt` in a hook.** The database owns timestamps — declare
  `TIMESTAMPTZ NOT NULL DEFAULT now()` in the migration and let GORM's `autoCreateTime` /
  `autoUpdateTime` handle the rest. `t.CreatedAt = time.Now()` in `BeforeCreate` writes the *app's*
  clock over the DB default, skews under clock drift, and vanishes under `SkipHooks`. The legacy
  `libs/go/postgres/migrations` types do this; do not copy them.
- ❌ **Do I/O in a hook** — no other-table reads/writes, no RPCs, no cache or search-index updates.
  They are untraced, they escape the handler's span tree, and they re-run per row on batch inserts.
- ❌ **Put business logic, validation, or defaulting in a hook.** Validation and normalization belong
  in Func Flow's *validate* phase; column defaults belong in the SQL `DEFAULT`.
- ❌ **Use `AfterCreate` / `AfterUpdate` / `BeforeDelete` for domain side-effects** (emitting events,
  granting permissions, projecting). Those are *command*-phase work and must run inside the same
  transaction the aggregate write runs in, where they are visible and rollback-safe.
  See `.opencode/rules/go-standard.md` Part II §1 (Func Flow).

If you find yourself wanting a hook for anything beyond ID minting, the logic belongs in the
service method. Move it there.

---

## 8. ID prefixes

Primary keys are **prefixed ULIDs** stored as `TEXT`. Three lowercase characters, then the ULID.

- Service-owned models use `utils.NewULID(utils.XxxPrefix)` — constants in
  **`libs/go/utils/random.go`**. This is the one to use.
- The legacy shared types use `migrations.NewULID` with prefixes in
  `libs/go/postgres/migrations/global.go`. Do not add new prefixes there.
- Prefixes are **globally unique** across the platform. Grep before adding one.
- A non-ULID id in the database (e.g. `ins-000f6a70…` instead of `ins-01KW…`) is a **tell** that
  something bypassed the entity's RPC to seed data. Treat it as a bug, not as usable data.

---

## 9. Tests must apply the migrations

Goose-owned tables do not exist in a test container just because the service booted — the service
no longer creates them. The test package must apply them itself, after the DB is up and before the
suite runs.

Follow `services/alpha/modules/reservations/tests/init_test.go`:

```go
// in TestMain, after StartTestContainers + GetDbClientConnections
if err := applyReservationsMigrations(ctx, dbConns); err != nil { … }
```

`applyReservationsMigrations` gets the `*sql.DB` off the GORM client, calls
`goose.SetDialect("postgres")`, `goose.SetTableName("goose_db_version_reservations")`, and
`goose.RunContext(ctx, "up", sqlDB, dir)` — then **verifies the schema actually exists** before
returning. A multi-service harness that applies more than one service's migrations must set and
**restore** the goose table name around each apply (see `hermes/tests/init_test.go`).

---

## 10. Working on a table that is still AutoMigrated

Most tables still boot through `doAutoMigrations`. When a slice needs to change one:

1. **Preferred:** move that table onto goose as part of the slice — write
   `data/migrations/{service}/NNNNN_*.sql` describing the table *as it should be*, remove it from
   `doAutoMigrations`, wire it into `TestMain`, and note the move in the migration's comment.
2. **If the table is too entangled to move in this slice:** make the minimal struct change, and
   **flag it explicitly** in your report as migration debt with the table name — do not let it pass
   silently. Adding a field to an AutoMigrated struct is the one remaining case where a struct
   change alters schema, and it must be a conscious, called-out exception.

Never introduce a *new* table into `doAutoMigrations`.

---

## 11. Common field patterns

| Need | SQL (the migration) | Go (the model) |
|---|---|---|
| Primary key | `id TEXT PRIMARY KEY` | `ID string \`gorm:"column:id;primaryKey"\`` |
| Cross-service ref | `owner_id TEXT NOT NULL` + `CREATE INDEX` | `OwnerID string \`gorm:"column:owner_id"\`` |
| Enum-ish status | `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (…))` | `Status string \`gorm:"column:status"\`` |
| Flexible metadata | `metadata JSONB` | `Metadata datatypes.JSON \`gorm:"column:metadata"\`` |
| String array | `tags TEXT[]` | `Tags pq.StringArray \`gorm:"column:tags"\`` |
| Timestamps | `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` | `time.Time` fields — **no hook** |
| Soft delete | `deleted_at TIMESTAMPTZ` + `CREATE INDEX` | `DeletedAt gorm.DeletedAt \`gorm:"column:deleted_at"\`` |
| Idempotency | `idempotency_key TEXT` + `CREATE UNIQUE INDEX` | plain `string` field |
| Composite index | `CREATE INDEX ON t (status, owner_id)` | *(nothing — SQL owns it)* |

Idempotency is enforced by a **Postgres unique constraint**, never by Redis or in-process
dedup (`.opencode/rules/go-standard.md` Part I §6).

### Proto conversion

If the type has a protobuf counterpart, keep `XxxFromProto` / `(*Xxx).ToProto` next to the model.
Conversion happens at the transport boundary only — internal functions pass domain types, never
proto messages (`.opencode/rules/go-standard.md` Part II §8).

---

## 12. Checklist

Before you call a schema change done:

- [ ] The change is a numbered `.sql` file under `data/migrations/{service}/`.
- [ ] It has both `-- +goose Up` and `-- +goose Down`.
- [ ] It carries a comment saying what the table/column is and which doc it implements.
- [ ] `make {service}-migrate` applies cleanly, and `…-migrate-down` rolls back cleanly.
- [ ] No applied migration was edited.
- [ ] The Go model lives in the service package, has `TableName()`, and carries **no DDL tags**.
- [ ] The model is **not** in `doAutoMigrations`.
- [ ] `BeforeCreate` mints the ULID and does nothing else; no timestamps, no I/O, no logic.
- [ ] The ID prefix is registered in `libs/go/utils/random.go` and is unique.
- [ ] `TestMain` applies the service's migrations and verifies the schema exists.
- [ ] Any table you had to leave on `AutoMigrate` is called out as migration debt.
