# Changelog: softball/schedule

## 2026-11-16 — CAC Games 2026 results import (schedule-db-003)

**Built:** `lib/seed/cacg-fixtures.ts` (transcribed from WBSC report NR. 6 by a parser that
cross-checks every box score against the report's own Totals, pitching vs. opponent R/H, and USVI
season lines vs. the team page) + `scripts/seed-cacg.ts` / `npm run seed:cacg` (idempotent upserts;
loads FINAL state, line scores, H/E and USVI box scores). New round keys `placement_round`, `gold`
(en/es). **Loaded to prod:** tournament + 7 guest "Women" teams + 15 USVI women's players + 22 games
(20 final, 244 inning rows, 64 USVI stat lines). **Held:** opponent box scores (D6), medal-game scores
(not in report).

## 2026-11-15 — S5 timeline, calendar, sitemap/robots

**Built:** EventsView switcher gains **Timeline** and **Calendar** (`?view=timeline|calendar`).
Timeline (`components/ui/events-timeline.tsx`): one venue-local day (pill day picker,
`?date=`; default = first upcoming day), a lane per venue, an hour axis, items placed by
`timelinePosition` and stacked into rows when they would overlap; each item is a real
`<a href="/events/{slug}">` (opens the modal/drawer), USVI items gold-ruled; scrolls horizontally
inside its own container. Calendar (`components/ui/events-calendar.tsx`): `<table>` month grid
(Sunday-first en, Monday-first es; Intl month/weekday names), today marked `aria-current="date"`,
muted out-of-month days, event days show a count + 🇻🇮 marker and link to
`?view=list&date=YYYY-MM-DD` with a descriptive aria-label. List/Cards `?date=` filter with
`events-date-clear`. Pure helpers in `lib/schedule-view.ts`: `calendarMonthGrid`, `timelineRange`,
`timelinePosition`, `defaultCalendarMonth`, `localHours`. `app/sitemap.ts` (force-dynamic; via
`lib/sitemap.ts`) lists static public pages, every event, tournament and team in en + es with
hreflang en/es/x-default and `lastModified` from `updated_at`; flag-off sections omitted.
`app/robots.ts`: allow `/`, disallow `/admin`, sitemap URL. Tournament pages share the parser
(`parseEventsParams`). en + es strings added.

**Decisions:** calendar prev/next are plain `<a>` (full navigation) — with client `<Link>` a fast
second click hit the stale previous-month link. The mobile view switcher is a 4-column grid
(icons hidden < sm) so all four views fit one row. Article detail pages are not in the sitemap yet.

## 2026-11-15 — S3 public schedule

**Built:** `/events` (EventsView: List | Cards, `?team=usvi`, day → venue grouping by venue-local
date, past days folded under "Past"), `/events/[slug]` (full page; JSON-LD SportsEvent; localized
metadata + OG; `calendar.ics`; `opengraph-image`), the in-site event modal (≥ md) / bottom drawer
(< md) via the `(public)/@modal/(.)events/[slug]` intercepting route, `/tournaments/[slug]`, guest
team pages + team games, live refresh, and the home "Upcoming Event" band now features the next
tournament from the 0026 tables.

**Modal approach:** intercepting route + `@modal` parallel slot in `app/(public)/layout.tsx`.
Verified under the proxy rewrite: a soft navigation `/es/events` → `/es/events/{slug}` is
intercepted (modal, `lang="es"`, list underneath) and Escape/Back return to `/es/events`. No
client-side pushState fallback was needed. `@modal/[...catchAll]` clears the slot when a link
inside the overlay leads elsewhere.

**Retired legacy specs** (they tested the replaced tournament-cards UI on the legacy `events`
table, which `/events` and `/events/[slug]` no longer render):
- deleted `tests/e2e/events/events-web-001.spec.ts`, `events-web-002.spec.ts`,
  `events-web-004.spec.ts` (public directory / detail / participants of legacy events);
- `tests/e2e/events/events-e2e-003.spec.ts`: removed its PUBLIC assertions (card in
  `events-upcoming`/`events-past`, `event-detail-logo`, gone from `/events`); the admin CRUD,
  upload/reap and authz/RLS parts are unchanged. Replaced by schedule-web-010 … 020.

**Test hygiene:** `cleanupSportsFixtures()` now deletes only its own exact fixture slugs (it
used to delete every `e2e-` team, which collided with the schedule fixtures). `shell-mvp` "none
of the removed items" is flag-aware (Teams/Events are expected when their flag is on, as in prod).

**Deviation:** the OG image shows the teams' ISO country codes in gold chips instead of flag emoji
— satori renders emoji only from a CDN-fetched image set, and the image must render with no
network dependency. Oswald is vendored as static TTF instances (`app/fonts/oswald-{bold,medium}.ttf`,
generated from the vendored variable woff2; satori cannot read woff2).

## 2026-11-15 — S4 Scorekeeper (`/admin/scoring`)

**Shipped:** `/admin/scoring` lists every game, today's first (venue-local), then upcoming,
then past games, with USVI games first within each day. `/admin/scoring/[slug]` is the
phone-first game screen. It has Scoreboard, Lineup and Box score tabs (the last two only on USVI
games), a sticky sync pill (Saved ✓ / Saving… / Offline — will sync) and an Undo button. Tap
targets are at least 56px. The screen has Start, ‹ › inning buttons, ±1 run for the current
inning, H/E steppers, a Final button with a confirm step, and Reopen for editors only. The Lineup
tab is a "Who played?" checklist. The Box score tab opens a stat sheet with steppers; pitching
innings are entered as outs and shown as IP. Impossible lines are refused with
`validateStatLine`'s message. A non-blocking warning appears when USVI's scoreboard hits don't
match the box-score hits.
- Pure helpers: `lib/scoring-view.ts` (`createOpQueue`, `applyOp`, `orderScoringGames`, plus
  `isZeroLine`, `zeroStatLine`, `scoringDayGroup`; `OpQueue` gains `list()`), `lib/roles-view.ts`
  (`homeForRoles`, `isScoringPath`).
- DAL `lib/scoring.ts` uses the cookie session client. Stat-line `team_id` is resolved server-side,
  and every write is an absolute SET. Actions in `app/admin/(protected)/scoring/actions.ts` check
  the role with `checkAnyRole` (new in `lib/roles.ts`, a version of `requireAnyRole` that does not
  redirect) and return `{ok:false}` instead of redirecting. They validate UUIDs, integer bounds
  (inning 1–30, counts 0–99, lineup ≤ 60) and `validateStatLine`. Only an editor may reopen a
  Final game or change its runs, H or E. On success they revalidate `/events/[slug]` (page) and
  `/events`.
- Client `components/client/use-scoring-queue.ts`: an external store over the localStorage
  OpQueue plus the confirmed base state. Ops are sent one at a time. A send that throws keeps the
  op queued and retries on `online` and every 4s. A send the server refuses is dropped, its
  message is shown, and the page refreshes from the server. Undo enqueues the inverse SET.
- **Scorekeeper isolation is enforced in `proxy.ts`**, not in the layout. For any `/admin` path
  outside `/admin/scoring/**` (except `/admin` and `/admin/login`), the proxy reads the profile
  over RLS and sends a scorekeeper-only user to `/admin/scoring`. A redirect thrown from the
  shared protected layout during a soft navigation left the client router refetching
  `/admin/scoring` in an endless loop (seen in testing), and layouts can't read the pathname. The
  proxy covers full loads, RSC navigations and Server-Action redirects. `/admin` relies on the
  dashboard page's own `redirect()`, because a proxy redirect inside the sign-in action's
  response left the client stuck on a blank `/admin`. The dashboard shows `admin-nav-scoring` to
  scorekeepers and editors.
- Gap-fix testids: public `boxscore-row[data-player-id]` with `boxscore-{ab,r,h,rbi,bb,so}`
  (was `boxscore-line`), `linescore-inning[data-inning]`.
- Specs strengthened (assertions only added): e2e-001 checks that a contributor has no
  `admin-nav-scoring`; e2e-002 checks the public `linescore-inning` cells; e2e-005 checks
  `lineup-error` and the public `boxscore-row` AB/H/RBI values; e2e-006 checks
  `scoring-final-cancel`.

**Known limitation (needs a migration to lift):** 0026 RLS lets only editors DELETE
`game_player_stats`. A scorekeeper therefore cannot take a player off a lineup once it has been
saved, even when that player's line is all zeros. The UI and the action refuse this with a
plain-language hint and make no partial write. A follow-up migration could allow scorekeepers to
delete all-zero lines.

## 2026-11-15 — Polish pass (status.md "Polish backlog")

**Built:**
- **One section order everywhere.** `EventDetail` is now a single column whose DOM order is the
  visual order in page, modal and drawer: header → When & where (time, venue, map, Add to
  calendar, Share) → Watch live (own section) → Line score → Box score → Roster. Each root carries
  `data-section`. The desktop modal used to put Line score/Roster above When & where (CSS `order`
  at `lg`). The direct-load page narrowed to `max-w-4xl` to match.
- **Status chips only when they say something.** Pregame rows, cards and the detail header show
  no visible chip; `event-row-status` / `event-state` stay as a visually-hidden "Upcoming"/"Próximo".
  Live keeps the red chip with a dot that pulses only under `motion-safe`. Final shows the score,
  away–home: "Final · 3–1". Postponed/Cancelled unchanged.
- **"local", not "CST".** New `venueZoneLabel` / `localTimeCaption` / `ATLANTIC_LABEL` in
  `lib/schedule-view.ts`: venue-local times say "local" (en/es); the detail caption reads
  "Local time · El Salvador" / "Hora local · El Salvador"; Atlantic times always say "AST" (Intl
  `es` printed "GMT-4") with "USVI time" / "hora de USVI" in the detail. `/events` intro legend,
  SEO meta description and the admin scoring list use the same wording.
- **OG image:** time line is "Saturday, November 21 · 3:00 PM local · 5:00 PM AST" (`ogWhenLine`);
  a final game shows 120px gold scores, a gold FINAL banner, and dims the loser.
- **Stat sheet order:** AB, H, R, RBI, BB, SO, then 2B, 3B, HR, SB (`BATTING_FIELDS` in
  `lib/scoring-view.ts`); pitching unchanged.
- **Lineup removal trap fixed.** Migration `0028_scorekeeper_zero_line_delete.sql` (additive,
  replayable; applied twice) adds a scorekeeper DELETE policy on `game_player_stats` allowed only
  when every batting stat is 0 and every pitching column is NULL or 0. Proven in a rolled-back
  transaction as a temp scorekeeper: zero line deleted = 1; AB-1 line = 0; 1-out-pitched line = 0
  (before 0028 the zero line was also 0). `setLineup` no longer refuses a non-editor removing a
  zero line; a line with stats is still refused (`lineup-error`).

**Tests:** new `tests/unit/schedule-polish.test.ts` (10) and `schedule-web-030` (section order,
DOM + on-screen, modal desktop / drawer mobile / page; red against the old layout). Updated, with
the old behavior deliberately changed: `schedule-web-010` (pregame chip is sr-only "Upcoming";
Final chip "Final · 3–1"; row time says "local", not "CST"; intro legend), `-012` (pregame card chip
sr-only), `-015` ("Local time · El Salvador", "AST · USVI time", sr-only pregame header state, Final
score), `-020` (es "Hora local · El Salvador", "AST · hora de USVI"), `schedule-e2e-005` (the
scorekeeper now saves both, then unchecks a zero line and it is removed after reload — previously
the scenario only unchecked before the first save; plus stat-sheet order). No coverage removed.
