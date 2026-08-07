---
description: Database schema and persistence rules for the Jouvae backend — versioned goose SQL migrations (the standard), service-owned GORM models, and hook discipline. Loads when editing migrations, models, or repo-init code.
paths:
  - "data/migrations/**"
  - "services/alpha/cmd/*-migrate/**"
  - "services/alpha/modules/**/models*.go"
  - "services/alpha/modules/**/repo_init.go"
  - "services/alpha/modules/**/repo/init.go"
  - "libs/go/postgres/migrations/**"
---

# Database schema & persistence rules

> ## 🚨 The headline rule
>
> **Schema is created and changed by versioned goose SQL migrations under
> `data/migrations/{service}/`. `gorm.AutoMigrate` is FROZEN LEGACY.** It still runs at boot for
> un-migrated services, but it is not how you add a table or a column any more. Every new table,
> column, index, constraint, or backfill ships as a numbered `.sql` migration with an `Up` **and** a
> `Down`.
>
> If a task says "add the type and register it in `doAutoMigrations`", that instruction is stale —
> write the migration instead, and say so.

---

## 1. Why, and where you are

`AutoMigrate` mutates the live schema from a Go struct at service boot: no history, no down path, no
review, replicas racing to alter the same tables, and DDL re-running on every `air` restart. It also
**silently no-ops** — it never drops a column, narrows a type, or fixes a constraint, so the struct
and the table drift apart with nothing to tell you — and the `doAutoMigrations` bodies swallow
"already exists" errors, so a broken migration can look fine. Backfills and renames have nowhere to
live at all. Versioned SQL fixes all of it: ordered, reversible, reviewable, and operator-invoked.

**Know which half you are in:**

| Surface | Schema owner |
|---|---|
| `staging` schema (hermes) | **goose** — `data/migrations/hermes/` |
| `listing_taxonomy` schema (reservations) | **goose** — `data/migrations/reservations/` |
| Everything else (identity, content, circles, finance, calendar, inspirations, the rest of reservations) | **legacy `AutoMigrate`** — frozen, being paid down |

---

## 2. Where things live

```
data/migrations/{service}/NNNNN_short_name.sql        # the migrations — source of truth for schema
services/alpha/cmd/{service}-migrate/main.go          # the goose runner for that service
Makefile: {service}-migrate / {service}-migrate-down
services/alpha/modules/{service}/service/models_*.go  # the GORM model that MAPS to the table
```

Reference implementations — copy these, do not invent a new shape:

| | |
|---|---|
| Runner | `services/alpha/cmd/reservations-migrate/main.go` (or `cmd/hermes-migrate`, the pilot) |
| Migration | `data/migrations/reservations/00005_listing_facet.sql` |
| Model | `services/alpha/modules/reservations/service/models_listing_facet.go` |
| Test wiring | `services/alpha/modules/reservations/tests/init_test.go` |

---

## 3. Writing a migration

File name: `NNNNN_snake_case_description.sql`, zero-padded, strictly increasing **within that
service's directory**. Two services may reuse the same numbers — that is why each has its own goose
version table (§4).

```sql
-- +goose Up
-- listing_facet — the per-listing derived/asked facet projection (data/v1,
-- listings-taxonomy.md rev-8 §6). Say WHAT the table is and WHY it exists;
-- the migration is the schema's documentation.
CREATE TABLE listing_taxonomy.listing_facet (
    id             TEXT PRIMARY KEY,                                   -- prefixed ULID (lfp-)
    listing_id     TEXT NOT NULL,                                      -- → listings.id (logical ref)
    facet_key      TEXT NOT NULL,
    facet_value_id TEXT REFERENCES listing_taxonomy.facet_values(id),
    source         TEXT NOT NULL DEFAULT 'derived' CHECK (source IN ('asked','derived')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON listing_taxonomy.listing_facet (listing_id);

-- +goose Down
DROP TABLE IF EXISTS listing_taxonomy.listing_facet;
```

- **Every migration ships `Up` AND `Down`.** A `Down` that cannot restore the data must still
  restore the *schema*, and must say so in a comment.
- **The SQL is the source of truth for schema.** Types, `NOT NULL`, `DEFAULT`, `CHECK`, `UNIQUE`,
  indexes, and foreign keys are declared here — never in Go struct tags.
- **Comment the intent.** A migration is read years later with no context. Say what the table is,
  which doc/section it implements, and any non-obvious storage decision.
- **Never edit an applied migration.** Once it has run anywhere — including a teammate's dev DB —
  it is immutable. Write a new one.
- **Own your schema.** A service migrates only its own tables. Cross-service references are
  *logical* (a `TEXT` column holding the other service's ULID), never a foreign key across domains.
- **Data migrations are migrations too.** Seeds, backfills, and renames get their own numbered file
  (e.g. `00002_listing_taxonomy_seed.sql`).
- Statements goose cannot split (functions, `DO $$ … $$`) need
  `-- +goose StatementBegin` / `-- +goose StatementEnd`.

---

## 4. Applying migrations

```bash
make reservations-migrate         # apply all pending
make reservations-migrate-down    # roll back the most recent
make hermes-migrate               # same, per service
```

Non-negotiable properties of the runner — preserve them if you touch it:

- **Discrete and operator-invoked.** Never a service-boot side-effect, never an `air` watch target.
  A backend save must not run DDL.
- **Postgres session advisory lock** held across the whole apply on a pinned `*sql.Conn`, so
  concurrent appliers (multi-replica boot, CI) serialize instead of racing.
- **Per-service goose version table** — `goose.SetTableName("goose_db_version_{service}")`. Services
  share one dev database and their version numbers collide; goose's default table would skew every
  service's state.
- **Fail loud.** Any error is fatal with a non-zero exit. No warn-and-continue.

---

## 5. Standing up migrations for a service that has none

1. `mkdir data/migrations/{service}` and write `00001_*.sql`.
2. Copy `cmd/reservations-migrate/main.go` to `cmd/{service}-migrate/main.go`. Change exactly three
   things: the **advisory-lock key** (new, stable, never reused — e.g. ascii of the service
   abbreviation), the **default migrations dir**, and the **goose table name**.
3. Add `{service}-migrate` / `{service}-migrate-down` to the `Makefile` (and `.PHONY`).
4. Apply the same migrations in the service's `TestMain` (§9).
5. Make sure the new tables are **not** in `doAutoMigrations`.

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
	Source       string    `json:"source" gorm:"column:source"`
	CreatedAt    time.Time `json:"created_at" gorm:"column:created_at"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"column:updated_at"`
}

// TableName pins the schema-qualified table name.
func (ListingFacet) TableName() string { return "listing_taxonomy.listing_facet" }
```

- **The service owns its domain types.** Define them in the service directory as `package service`
  (`models_*.go`). Do **not** add new domain types to `libs/go/postgres/migrations` — that shared
  package is legacy and services are moving off it.
- **`gorm:` tags on a goose-owned model are MAPPING ONLY** — `column:`, `primaryKey`, `TableName()`.
  Never carry DDL tags (`not null`, `default:`, `index`, `uniqueIndex`, `type:`): they generate
  nothing on a model that is never AutoMigrated, and they lie about where the constraint lives.
- **Never register a goose-owned model in `doAutoMigrations`.** Say so in the model's doc comment,
  as the reference model does — it is the single easiest mistake to make.
- `TableName()` is **required** for any table in a non-`public` schema.
- The service layer uses `gormClient` directly and owns transactions directly. No `repo` package, no
  `Repository` interface (`.claude/rules/go-standard.md` §0.1). Query patterns: `docs/db-rules.md`.
- **Proto conversion:** if the type has a protobuf counterpart, keep `XxxFromProto` /
  `(*Xxx).ToProto` next to the model. Conversion happens at the transport boundary only — internal
  functions pass domain types, never proto (`go-standard.md` Part II §8).

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
  `autoUpdateTime` do the rest. `t.CreatedAt = time.Now()` writes the *app's* clock over the DB
  default, skews under clock drift, and vanishes under `SkipHooks`. The legacy
  `libs/go/postgres/migrations` types do this — do not copy them.
- ❌ **Do I/O in a hook** — no other-table reads/writes, no RPCs, no cache or search-index updates.
  They are untraced, escape the handler's span tree, and re-run per row on batch inserts.
- ❌ **Put business logic, validation, or defaulting in a hook.** Validation and normalization belong
  in Func Flow's *validate* phase; column defaults belong in the SQL `DEFAULT`.
- ❌ **Use `AfterCreate`/`AfterUpdate`/`BeforeDelete` for domain side-effects** (emitting events,
  granting permissions, projecting). That is *command*-phase work and must run inside the same
  transaction as the aggregate write, where it is visible and rollback-safe
  (`.claude/rules/go-standard.md` Part II §1).

If you want a hook for anything beyond ID minting, the logic belongs in the service method.

---

## 8. ID prefixes

Primary keys are **prefixed ULIDs** stored as `TEXT` — three lowercase characters, then the ULID.

- Service-owned models use `utils.NewULID(utils.XxxPrefix)`, constants in
  **`libs/go/utils/random.go`**. This is the one to use.
- Legacy shared types use `migrations.NewULID` with prefixes in
  `libs/go/postgres/migrations/global.go`. Do not add new prefixes there.
- Prefixes are **globally unique** across the platform. Grep before adding one.
- A non-ULID id in the database (`ins-000f6a70…` instead of `ins-01KW…`) is a **tell** that
  something bypassed the entity's RPC to seed data. Treat it as a bug, not as usable data.

---

## 9. Tests must apply the migrations

Goose-owned tables do not exist in a test container just because the service booted — the service no
longer creates them. The test package applies them itself, after the DB is up and before the suite
runs. Follow `services/alpha/modules/reservations/tests/init_test.go`:

```go
// in TestMain, after StartTestContainers + GetDbClientConnections
if err := applyReservationsMigrations(ctx, dbConns); err != nil { … }
```

That helper takes the `*sql.DB` off the GORM client, calls `goose.SetDialect("postgres")`,
`goose.SetTableName("goose_db_version_reservations")`, `goose.RunContext(ctx, "up", sqlDB, dir)` —
then **verifies the schema actually exists** before returning. A multi-service harness must set and
**restore** the goose table name around each apply (see `hermes/tests/init_test.go`).

---

## 10. Working on a table that is still AutoMigrated

Most tables still boot through `doAutoMigrations`. When a slice must change one:

1. **Preferred** — move it onto goose as part of the slice: write
   `data/migrations/{service}/NNNNN_*.sql` describing the table *as it should be*, remove it from
   `doAutoMigrations`, wire it into `TestMain`, and note the move in the migration's comment.
2. **If it is too entangled to move in this slice** — make the minimal struct change and **flag it
   explicitly** in your report as migration debt, naming the table. Adding a field to an
   AutoMigrated struct is the one remaining case where a struct change alters schema; it must be a
   conscious, called-out exception, never silent.

**Never introduce a new table into `doAutoMigrations`.**

---

## 11. Field patterns

Where each concern is declared. The recurring mistake is expressing the SQL column in a Go tag —
the left column owns it, always.

| Need | SQL (the migration) | Go (the model) |
|---|---|---|
| Primary key | `id TEXT PRIMARY KEY` | `` `gorm:"column:id;primaryKey"` `` |
| Cross-service ref | `owner_id TEXT NOT NULL` + `CREATE INDEX` | plain `string`, `column:` only |
| Enum-ish status | `status TEXT NOT NULL DEFAULT 'x' CHECK (status IN (…))` | plain `string` |
| Flexible metadata | `metadata JSONB` | `datatypes.JSON` |
| String array | `tags TEXT[]` | `pq.StringArray` |
| Timestamps | `created_at/updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` | `time.Time` — **no hook** |
| Soft delete | `deleted_at TIMESTAMPTZ` + `CREATE INDEX` | `gorm.DeletedAt` |
| Idempotency | `idempotency_key TEXT` + `CREATE UNIQUE INDEX` | plain `string` |
| Any index or constraint | `CREATE INDEX` / `CHECK` / `UNIQUE` | *(nothing — SQL owns it)* |

Idempotency is enforced by that **Postgres unique constraint**, never by Redis or in-process dedup
(`.claude/rules/go-standard.md` Part I §6).

---

## 12. Checklist

Before you call a schema change done:

- [ ] The change is a numbered `.sql` file under `data/migrations/{service}/`, with `Up` and `Down`.
- [ ] It carries a comment saying what the table/column is and which doc it implements.
- [ ] `make {service}-migrate` applies cleanly and `…-migrate-down` rolls back cleanly.
- [ ] No applied migration was edited.
- [ ] The Go model lives in the service package, has `TableName()`, and carries **no DDL tags**.
- [ ] The model is **not** in `doAutoMigrations`.
- [ ] `BeforeCreate` mints the ULID and does nothing else — no timestamps, no I/O, no logic.
- [ ] The ID prefix is in `libs/go/utils/random.go` and is unique.
- [ ] `TestMain` applies the service's migrations and verifies the schema exists.
- [ ] Any table left on `AutoMigrate` is called out as migration debt.
