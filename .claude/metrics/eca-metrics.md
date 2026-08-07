# ECA Success Metrics

What we instrument to know the flow is working. **Computable-now** metrics are
derived from the feature directories and the lessons corpus. Metrics needing a data
source we don't yet have are marked `TODO(metric)` with the likely source — never
left blank (the prior framework's empty metric tables are the failure we refuse to
repeat).

Data sources available now: `docs/features/**/{status.md,overview.md,lessons.md,
changelog.md,dcon-report.md,red-team-*-report.md}`, the Supabase `lessons` table,
`.claude/rules/*.md`, git history. Prod incident/rollback data source:
`TODO(metric): confirm LGTM (Grafana/Loki/Tempo/Mimir on :3005) + Fly.io rollback log
as the source`.

## North Star (track always)

| Metric | Definition | Source | Status |
|---|---|---|---|
| **Cycle time per tier** | triage → shipped wall-clock, **bucketed by tier** | `changelog.md` timestamps + tier in `overview.md` | computable now |
| **Tier calibration** | incident/rollback rate **by tier**. If T1 incidents approach T3, triage is miscalibrated — the single most important health signal | incidents/rollbacks × tier | `TODO(metric): incident source (LGTM + Fly rollback log)`; tier is computable now |
| **Lessons-applied rate** | % of new features whose `overview.md` §Research references ≥1 prior lesson | feature dirs + the Supabase `lessons` table | computable now |

## Phase-gate (quality control)

| Phase | Metric | Source | Status |
|---|---|---|---|
| Empathize | validated problem statement present; user-facing-scenario coverage | `overview.md`, `scenarios.md` | computable now |
| Conceptualize | prototype validated (human/spec) per tier; required design artifacts present | `status.md` (`prototyped`), `overview.md` | computable now |
| Actualize | **dcon pass = 100% of data-writing scenarios**; **red-team pass = zero blocking findings (both levels)**; scenario test coverage; promotion-gate checklist complete | `dcon-report.md`, `red-team-*-report.md`, `status.md`, `changelog.md` | computable now |

## Supporting (diagnostics)

| Metric | Definition | Source | Status |
|---|---|---|---|
| **Rework rate** | backward loops per phase | `status.md` "Open loops" + `changelog.md` | computable now |
| **Repeat-error rate** | same error recurring across sessions — should trend to **zero** if the loop works; the proof the loop is real | Supabase `lessons.recurrences_after` | computable now |
| **Prototype kill rate** | % of features killed/pivoted in Conceptualize — **healthy**, a diagnostic not a failure | `changelog.md` kill/pivot entries | computable now |
| **Auto-escalation hit rate** | % of features where a trigger forced the tier up | `overview.md` manifest | computable now |

## How to compute

```bash
bash .claude/scripts/eca-metrics.sh
```

The script reads every ECA feature directory (any `docs/features/**/` carrying the
ECA artifact set — `overview.md` + `status.md` + `changelog.md`, excluding
`_template`/`archive`), aggregates the computable-now rows by tier, prints a report,
and writes `.claude/metrics/aggregated/eca-metrics.json`. The **repeat-error rate** now comes from
Supabase — `select tags, recurrences_after from lessons where recurrences_after > 0;` — since the
learning loop's ledger moved there (`.claude/rules/LEARNING-LOOP.md`).

`TODO(metric)`: stand up the incident/rollback feed so **tier calibration** — the
north-star health signal — moves from partial to fully computable.
