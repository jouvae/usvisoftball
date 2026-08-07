# The Learning Loop

How the commands, agents, and skills get **better and better** without getting
**bigger and bigger**.

> **Restructured 2026-08-01.** The loop no longer stages provisional rules as markdown records in
> the repo. **The repo holds only ratified rules; Supabase holds everything else.** The 20-file
> lesson corpus and the 29 per-agent rule records that used to live in `.claude/lessons/` and
> `.claude/rules/agents/` were consolidated into the ratified rule files below and archived to the
> Supabase `lessons` table (queryable, never deleted). Those two directories, the
> `rule-effectiveness.json` ledger, and `rule-stats.sh` are gone.

## The problem this solves

A loop that only *adds* rules degrades: prompts grow, slow down, and eventually contradict each
other (the `reviewer` agent once mandated the abolished Repository pattern — that is what
append-only learning produces). Accuracy AND efficiency only improve if lessons are **verified**
and **pruned**, not just captured and applied.

The structural fix is to keep the two halves in different places:

| | Lives in | Why |
|---|---|---|
| **Ratified rules** — what an agent must do | `.claude/rules/*.md`, path-scoped | Loaded into context on every matching edit. Must stay small and non-contradictory. |
| **Lessons + provenance** — why the rule exists, what it cost, what was tried | Supabase `lessons` | Queried as a **scoped slice** only when relevant. Unbounded, permanent, out of the prompt. |

Nothing that is not yet ratified may occupy prompt context. That is the whole discipline.

## The ratified rule set

Six path-scoped files. Every rule in them is **binding** — there is no provisional tier in the repo.

| File | Scope | Covers |
|---|---|---|
| `go-standard.md` | `services/**/*.go`, `libs/go/**/*.go` | Func Flow + the step contract, repository conventions, transactions, errors, observability |
| `data.md` | migrations, models, `repo_init.go` | goose SQL migrations, model/tag discipline, hook discipline, ID prefixes |
| `security.md` | services, BFF routes, authz schema, auth libs | Tenant authorization, anti-enumeration, recovery rate limits, regression tests |
| `contracts.md` | protos, SpiceDB, dorothy, `go.mod`/`go.work` | Enum/field cross-references, authoritative `main.zed`, retired domains, gateway routes, toolchain pinning, service scaffolding |
| `frontend.md` | `clients/web/**` | BFF error-code preservation, concurrent forwards, mock/contract parity, route↔type parity |
| `testing.md` | test dirs, `*_test.go`, Playwright | RPC-only seeding, helper placement, testcontainer serialization, constraint fixtures, selectors |

## The four moves

```
   ┌───────────────  Pre-flight (scoped lesson slice from Supabase)  ◀── at /discover
   ▼
Capture  →  Generalize  →  Ratify (gated)  →  Verify & Prune
  ▲                                                  │
  └──────────────────  feedback  ─────────────────────┘
```

- **Pre-flight** — before new work, query the Supabase `lessons` table for the **task-relevant slice
  only** (by `domain` + `tags` + group, top-N by recency, `limit 12`) via the `3d-artifacts` skill.
  Never load the whole table. `/aar` is the capture side of this same loop.
- **Capture** — at the moment of failure (a QA critical, a red→green test, a human correction),
  write a **lesson row to Supabase** with `domain`, `tags`, `tier`, `phase`, and
  `ladder_stage='observation'`. Cheap, automatic, and **it does not touch the repo**.
- **Generalize** — turn a specific failure into a falsifiable rule with a trigger. Still a Supabase
  row (`ladder_stage='candidate'`), still not in the repo.
- **Ratify (gated)** — a rule enters `.claude/rules/*.md` **only** when it recurs across ≥2
  features, or is a confirmed Critical, or the human ratifies it. SECURITY-classified rules require
  the security-review gate regardless of recurrence. On ratification: write the rule into the right
  ratified file, and set the Supabase row to `ladder_stage='binding'` with a tag naming its
  destination file. **The repo never holds an unratified rule.**
- **Verify & Prune** — track whether the target error stops recurring. Push rules **down the ladder**
  whenever possible; retire rules whose concept no longer exists (set `archived_at` +
  `archive_reason` — never hard-delete a lesson).

## The maturity ladder (push rules DOWN it over time)

A rule in a prompt is the **weakest** enforcement — it costs context on every run and only fires if
the agent carrying it happens to be invoked. Move each rule as far down as it will go.

| Stage | Lives in | Prompt cost | Moves down when |
|---|---|---|---|
| 1. Observation | Supabase `lessons` (`observation`) | **zero** | root-caused |
| 2. Candidate rule | Supabase `lessons` (`candidate`) | **zero** | recurs ≥2 features, confirmed Critical, or human-ratified |
| 3. Ratified rule | `.claude/rules/*.md` | small (path-scoped) | the rule is mechanically checkable |
| 4. Deterministic gate | `libs/scripts/*.sh` + `make` target + CI | **zero** | — terminal |
| 5. Impossible by construction | a type, schema constraint, or generated API | **zero** | — terminal, best |

**Down-the-ladder is the win.** A rule that reaches stage 4 should be **compressed to a pointer** in
its ratified file, not repeated in full — the gate is the enforcement, the prose is the reason.

> **Why this matters, concretely.** `R-reviewer-bola-body-id` was a *binding prompt rule* and a
> cross-tenant IDOR still shipped — because the 3D Deliver flow never invokes the `reviewer` agent,
> so the rule never fired. The fix was not a louder prompt; it was
> `libs/scripts/check-workspace-authz.sh` in CI. See `security.md` §S1.

## Lesson row schema (Supabase `lessons`)

| Column | Use |
|---|---|
| `id` | stable slug — `lsn-…` |
| `feature_id` | FK to `features` when the lesson belongs to one; null for cross-cutting |
| `domain` | `backend` · `frontend` · `security` · `testing` · `process` · `meta` · `rule-provenance` |
| `tags` | text[] — the retrieval key. Include the service, the failure class, and any rule id |
| `tier` · `phase` | T1/T2/T3; discover · design · deliver · improve |
| `content` | the lesson body — context, what happened, what to do differently |
| `ladder_stage` | `observation` → `candidate` → `binding` → `retired` |
| `recurrences_after` | bumped when the target error reappears after ratification |
| `archived_at` · `archive_reason` | pruning. **Never hard-delete.** |
| `created_at` | the date learned — set it explicitly, do not rely on `now()` when backfilling |

## Where things live now

- **Ratified rules** → `.claude/rules/*.md` (the table above).
- **Lessons + rule provenance** → Supabase `lessons`. Records archived from the repo carry the tag
  `archived-from-repo`; ratified-rule provenance carries `ratified-rule` plus its destination file.
- **Metrics** → Supabase `metrics` (written by the `metrics-writer` subagent).
- **Improvement opportunities** → Supabase `improvement_opportunities`.

Never write flow state, lessons, or rules to `.opencode/` — that tree is legacy.
