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
| S5 Timeline/calendar, sitemap, rest of Spanish, contract migration | todo | |

## Open questions (owner: human)
- Opponent box scores (D6) — board decision.
- Live stream URL for the Pan Am (flyer says "watch live at usvisoftball.org").
- U18 roster (names, numbers, positions) — shows "Roster to be announced" until supplied.

## Polish backlog (observed in S3 screenshots, 2026-11-15)
- Desktop modal puts Line score/Roster ABOVE When & Where; mobile drawer has When & Where first. Make both follow spec order (header → when & where → stream → line score → box score → roster).
- "UPCOMING" chip on every pregame row is visual noise — show chips only for Live / Final (+score) / Postponed / Cancelled.
- OG share image shows only venue-local time (CST); add Atlantic time (USVI audience).
- "CST" alone can read as US Central; consider "local" wording in the list legend.
