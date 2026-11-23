# Status: softball/home-feed

**Updated:** 2026-11-23 · **Branch:** `home-feed` (from `main` after PR #5) · **Spec:** [`overview.md`](./overview.md) ·
**Scenarios:** [`scenarios.md`](./scenarios.md)

## SESSION HANDOFF
- Phase A (home feed) + Phase B (fixes) built, green, committed; PR open (first branch commit =
  the CAC Games import, `df1034c`).
- `0029_home_feed.sql` **applied to prod** (twice — replayable); backfilled 5 CAC Games finals into
  `home_highlights`. db-001 verified out of band (trigger insert/delete, non-USVI ignored, anon
  read-only) inside a rolled-back transaction.
- 0011 seed committees (placeholder names) **deleted from prod** 2026-11-23 on the human's call
  (4 committees, 7 members, no photos) and the seed inserts removed from `0011` so a replay can't
  restore them. /about hides the section until real committees are entered. about-web-011 is now
  data-driven; about-e2e-012 brings its own marker target committee.
- Screenshots: `screenshots/` (390 + 1440, en + es).

## Checkpoints (human-in-the-loop)
- [ ] post-triage
- [ ] post-problem-statement
- [x] post-prototype / pre-build — plan approved 2026-11-23 (A+B, sticky rail, drop hero)
- [x] pre-merge
- [x] pre-deploy

## Gates
| Gate | Result |
|---|---|
| Vitest | 171/171 (home-feed-unit-001..005, 010..012 new) |
| Playwright home-feed-web (desktop + mobile, read-only) | 17 passed, 3 skipped (viewport-specific) |
| Regression (read-only): home-hero-involved, init-web-009, shell-mvp, schedule-web-001, home-stats | 53 passed, 11 skipped |
| `tsc` | clean · eslint on changed files: clean (1 pre-existing warning) |
| Env-free `next build` | passes; `/api/feed` dynamic |
| Not run (seed prod): about-e2e-008/012/013, teams-web-002, teams-e2e-*, schedule seeders | — |

## Open questions (owner: human)
- Pan Am: USVI vs Colombia (Nov 21) is past with no score → shows "Final · score pending" and
  "Needs score" in /admin/scoring. Enter the result when available.
- CAC Games medal-game scores (carried from schedule).
- Later phases of the brief (live layer, PayPal giving, campaigns, subscribers, partners, shop,
  freshness dashboard) — not started.
