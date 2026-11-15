# Feature: softball/schedule — tournaments, events, games, live scoring, Spanish

**Started:** 2026-11-15 · **Branch:** `schedule` · **Tier:** T2 (prod-shared DB, public SEO surface, new role)
**Driver:** the 2026 U18 Women's Pan American Softball Championship, San Salvador, opening round
**Nov 20–23, 2026**. Source: the Federation flyers `.local/panam-schedule-1.jpeg` (ES) / `-2.jpeg` (EN),
which cite the WBSC Americas opening-round graphic.

> **L-init-01 (binding):** standalone Next.js **16.2.10** + Supabase. NO Go, gRPC, proto, Dorothy,
> `gormClient`, `useApis`/`serverApiClient`, `src/`. `app/` at repo root; public routes under
> `app/(public)/`, admin under `app/admin/(protected)/`. Binding docs: `DESIGN.md`, `AGENTS.md`
> (read `node_modules/next/dist/docs/` before writing Next code). Data access lives in `lib/*.ts`
> (server-only) + `lib/*-view.ts` (client-safe types/pure helpers). Writes are Server Actions using the
> cookie session client so RLS is the boundary. Migrations are replayable SQL in `supabase/migrations/`,
> applied out-of-band with `psql "$SUPABASE_DB_URL" -f …`.

## 1. Decisions (human-confirmed 2026-11-15)

| # | Decision |
|---|---|
| D1 | **Tournament** = a group of events. **Event** = one thing on the calendar (type `game` \| `ceremony` \| `other`): when, where, status. **Game** = sports data for exactly ONE event (1:1): two teams, line score, box score. Events carry no game columns. |
| D2 | Tournament start/end are **derived** from its events (first `starts_at`, last `coalesce(ends_at, starts_at)`). Optional `announced_start/announced_end` are used ONLY while the tournament has no events. |
| D3 | Games link to teams. Players belong to a team. Players link to games through their **stat line** (`game_player_stats`): a player "played" iff they have a line. |
| D4 | **Players are immutable once added** — never deleted (deactivate via `active=false`). Stat lines are never orphaned (`on delete restrict`). |
| D5 | Opponent teams are lightweight: name, country, **flag (no federation logos — trademark)**, division. Kind `guest`. **Rosters only for USVI teams**; opponents have none. |
| D6 | Line score for every game. Box score (per-player batting + pitching) for **USVI players**. Opponent box scores: pending a board decision — do not build. |
| D7 | Every event has a **real, crawlable URL** (`/events/[slug]`). In-site clicks open it as a **modal (desktop) / bottom drawer (mobile)**; direct loads render the full page. |
| D8 | SEO: per-event `SportsEvent` JSON-LD (Google sports results), dynamic OG share images, hreflang en/es, sitemap + robots, light team pages for opponents. |
| D9 | **Spanish under `/es/…`; English stays unprefixed** (no existing URL changes). Public site only; admin stays English. |
| D10 | Roster not yet supplied → public roster section shows **"Roster to be announced"**. |
| D11 | Scorekeeper is not tech-savvy and uses no scoring app: entry must be phone-first, big targets, autosave per tap, undo, offline-tolerant. New role `scorekeeper` (scores/stats only). |
| D12 | **Reuse, don't duplicate**: one TeamBadge, one LineScore (read + editable), one BoxScore (read + editable), one EventsView (used by `/events` and tournament pages), one Modal/Drawer wrapper. |
| D13 | TDD: red tests first (Playwright e2e + Vitest unit), then implementation, until green. |

## 2. Data model (migration `0026_schedule.sql` — ADDITIVE ONLY)

The shared Supabase DB **is production**, and prod currently reads the legacy `events` (= tournaments)
and `event_teams` tables. So `0026` must not rename/drop anything prod reads. The new calendar table is
therefore **`calendar_events`** (permanent name; "event" in code/UI). Legacy `events` + `event_teams`
are dropped by a later **contract** migration run only after this branch is deployed.

- **`tournaments`** — `id uuid pk, name, name_es default '', slug unique, description default '',
  description_es default '', city default '', country_code char(2) null, timezone text not null default
  'America/St_Thomas' (IANA; venue-local time), logo_url, cover_image_url, stream_url null (https only),
  announced_start date null, announced_end date null, sort_order, created_at, updated_at`.
  Seeded by copying the legacy Pan Am row (same `id` + `slug`).
- **`calendar_events`** — `id, tournament_id → tournaments null (on delete restrict), type check in
  ('game','ceremony','other'), slug unique, title default '' (non-games; games are titled from their
  teams), title_es default '', starts_at timestamptz not null, ends_at timestamptz null, venue default '',
  round text default '' (a dictionary KEY, e.g. 'opening_round'), status check in
  ('scheduled','postponed','cancelled') default 'scheduled', stream_url null (https only), sort_order,
  timestamps`. Index `(tournament_id, starts_at)`, `(starts_at)`.
- **`games`** — `id, event_id → calendar_events unique not null (restrict), away_team_id → teams,
  home_team_id → teams (restrict), check away<>home, state check in ('pregame','live','final') default
  'pregame', current_inning int null, away_hits/away_errors/home_hits/home_errors int default 0 ≥0,
  updated_at`. "A vs B" on the flyer = **A away, B home**.
- **`game_innings`** — line score: `game_id → games (restrict), inning int ≥1, side check in
  ('away','home'), runs int ≥0, pk (game_id, inning, side)`. Totals (R) are DERIVED, never stored.
- **`game_player_stats`** — `id, game_id → games (restrict), player_id → team_players (restrict),
  team_id → teams, unique(game_id, player_id)`; batting `ab r h doubles triples hr rbi bb so sb` int
  default 0 ≥0 with `h ≤ ab` and `doubles+triples+hr ≤ h`; pitching `outs_pitched p_h p_r p_er p_bb p_so`
  int null ≥0 (null = did not pitch; IP is stored as OUTS: 14 outs = "4⅔ IP"); `p_er ≤ p_r`.
- **`teams`** — add `country_code char(2) null` (ISO 3166-1 alpha-2, uppercase check); kind check gains
  `'guest'`; `guest` requires `country_code`. USVI national teams get `country_code='VI'`.
- **`team_players`** — add `active boolean not null default true`.
- **RLS** — public SELECT on all new tables. `tournaments`/`calendar_events`: editor writes.
  `games`/`game_innings`/`game_player_stats`: editor OR `scorekeeper` writes (no delete on stats except
  editor). Same `has_role(auth.uid(), …)` pattern as 0018/0023.
- **Deferred to the contract migration (run at deploy):** drop legacy `events`/`event_teams`; drop
  editor DELETE on `team_players`; `team_players.team_id` FK → restrict.

**Derived, in `lib/schedule-view.ts` (pure, Vitest-tested):** run totals; tournament window (D2); IP
display from outs; AVG/OBP/ERA; event display title; localized team name (national/guest with
`country_code` → `Intl.DisplayNames(locale,{type:'region'})`, e.g. es `VI` → "Islas Vírgenes de EE. UU.";
else team `name`); venue-local + Atlantic time labels; flag emoji from country code; event slug
(`{away}-vs-{home}-{yyyy-mm-dd}` from English country names, ceremony `{tournament-slug}-{title}`).

## 3. Seed data — `scripts/seed-panam.ts` (idempotent upsert by slug; `npm run seed:panam`)

Tournament (copy legacy row): name **"2026 U18 Women's Pan American Softball Championship"**, name_es
**"Campeonato Panamericano de Sóftbol Femenino Sub-18 2026"**, city "San Salvador", country `SV`,
timezone **`America/El_Salvador`** (UTC−6, no DST), announced dates null. Round `opening_round`.

Teams: existing `u18-girls-national-team` gets `country_code='VI'` (also `womens-national-team`). 17
guests, kind `guest`, division "U18 Women", name "{English country} U18 Women", slug
"{country-slug}-u18-women": CU SV AR NI HN PR CO MX GT VE US BR CA PE PA BS DO.

Venues: **B** = "Saturnino Bengoa", **G** = "Ing. Pablo Arnoldo Guzmán". Times are El Salvador local.

| Date | Venue | Time | Away vs Home |
|---|---|---|---|
| Nov 20 | B | 18:30 | **Opening Ceremony** (type ceremony; title_es "Ceremonia de inauguración") |
| Nov 20 | B | 19:00 / 21:00 | CU–SV · AR–NI |
| Nov 21 | B | 09 · 12 · 15 · 18 · 21 | HN–PR · NI–HN · **CO–VI** · MX–GT · VE–AR |
| Nov 21 | G | 09 · 12 · 15 · 18 · 21 | US–BR · CA–CU · PE–PA · BS–SV · BS–DO |
| Nov 22 | B | 09 · 12 · 15 · 18 · 21 | PE–US · SV–CA · DO–CA · CU–BS · PA–BR |
| Nov 22 | G | 09 · 12 · 15 · 18 · 21 | MX–CO · AR–HN · NI–VE · VE–PR · **VI–GT** |
| Nov 23 | B | 09 · 12 · 15 · 18 · 21 | HN–VE · **VI–MX** · GT–CO · PR–NI · PR–AR |
| Nov 23 | G | 09 · 12 · 15 · 18 · 21 | CA–BS · BR–PE · US–PA · SV–DO · DO–CU |

32 games + 1 ceremony. USVI = the existing U18 national team (`VI`). Cross-check: USVI games in Atlantic
time are Nov 21 5:00 PM, Nov 22 11:00 PM, Nov 23 2:00 PM (flyer header).

## 4. i18n (D9)

- `proxy.ts`: a request to `/es` or `/es/…` is **rewritten** to the unprefixed internal path with a
  request header `x-locale: es`; everything else is `en`. No Accept-Language auto-redirect (crawlers).
  The existing admin session logic is unchanged; the matcher widens to public paths (exclude `_next`,
  static files, `api`, `admin` keeps its own branch). Verify against `node_modules/next/dist/docs`
  (proxy `NextResponse.rewrite` with request headers).
- `lib/i18n/` — `getLocale()` (server, reads the header), dictionaries `en.ts` / `es.ts` where `es`
  is typed `satisfies Dictionary` (compile-time completeness), `localizePath(locale, path)`, a client
  `LocaleProvider` + `useLocale()/useT()`. `<html lang>` follows the locale.
- Language switcher in the header (EN | ES) keeps the current path.
- `generateMetadata` emits `alternates.languages` (en, es, x-default) on localized pages.
- This feature translates: header/nav, footer, `/events`, `/events/[slug]`, `/tournaments/[slug]`,
  team pages' schedule bits. Other page bodies come later (they still render in English under `/es`).

## 5. Public UX

- **`/events`** — the schedule hub. View switcher (URL `?view=`): **List** (default) · **Cards** ·
  (later) **Timeline** (per day, venues as lanes) · **Calendar** (month grid). Filters: tournament,
  **"USVI games"** toggle (`?team=usvi`). List groups by **date → venue**, like the flyer; each row:
  time (venue-local, with Atlantic time for USVI rows), TeamBadge vs TeamBadge, score/state chip. USVI
  rows are highlighted. Past days collapse below "Upcoming". Times always state their zone.
- **`/events/[slug]`** — full page on direct load; **modal ≥ md / bottom drawer < md** on in-site click
  (Base UI `dialog` / `drawer`, already installed). Sections, top to bottom: header (TeamBadges, state
  badge, score) · when & where (venue-local + Atlantic time, venue, Google Maps link, **Add to
  calendar** .ics) · watch live (if `stream_url`) · **Line score** (empty state "Stats appear once the
  game starts") · **Box score** (USVI only, once lines exist) · **Roster** (USVI side: active players;
  none → "Roster to be announced") · Share button. Ceremony: header + when & where only.
- **`/tournaments/[slug]`** — tournament hub: name, city, derived dates, EventsView filtered to it,
  participating teams (derived from games).
- **Teams** — guest teams get a light `/teams/[slug]` (flag, country, division, their games). The
  `/teams` directory keeps excluding guests.
- **SEO** — `SportsEvent` JSON-LD on every game page (name, startDate ISO with offset, location Place +
  address, homeTeam/awayTeam `SportsTeam`, eventStatus, organizer, and once final the score in the
  description); OG image route per event; `app/sitemap.ts` + `app/robots.ts` (en + es URLs).
- Live: while any visible game is `live`, the page refreshes data every ~30 s (`router.refresh()`).

## 6. Scorekeeper UX (`/admin/scoring`)

Phone-first. A `scorekeeper` sees only this area (editors see it too).
1. **Today's games** (then upcoming), USVI first, big tap rows.
2. **Game screen, Scoreboard tab:** current inning header; per team a big **+1 run** (and −1) for the
   current inning, H and E steppers; buttons **Start game** (pregame→live, inning 1), **Next half /
   Next inning**, **Final** (confirm). Every tap autosaves; a status pill shows *Saved ✓ / Saving… /
   Offline — will sync*; taps queue in the browser and replay in order when back online. **Undo** the
   last tap.
3. **Lineup** (USVI games): "Who played?" checklist of the active roster, pre-checked → creates stat
   lines.
4. **Box score tab:** list of players with their line; tap a player → sheet with big ± steppers for
   AB R H 2B 3B HR RBI BB SO SB; pitchers get a Pitching section (IP in outs via +⅓, H R ER BB SO).
   Invalid combos (H > AB) are blocked inline with a plain-language hint.
5. Consistency hint: if USVI hits on the scoreboard ≠ sum of box-score hits, show a non-blocking warning.

### 6.1 S4 contract (pinned 2026-11-15 — tests and implementation both follow this)

**Persistence model (idempotent, offline-safe).** The client never sends "+1". Every tap computes the
NEW ABSOLUTE value locally and sends a *set* operation: `setInningRuns(gameId, inning, side, runs)`,
`setTeamTotals(gameId, side, {hits, errors})`, `setGameState(gameId, state, currentInning)`,
`setStatLine(gameId, playerId, line)`, `setLineup(gameId, playerIds[])`. Replaying a set twice is
harmless, so the offline queue (localStorage, per game, FIFO, each op stamped with a client sequence
number) can retry freely. Undo = push a set op restoring the previous value. All actions are Server
Actions in `app/admin/(protected)/scoring/actions.ts` → `lib/scoring.ts` (server-only DAL, cookie
session client, so RLS is the boundary) and validate input with `validateStatLine` etc. They return
`{ ok: true } | { ok: false, error }` (plain-language error), never throw to the client.

**Role.** `scorekeeper` (and `editor`) may use `/admin/scoring/**` (`requireAnyRole(['scorekeeper',
'editor'])`). A scorekeeper visiting `/admin` is redirected to `/admin/scoring`; other admin sections
redirect a scorekeeper back to `/admin/scoring` (they lack editor/contributor). Admin nav for a
scorekeeper shows only "Scoring". A contributor without scorekeeper is redirected away from scoring.
DB: migration `0027_scorekeeper_columns.sql` limits a scorekeeper's UPDATE on `games` to `state,
current_inning, away_hits, away_errors, home_hits, home_errors, updated_at` (editors keep full update)
— via a BEFORE UPDATE trigger that rejects changes to other columns unless `has_role(…,'editor')`.

**Screens & testids.**
- `/admin/scoring`: `scoring-games` list of `scoring-game-link` (`data-slug`), today (venue-local) first,
  then upcoming, then recent finals; USVI games first within a day. Each shows TeamBadges + time + state.
- `/admin/scoring/[slug]`: tabs `scoring-tab-scoreboard` (default) · `scoring-tab-lineup` (USVI games
  only) · `scoring-tab-boxscore` (USVI games only). Persistent `scoring-sync-status` pill with
  `data-state="saved|saving|offline"` and visible text ("Saved ✓" / "Saving…" / "Offline — will sync").
  `scoring-undo` (disabled when nothing to undo).
- Scoreboard: `scoring-state` (Pregame/Live/Final), `scoring-start` (pregame→live, inning 1),
  `scoring-inning` (shows the current inning number), `scoring-next-inning`, `scoring-prev-inning`;
  per side `scoring-run-plus-{away|home}` / `scoring-run-minus-{away|home}` (current inning),
  `scoring-hits-plus-…`/`-minus-…`, `scoring-errors-plus-…`/`-minus-…`, value readouts
  `scoring-runs-{side}` (game total), `scoring-hits-{side}`, `scoring-errors-{side}`; the shared
  `LineScore` component in its editable-aware variant shows all innings. `scoring-final` opens a confirm
  `scoring-final-confirm`. A final game shows `scoring-reopen` (editor only).
- Lineup: `lineup-player` checkboxes (`data-player-id`) for the USVI side's ACTIVE roster, pre-checked
  when the game has no lines yet; `lineup-save`. Saving creates zero-lines for checked players (never
  deletes a line that has non-zero stats; unchecking such a player is blocked with a hint).
- Box score: rows `boxscore-edit-player` (`data-player-id`) → the shared ResponsiveSheet `stat-sheet`
  with steppers `stat-{field}-plus` / `stat-{field}-minus` and readout `stat-{field}-value` for
  `ab r h doubles triples hr rbi bb so sb`; `stat-pitching-toggle` reveals `outs p_h p_r p_er p_bb p_so`
  (outs readout shows IP via formatInningsPitched). An invalid tap (e.g. H above AB) is refused and
  `stat-error` shows the plain-language reason. Each tap autosaves through the same queue.
- `scoring-hits-mismatch` warning (on the Scoreboard tab) when USVI scoreboard hits ≠ sum of box-score H.
- Gap fixes (from the S4 test pass): public `boxscore` rows are `boxscore-row` (`data-player-id`) with
  cells `boxscore-{ab|r|h|rbi|bb|so}`; line-score inning cells are `linescore-inning` (`data-inning`).
  `scoring-final-confirm` is the confirm BUTTON inside the confirm dialog; `scoring-final-cancel`
  cancels. The lineup refusal hint is `lineup-error`. The admin nav link is `admin-nav-scoring`.
- **Scorekeeper isolation:** the protected admin layout sends a user whose roles are scorekeeper-only to
  `/admin/scoring` for ANY admin path outside `/admin/scoring/**` (closes the ungated
  `/admin/articles/new` gap for this role).

## 7. Priority order (build top-down; stop wherever time runs out)

1. **S1 Foundation** — Vitest; migration 0026; `lib/schedule-view.ts` + `lib/schedule.ts`; seed script + load.
2. **S2 i18n foundation** — proxy rewrite, dictionaries, switcher, hreflang, chrome translated.
3. **S3 Public schedule** — `/events` list + cards, event page + modal/drawer, JSON-LD, OG, tournament page, guest team pages.
4. **S4 Scorekeeper** — role, today's games, scoreboard (autosave/undo/offline), lineup, box score.
5. **S5** — timeline + calendar views, sitemap/robots, remaining Spanish pages, contract migration.

## 8. Test hazards (read before running anything)

- The e2e DB **is production**. Run **targeted specs only** (`npx playwright test tests/e2e/schedule/…`);
  never the full suite (it re-seeds fake articles into prod).
- Fixtures: names start `E2E `, slugs `e2e-`; seed in `beforeAll`, delete in `afterAll` (service-role
  client via `tests/support/`). Assertions scope to fixture rows; real Pan Am rows must not change results.
- Dev server: one per repo (`.next/dev/lock`). Playwright starts its own on :3100 unless
  `PLAYWRIGHT_BASE_URL` is set.
