# Changelog: softball/schedule

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
