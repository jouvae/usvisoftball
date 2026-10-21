# Status: softball/home-layout

**Updated:** 2026-10-21 · **Branch:** `redesign` · **Spec:** [`design-guide.md`](./design-guide.md)

## Slice 1 — tokens, motifs, chrome ✅ (`4ed49dd`)
- `globals.css`: gold `#F7CF4F` replaces lime; new `navy` family. Royal `#2A51C6` is now interactive-only.
  Every public heading/title that used `text-brand` was moved to `text-navy`; links stayed royal.
- New components: `components/ui/motifs/` (AccentRule, CornerSlash, StripeEdge, FooterSwoosh,
  IslandSilhouettes) and `components/ui/section-header.tsx`. `button.tsx` gains `accent` /
  `outline-dark` / `outline-light` variants and a `cta` size.
- Nav: News · Get Involved · [Shop] · About + "Support the Federation" pill (Teams/Events appear when
  their flags are on). The collapse point moved md → lg. Test ids kept.
- Footer: navy, swoosh, crest · Contact · Explore · Follow, tagline row.
- Tests updated: `shell-mvp`, `init-web-009` (new colours, `nav-link-involved`). Both pass (35 passed,
  5 skipped by design) against a prod build. `tsc` is clean.
- Verified visually at 1440/820/390 (home, /articles, /about, mobile menu).
- ⚠️ `/get-involved` 404s until slice 2. The island silhouettes are hand-drawn placeholders, so a real
  outline SVG is still wanted.
- Note: the long-running dev server on :3000 stopped picking up `globals.css` changes (it served
  stale CSS while TSX hot-reloaded). Restart it to see the new palette.

## Data
- **Event added (shared DB = prod; `/events` is still flag-off there):** `2026-pan-american-u18-womens-softball-championship`,
  San Salvador, El Salvador, **Nov 21–28, 2026**. Source: `softball-schedule.jpeg` (the team is in
  country Nov 17–29) + the comp's Nov 21–28. **Tournament dates are not confirmed by an official
  source.** El Salvador is confirmed as the host of the VI Pan American U-18 Women's Softball
  Championship. No itinerary, flight details or traveller names were stored.
- The sample events (2099) and the sample clubs are still in the DB. `events-web-002/004` depend on
  them, so they get purged with fixture rework in slice 5 (§4.5 gate).

## Slice 2 — hero, Get Involved, /get-involved ✅ (`c9f29a1`)
- `components/ui/home-hero.tsx`: no-photo hero (navy, faint island outlines, corner slash) with the
  two-tone H1, whose accessible name is "U.S. Virgin Islands Softball Federation". The tagline and blurb
  follow. There are two CTAs: Teams/Events when their flags are on, otherwise **News + Get involved**,
  so the hero never links to a 404. Support is not in the hero.
- Crest overhang: `components/client/sticky-header.tsx` sets `data-hero` (home + scroll-top). The
  crest grows to 80px and overhangs the hero by about 32px on lg+, then shrinks on scroll. It respects
  reduced motion. The crest now uses `crest.png` (sharp at 2x).
- `components/ui/get-involved.tsx`: the `INVOLVEMENT` data (shared by home and page) and the home section.
  Three whole-card-link audience cards; Support → PayPal with "(opens PayPal)".
- `app/(public)/get-involved/page.tsx`: three anchored sections (#athletes, #volunteers, #support)
  with mailto enquiries (subject prefilled, email from `contact_info`) and Support → PayPal.
  **Draft copy, to be reviewed by the Federation.**
- Tests: new `tests/e2e/home/home-hero-involved.spec.ts`; `home-highlights` h1 regex updated. Ran
  against a prod build: home-hero-involved + shell-mvp + init-web-009 = 48 passed / 6 skipped;
  home-highlights anon + carousel tests pass (the editor round-trip test wasn't run because it writes to the DB).
- Verified visually at 1440/820/390.

## Slice 3 — curated news grid ✅ (`6c06d88`)
- `lib/articles.ts`: `listHomeNews(limit = 3)` is one query (`is_highlight desc, published_at desc`,
  limit). It returns items with `isHighlight` and replaces `listHighlightedArticles`, which had no
  other caller.
- Home "Latest News" section: SectionHeader with "All news →" (`home-news-link`) above a
  `home-news-grid` of ≤3 `ArticleCard`s. On sm the third card spans both columns. The empty state is
  `home-news-empty`.
- `ArticleCard` gains `highlight` (emits `data-highlight`) and `headingLevel` (h3 inside a section;
  the /articles feed stays h2).
- `components/client/highlights-carousel.tsx` deleted (no remaining users).
- No `priority` on news covers. The grid sits below the fold even with a no-photo hero, so the
  above-the-fold h1 is the LCP candidate (a deliberate deviation from guide §2.5).
- `home-highlights.spec.ts` was rewritten for the grid. It checks the ordering invariant (highlights
  first) and a round-trip check that holds under curation (a highlighted article may be missing only
  when 3 newer highlights fill the grid). The carousel scroll test was removed.
- Ran against a prod build: home-highlights (incl. the editor round-trip, which restores the flag),
  home-hero-involved, shell-mvp, init-web-009 and articles/*. **64 passed, 8 skipped.**
- Visual check at 1440/820/390. On 820 the spanning third card crops the top of its typographic
  cover; acceptable, and real photos will crop more gracefully.

## Slice 4 — editor-managed stats strip ✅ (`9bb555f`)
- **`0023_home_stats.sql`, applied to the shared DB (= prod) on 2026-10-21, with 0 rows.** Every stat has the same
  shape, enforced by CHECKs: label ≤40, value ≤12, detail ≤60, an icon enum, a required `as_of`, and
  `source_url` https-only. `is_published` defaults to false. RLS: anon sees published rows only;
  editors read everything and write. **No seed rows.**
- `lib/stats-view.ts` (client-safe types, icons, `formatAsOf`, `safeSourceHref`) and `lib/stats.ts`
  (server-only `listPublishedStats`, `listAllStats`, create/update/delete; https check on write).
- `/admin/stats` (editor-only, linked from the dashboard as `admin-stats-link`): an add form plus a
  per-stat edit/delete. Each item shows Draft/Published and its as-of date. Actions revalidate "/".
- `components/ui/stats-strip.tsx`: medallion icon, label, big value, optional detail (links to the
  source when set), and "as of Mon YYYY"; `<dl>` semantics; gold dividers; faint island outlines. The
  home page renders it under the hero only when ≥1 stat is published. Data loads in one `Promise.all`
  with the news grid.
- Tests: new `tests/e2e/home/home-stats.spec.ts` covers the strip shape, the RLS check (the public API
  returns no drafts), the editor draft → publish → unpublish → delete round trip on the anon home, and
  rejection of a non-https source. It cleans up after itself. The home suite + shell-mvp + init-web-009
  give **60 passed, 16 skipped**, and home-stats alone gives 4/4 on desktop. The table is back to 0 rows.
- Visual check at 1440/390 using three temporary placeholder rows, deleted straight after.
- ⏭ **Content:** an editor needs to enter and publish the real, verified figures. The comp's
  "No. 32 WBSC" and "2026 CAC Silver" are still unverified.

## Slice 5a — national teams, event band, /teams ✅ (`08f8da4`)
- **Migrations applied to the shared DB (= prod) on 2026-10-21:**
  - `0024_team_kind.sql`: `teams.kind` ('club'|'national', default club), `short_name`, `cover_image_url`;
    `island` becomes nullable, with a CHECK that a club still needs one.
  - `0025_event_cover.sql`: `events.cover_image_url`.
  - Existing rows are unchanged.
- **Content inserted:** *Women's National Team* (short name "Women's Team") and *U18 Girls' National
  Team* ("U18s"), kind national, no island, with drafted descriptions. Hidden in prod while the Teams
  flag is off.
- Code: `listTeams(client, { kind })`. `groupTeamsByIsland` returns clubs only. Team type/admin form
  gain type, short name and cover path; an island is optional for national teams. Events gain a cover
  (type + admin form) and `getNextEvent(today)`, which orders by start_date, skips undated events and
  returns null when none is upcoming.
- Home: `HomeTeamsSection` (national teams, photo or monogram, navy panel, corner slash, whole-card
  link, "Meet the …") and `HomeEventBand` (next event, dates + venue, "Event details", stripe edge,
  optional cover). Both appear only when their flag is on and they have data.
- `/teams`: a "National teams" group leads (`teams-national`), followed by the island clubs.
- The hero test is now flag-aware.
- Verified with flags ON at 1440/390: home + /teams.

## Slice 5b — test fixtures + sample-data purge ✅
1. **Spec rework.** `tests/support/sports-fixtures.ts` seeds and cleans up "E2E …" fixtures
   (`e2e-` slugs). They mirror the retired samples: 5 clubs, 17 players, 3 events, 9 links, and
   cleanup deletes only `e2e-` slugs. The read-only specs (teams-web-001/002, events-web-001/002/004)
   seed in beforeAll and scope their assertions to fixture rows. The CRUD specs (teams-e2e-003/004,
   events-e2e-003) compare teardown against **baseline counts** captured in beforeAll instead of the
   hardcoded 5/17/3. teams-e2e-004 uses the fixture club `e2e-cruz-bay-waves`.
2. **Purge (shared DB = prod, 2026-10-21).** Exact-slug delete in one transaction: 5 sample clubs,
   which cascaded 17 team_players and the event links, and 3 sample events (9 event_teams). None of
   them referenced Storage objects. A JSON backup of every deleted row was written to the session
   scratchpad first. The DB now holds **2 national teams, 1 event (Pan Am), 0 players, 0 links**.
   The seed inserts in 0013/0014/0017/0019 are replaced with a removal note, so a replay can't
   bring them back.
- Verified **after** the purge:
  - Flags ON (teams/events/home): **82 passed, 22 skipped**.
  - Flags OFF (shell/init-web-009/articles/home/teams/events): **74 passed, 84 skipped**. The skips
    are the flag gates and desktop-only tests.
  - Fixtures left nothing behind.
- ⚠️ Once the flags are live in prod, any e2e run against the shared DB briefly shows the E2E
  fixtures on the public site. The real fix is still a non-prod Supabase project for e2e.

## Step 3 — flag flip prepared (goes live on merge to `main`)
- `Dockerfile`: builder-stage `ARG NEXT_PUBLIC_TEAMS_ENABLED=false` / `ARG NEXT_PUBLIC_EVENTS_ENABLED=false`
  → `ENV`, so `next build` inlines them. The default is off.
- `fly.toml`: `[build.args]` sets both to `"true"`. `flyctl deploy --local-only` (the CI deploy step)
  passes `[build.args]` to the Docker build. To roll back, set a flag to "false" and redeploy.
- Verified with a local `docker build` using the same args, run with the runtime env: `/`, `/teams`,
  `/events`, the Pan Am event page, `/teams/womens-national-team` and `/get-involved` all return 200.
  Home renders hero, teams, event, news and involved (stats is hidden because nothing is published);
  the nav shows Teams and Events.
- **Go-live = merge PR #1 → `main`.** CI then deploys. The DB side (0023–0025, purge, national
  teams, Pan Am event) is already in place and is compatible with the old `main` code in the meantime.

Content still owed: real stats (`/admin/stats`), national-team cover photos, confirmed Pan Am dates,
and a review of the drafted team/Get Involved copy.

## About-page team section + Google Analytics (2026-10-21, uncommitted)
- **Board data (prod DB, live now):** the current term (2025–2027) holds the real roster, in
  order: Elroy Hill (President); Jose Rosario, Bobby Thomas, Emarito Cortez (Vice Presidents);
  Erainee Dacosta, Renee Smith (Secretaries); Sherry-Ann Francis (Treasurer); Julien Powell
  (Public Relations). The sample members Delroy Richards, Yolanda Benjamin and Terrence Gumbs
  are deleted. Headshots from `public/<firstname>.jpeg` were uploaded to the `board-photos`
  bucket (random keys), so editors can replace them in `/admin/board`. The `public/*.jpeg`
  files stay uncommitted.
  - Elroy Hill's old photo was a cartoon placeholder. It is cleared, so his card shows "EH"
    initials until a real headshot is uploaded.
  - Seats are unconfirmed, so every member is stored `at_large` and the seat is no longer
    shown publicly. Bios are empty.
  - Open: there are two Secretaries (Erainee Dacosta and Renee Smith); is one Assistant
    Secretary? The photo file is `emaritto.jpeg` but the roster says "Emarito"; which spelling
    is right? `pat.jpeg` belongs to someone not on the roster. The archived 2023–2025 term
    (Ivan Fredericks, Sandra Peters) is still sample data, and the 0008 permanence guard
    keeps it immutable.
- **Layout:** `BoardGrid` follows `components/samples/board-member-section.tsx`: a centered
  "Meet our leadership" header, large round headshots, then name, office and social icons.
  It is 4-up on lg and 2-up on phones (the sample's 1-up made 8 members ~2,800px tall). The
  card still opens the profile modal, now without the seat. Social icons are links outside
  the button, shared with the footer through `components/ui/social-icons.tsx`.
  - Tests: about-web-002 drops the seat-coverage checks; home-board expects the new h2.
- **Google Analytics:** `@next/third-parties` `<GoogleAnalytics>` is in the `(public)` layout
  (not `/admin`). It renders only when the build sets `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Dockerfile
  ARG; `fly.toml` `[build.args]` = `G-DS4Z8KKPNX`), so dev, local and e2e builds send nothing.
  Verified with a local build that has the ID: gtag loads on `/` and `/about` but not on
  `/admin/login`.
- Verified: about-web, home-board and home-hero-involved specs: 23 passed, 13 skipped.
  `tsc` and lint are clean.
