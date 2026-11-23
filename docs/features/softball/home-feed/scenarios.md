# Scenarios: softball/home-feed

IDs: `home-feed-unit-NNN` (Vitest, `tests/unit/home-feed.test.ts`), `home-feed-web-NNN` (Playwright
anon, `tests/e2e/home-feed/`, **read-only against real data — they seed nothing**), `home-feed-db-NNN`
(out-of-band DB checks). Spec: `overview.md`.

## Phase A — home feed

**home-feed-unit-001 Feed cursor.** `encodeFeedCursor({publishedAt, id})` → opaque string;
`decodeFeedCursor` round-trips it; garbage, a bad date or a non-uuid id → `null`.

**home-feed-unit-002 Lead pick.** Given articles newest-first where the 2nd is featured → lead is the
2nd; none featured → lead is the 1st; empty → null.

**home-feed-unit-003 Final highlight line.** A final USVI game VI 9 – PR 10 over 8 innings →
en `{ winner: "Puerto Rico", winnerRuns: 10, loser: "U.S. Virgin Islands", loserRuns: 9, innings: 8,
usviWon: false }`; es names are Spanish ("Islas Vírgenes de EE. UU."); a 7-inning game → innings null
(regulation, not shown).

**home-feed-unit-004 Relative time.** now − 40 min → en "40 minutes ago", es "hace 40 minutos";
now − 3 h → "3 hours ago" / "hace 3 horas"; ≥ 24 h → short date in AST ("Nov 21" / "21 nov").

**home-feed-unit-005 Highlight link.** `https://…` and `/events/x` allowed; `//evil.com`,
`javascript:…`, `http://…`, empty → rejected (empty means "no link", not an error, at the form layer).

**home-feed-web-001 Layout (desktop 1280).** `/` has no `home-hero`; `home-lead` is the first section in
`main` and holds one story link; `home-highlights` sits to the right of `home-lead`; after scrolling
1500 px the rail's top is still inside the viewport (sticky) and `home-lead` is not.

**home-feed-web-002 Infinite scroll.** `/` renders 8 `feed-story` rows. Scrolling to the end loads more
(rows > 8) without navigation; every story appears once; when the feed is exhausted `feed-end` shows and
`feed-load-more` is gone. Total `feed-story` = published − 1 (the lead). With JS auto-load capped,
`feed-load-more` is a real `<button>`.

**home-feed-web-003 Mobile (390).** Lead first, then `home-highlights` as a horizontal strip
(scrollWidth > clientWidth), then stories. The page never overflows horizontally.

**home-feed-web-004 Spanish.** `/es` has `<html lang="es">`, the feed heading and rail heading are
Spanish, story links point at `/es/articles/…`, team links at `/es/teams/…`, and the English strings
"Latest", "Highlights", "Our Teams", "Get Involved" do not appear in `main`.

**home-feed-web-005 Highlights content.** The rail lists ≥ 1 item; a `game_final` item shows a Final
label, both team names and scores, and links to `/events/{slug}`.

## Phase B — fixes

**home-feed-unit-010 Past pregame state.** Pregame game, now between start and
`coalesce(ends_at, start+3h)` → label "In progress" tone `pending`; after → "Final · score pending"
tone `pending`; before start → "Upcoming" (hidden). Postponed/cancelled still win. A past ceremony →
hidden tone with label "Past".

**home-feed-unit-011 Needs score.** `needsScore(event, now)` is true only for a pregame/live game whose
slot has ended.

**home-feed-unit-012 Roster columns.** `showBatsThrows(players)` false when every `batsThrows` is empty.

**home-feed-web-010 Nav label.** On `/es`, `nav-link-donate`'s textContent is exactly
"Apoya a la Federación" (no "ApoyaApoya…").

**home-feed-web-011 About.** `/about` renders no `about-faq` while the FAQ has no real answers.

**home-feed-web-012 Team page.** A national team with no active players renders no `team-roster-empty`
and no "Roster" heading; the women's national team roster has no B/T column when no player has it.

**home-feed-db-001 Migration + trigger.** `0029` applied twice → no error; `home_highlights` RLS on,
anon can SELECT published rows and cannot INSERT; backfill created one `game_final` row per USVI final
(5 CAC Games finals); setting a USVI fixture game `final` inserts its row, setting it back to `live`
deletes it; a non-USVI game going final inserts nothing.
