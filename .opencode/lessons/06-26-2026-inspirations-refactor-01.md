---
id: L-insp-refactor-04
date: 2026-06-26
feature: inspirations/refactor
tier: T3
trigger: human-correction
category: convention
status: active
---

## Context
While repairing the half-migrated `inspirations` service to a green build, I extracted DB
access into a separate `repo` package — following the `novella` clone-source and
`.claude/rules/data.md` (both of which prescribe a `repo/init.go` + `Repository` interface).
The human corrected the architecture immediately after: **services are moving away from a
`repo` package.** The repo package was then removed and folded back into the service layer.

## What happened
The platform convention had already moved on, and I anchored to **stale references**:
- `.claude/rules/data.md` / `.opencode/rules/data.md` still document the `repo/init.go` +
  `Repository`-interface pattern. They are **stale** for the query/abstraction layer.
- `novella` is the **decommissioning** clone source and carries the **old** pattern; using it
  as the structural template (per L-insp-refactor-03) was right for *missing files* but wrong
  for *DB-access structure*.
- The **live, correct** template was the **reservations service** all along:
  `services/alpha/modules/reservations/service/` holds `gormClient *gorm.DB` directly, runs
  queries as `s.gormClient.WithContext(ctx).Model(&X{})...`, manages transactions inline via
  `s.gormClient.WithContext(ctx).Transaction(func(tx *gorm.DB) error { ... })`, and registers
  migrations in `(s *ServiceImpl) doAutoMigrations` in **`service/repo_init.go` (package
  service, NOT a repo package)**. Ironically the inspirations service already had this shape
  before my extraction broke it.

The new rule (per `docs/db-rules.md`): **no `repo` package; no per-query `Repository`
interface.** The service layer uses `gormClient` directly and owns transaction boundaries.
`db-rules.md` is the GORM usage guide — explicit `db.Transaction`, `Updates` over `Save`,
`CreateInBatches`, raw SQL for search/feed/recommendation/analytics, DTO projections, and
GORM-config tuning (`SkipDefaultTransaction`, `PrepareStmt`, pool sizing).

## What to do differently
1. **No `repo` package / `Repository` interface in services.** The service layer holds
   `gormClient *gorm.DB` and queries it directly; transactions are wrapped inline with
   `s.gormClient.WithContext(ctx).Transaction(...)`. Migration registration lives in a
   `(s *ServiceImpl) doAutoMigrations` method in `service/repo_init.go`. Follow
   `docs/db-rules.md` for query patterns. Reference service = **reservations**, never novella.
2. **Validate a structural template against a CURRENT, non-deprecated service** before
   cloning its shape — and treat rule docs as fallible: a `.claude/rules/*` file can lag the
   live convention. When a clone source is being decommissioned, its *structure* is suspect
   even when its *files* are the right thing to carry over.
3. Rule candidate for **go-implementer / architect / reviewer**: *a service must not
   introduce a `repo` package or a per-query repository interface; DB access and transaction
   management belong in the service layer on `gormClient` per `docs/db-rules.md`, modeled on
   the reservations service.* Run `/improve` to promote and to mark `.claude/rules/data.md` /
   `.opencode/rules/data.md` superseded for the abstraction layer. Corrects L-insp-refactor-03.
