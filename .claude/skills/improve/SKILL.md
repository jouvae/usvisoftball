---
name: improve
description: Close the learning loop. Default mode captures lessons from a feature's cycle into the Supabase `lessons` table and ratifies rules (gated) into `.claude/rules/*.md`. --consolidate runs the Verify & Prune pass over the ratified rule set. Governed by `.claude/rules/LEARNING-LOOP.md`.
metadata:
  audience: developers
  workflow: 3d
---

## What I Do

Close the learning loop: turn what went wrong into something that stops it going wrong again — at
the **cheapest enforcement level that works**, and without growing prompt context.

**Read `.claude/rules/LEARNING-LOOP.md` first.** It owns the ladder, the ratification policy, and
the lesson-row schema. This skill is the procedure; that file is the contract.

### The one structural rule

| What | Where it goes |
|---|---|
| A lesson, an observation, a candidate rule | **Supabase `lessons`** — never the repo |
| A **ratified** rule | `.claude/rules/*.md` — the six path-scoped files |

The repo never holds an unratified rule. There is no `provisional` tier on disk, no per-agent rule
file, and no `rule-effectiveness.json` ledger — all three were retired 2026-08-01 when the corpus
was consolidated into the ratified rule set and archived to Supabase.

## Default mode — capture and (maybe) ratify

1. **Load context.** Read the feature's gate results / review artifacts and query the Supabase
   `lessons` table for this feature's lineage — a **scoped slice** via `3d-artifacts`
   (`feature_id`, or `domain` + `tags`, `limit 12`). Never load the whole table.

2. **Root-cause each failure.** For every Critical, red→green fix, or human correction, identify
   `(error_type, agent, root_cause)`. Classify: `SECURITY` · `CONVENTION_VIOLATION` ·
   `IMPLEMENTATION_GAP` · `DEPENDENCY_ERROR` · `PROCESS`.

3. **Check recurrence.** Query `lessons` for a prior row with the same `tags`/root cause. If the
   target error reappeared after a rule was ratified, bump that row's `recurrences_after` — that is
   the signal the rule is not working where it lives and should move **down** the ladder to a gate.

4. **Write the lesson row** to Supabase (always — this is the audit trail):
   `domain`, `tags`, `tier`, `phase`, `content`, `ladder_stage='observation'`, explicit `created_at`.

5. **Decide ratification (gated).** A rule enters `.claude/rules/*.md` **only** when one holds:
   - it recurred across **≥2 features**, or
   - it is a **confirmed Critical** (data loss, security, build-break), or
   - the **human ratifies it** explicitly.

   `SECURITY`-classified rules need the security-review gate regardless of recurrence.
   Otherwise: leave it as a Supabase row at `ladder_stage='candidate'` and stop. **A candidate that
   sits in Supabase costs nothing; a candidate in the repo costs every future run.**

6. **If ratifying**, before writing prose ask: *can this be a gate instead?* A mechanically
   checkable rule belongs in `libs/scripts/*.sh` + a `make` target + CI, with only a **pointer** in
   the rule file. Prose is the last resort, not the first.

   Then write it into the file that owns the surface:

   | Surface | File |
   |---|---|
   | Go service code, Func Flow | `go-standard.md` |
   | Schema, migrations, models, hooks | `data.md` |
   | Authz, auth, enumeration, rate limits | `security.md` |
   | Protos, SpiceDB, gateway, toolchain, scaffolding | `contracts.md` |
   | `clients/web` and BFF routes | `frontend.md` |
   | Tests, fixtures, selectors | `testing.md` |

   Update the Supabase row to `ladder_stage='binding'` and tag it with the destination file.

7. **Report**: lessons written, recurrences bumped, rules ratified (and to which file), rules held
   as candidates and why, and any gate proposed.

## `--consolidate` — Verify & Prune

Run every ~5 features, or when a rule file starts feeling long. This pass operates on the **ratified
rule set**, which is the only thing that costs context.

1. **Dedup.** Two rules stating the same invariant from different angles collapse into one. The four
   `anti-enumeration` records became `security.md` §S2; two BOLA records became §S1.
2. **Retire dead concepts.** A rule about a thing that no longer exists is deleted from the rule
   file and its Supabase row set to `ladder_stage='retired'` with an `archive_reason`.
   **Never hard-delete a lesson row.**
3. **Move down the ladder.** Any rule now backed by a deterministic gate gets compressed to a
   pointer — the gate is the enforcement, the prose is the reason.
4. **Check for contradiction.** A rule that contradicts another, or that mandates an abolished
   pattern, is the failure mode this whole loop exists to prevent. Grep the rule set against the
   current codebase before trusting it.
5. **Report** a before/after size for each rule file, plus what was deduped, retired, and moved down.

## Critical Rules

1. Never fabricate error types — only classify what you find.
2. If uncertain, hold the rule as a Supabase `candidate`. Uncertainty is not a reason to write prose
   into the repo.
3. **Never hard-delete a Supabase lesson row.** Prune = `archived_at` + `archive_reason`.
4. **Never write an unratified rule into the repo** — recurrence ≥2 features, a confirmed Critical,
   or explicit human ratification, or it stays in Supabase.
5. Persist every finding, including resolved ones. The audit trail is the point.
6. A ratified rule must have a **falsifiable trigger**. If you cannot state how the error would be
   detected, it is not ready to ratify.
7. **Never let a subagent self-append a rule.** Capture flows through this skill only; a subagent
   that edits a rule file is a bug (`go-tester` attempted exactly this once and it was reverted).
8. **Rules don't self-amend** — a change to a shared rule file is presented to the human, not
   applied silently (`CLAUDE.md` behavioral guardrails).
9. The loop must shrink as well as grow. If a `--consolidate` pass dedups, retires, and moves down
   nothing while the rule set keeps growing, that is a failure to report, not to skip.
10. Query Supabase in **scoped slices**. Pulling the whole `lessons` table into context defeats the
    purpose of having moved it there.
