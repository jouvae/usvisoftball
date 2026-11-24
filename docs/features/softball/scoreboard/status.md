# Status: softball/scoreboard

**Updated:** 2026-11-24 · **Branch:** `scoreboard` · **Spec:** [`overview.md`](./overview.md)

## SESSION HANDOFF
- Phase 1 built and verified. `0030_scoreboard.sql` applied to prod (replay-safe).
- USVI–Mexico (Nov 23) loaded: final 5–8 (total-only), H 10–9, BB 3–8, K 7–6, 6 standouts.
  The `game_final` highlight fired. The recap body was trimmed of the duplicated
  stats/standouts via `article:publish --update --publish` (pre-trim spec kept beside it).
- Not committed yet.

## Gates
| Gate | Result |
|---|---|
| Vitest | 182/182 (scoreboard-unit-001 new) |
| Playwright scoreboard-web (desktop + mobile, read-only) | 8/8 |
| Regression (read-only): home-feed-web, shell-mvp, schedule-web-001 | 39 passed, 9 skipped |
| `tsc` / eslint (changed files) | clean |
| Env-free `next build` | passes |

## Open (owner: human)
- Guatemala result (Nov 22) still missing. The recap copy says USVI won; the score is needed.
- Phase 2/3 (see overview).
