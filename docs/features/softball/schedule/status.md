# Status: softball/schedule

**Updated:** 2026-11-15 · **Branch:** `schedule` · **Spec:** [`overview.md`](./overview.md) ·
**Scenarios:** [`scenarios.md`](./scenarios.md)

## SESSION HANDOFF
- Spec + scenarios written. Building in priority order S1 → S5 (overview §7), TDD (red → green).
- Nothing deployed. Legacy `events`/`event_teams` must stay until this branch is live (contract migration).

## Checkpoints (human-in-the-loop)
- [ ] post-triage
- [ ] post-problem-statement
- [ ] post-prototype / pre-build
- [x] pre-merge
- [x] pre-deploy

## Slice board
| Slice | State | Notes |
|---|---|---|
| S1 Foundation | ✅ `e453d10` | 0026 applied; Pan Am seeded (33 events, verified vs flyer) |
| S2 i18n foundation | ✅ `a45ad9e` | /es rewrite, dictionaries, switcher, hreflang; canonical = usvisoftball.org |
| S3 Public schedule | ✅ `44bd7ad` | list/cards, modal+drawer (intercepting route, works under /es), JSON-LD, OG, .ics, tournament + guest team pages |
| S4 Scorekeeper | in progress | 0027 applied (scorekeeper column guard) |
| S5 Timeline/calendar, sitemap, rest of Spanish, contract migration | in progress (uncommitted) | timeline + calendar views, list `?date=` filter, sitemap.xml + robots.txt GREEN (unit-011..014, web-021..023; desktop + mobile). Remaining: rest of Spanish page bodies, contract migration |

## Open questions (owner: human)
- CAC Games medal game scores (21 bronze MEX–DOM, 22 gold USVI–PUR) — not in the WBSC report; ranking says PUR gold, USVI silver, DOM bronze. Add to `lib/seed/cacg-fixtures.ts` and re-run `npm run seed:cacg`.
- Opponent box scores (D6) — board decision.
- Live stream URL for the Pan Am (flyer says "watch live at usvisoftball.org").
- U18 roster (names, numbers, positions) — shows "Roster to be announced" until supplied.

## Polish backlog (observed in S3 screenshots, 2026-11-15)
- [x] Desktop modal puts Line score/Roster ABOVE When & Where; mobile drawer has When & Where first. Make both follow spec order (header → when & where → stream → line score → box score → roster). — schedule-web-030
- [x] "UPCOMING" chip on every pregame row is visual noise — show chips only for Live / Final (+score) / Postponed / Cancelled. — sr-only "Upcoming" kept
- [x] OG share image shows only venue-local time (CST); add Atlantic time (USVI audience). — plus prominent final score
- [x] "CST" alone can read as US Central; consider "local" wording in the list legend. — "local" / "Local time · El Salvador"; AST for USVI time
- [x] Scorekeeper stat sheet order AB H R RBI BB SO, then 2B 3B HR SB.
- [x] Lineup removal trap: scorekeeper can remove an all-zero line (0028 applied).
