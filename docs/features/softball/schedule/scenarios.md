# Scenarios: softball/schedule

IDs: `schedule-unit-NNN` (Vitest, `tests/unit/`), `schedule-web-NNN` (Playwright anon),
`schedule-e2e-NNN` (Playwright signed-in), `schedule-db-NNN` (out-of-band DB checks). Spec: `overview.md`.

## S1 — Foundation

**schedule-unit-001 Run totals.** Given innings `[{1,away,2},{1,home,0},{2,away,1}]` When totals are
derived Then away R = 3, home R = 0; no innings → both 0 (and the UI shows "–" when state is pregame).

**schedule-unit-002 Tournament window.** Given events starting 2026-11-21T00:30Z and 2026-11-24T03:00Z
(one with `ends_at` 2026-11-24T05:00Z) Then the window is first start → latest `coalesce(ends_at,
starts_at)`. Given no events and announced dates Then the announced dates are used. Given neither
Then null ("Dates to be announced").

**schedule-unit-003 Localized team name.** `VI` national/guest → en "U.S. Virgin Islands", es "Islas
Vírgenes de EE. UU."; `DO` es → "República Dominicana"; a club with no country → its `name`.

**schedule-unit-004 Times.** 2026-11-21T21:00:00Z in `America/El_Salvador` → en "3:00 PM", es
"3:00 p. m." (match Intl output), Atlantic (`America/St_Thomas`) → "5:00 PM"; date label en
"Saturday, November 21", es "sábado, 21 de noviembre". Labels name their zone.

**schedule-unit-005 Innings pitched.** outs 14 → "4⅔", 0 → "0", 3 → "1", 10 → "3⅓".

**schedule-unit-006 Rate stats.** AVG = H/AB formatted ".333" ("–" when AB 0); OBP = (H+BB)/(AB+BB);
ERA = ER×7/IP (softball = 7 innings) "2.33", "–" when 0 outs.

**schedule-unit-007 Slugs.** away CO, home VI, 2026-11-21 (venue-local date) →
`colombia-vs-us-virgin-islands-2026-11-21`; ceremony in tournament `t` titled "Opening Ceremony" →
`t-opening-ceremony`.

**schedule-unit-008 Stat line validation.** `h > ab`, `doubles+triples+hr > h`, `p_er > p_r`, any
negative → rejected with a plain-language message; a valid line passes.

**schedule-unit-009 Flag.** `VI` → "🇻🇮"; invalid code → "".

**schedule-db-001 Migration replayable + additive.** Given 0026 applied twice Then no error, legacy
`events`/`event_teams` untouched, new tables have RLS on with public SELECT, anon cannot INSERT.

**schedule-db-002 Pan Am seed.** After `npm run seed:panam` (twice — idempotent) the Pan Am tournament
has exactly 33 calendar events (32 games + 1 ceremony), 18 distinct teams, USVI plays 3 games whose
starts_at are 2026-11-21T21:00Z, 2026-11-23T03:00Z, 2026-11-23T18:00Z.

## S2 — i18n

**schedule-web-001** Given `/es/events` Then `<html lang="es">`, nav labels are Spanish, and the URL
stays `/es/events`; `/events` is English with `<html lang="en">`.
**schedule-web-002** The EN|ES switcher on `/events` goes to `/es/events` and back, keeping the path.
**schedule-web-003** Localized pages emit `<link rel="alternate" hreflang="en|es|x-default">`.
**schedule-unit-010** The `es` dictionary has exactly the keys of `en` (no missing/extra).

## S3 — Public schedule

**schedule-web-010 List grouped like the flyer.** Given a fixture tournament with games on two days
at two venues Then `/events` shows day headings in order, venue sub-groups, rows with time + both team
names; a USVI row is marked `data-usvi="true"`.
**schedule-web-011 USVI filter.** Toggling "USVI games" shows only USVI rows; URL has `team=usvi`.
**schedule-web-012 Cards view.** `?view=cards` renders one card per event with the same data.
**schedule-web-013 Modal/drawer.** Clicking a row opens a dialog (desktop) / drawer (mobile) with the
event details, the URL becomes `/events/[slug]`; Escape/back closes it and restores `/events`.
**schedule-web-014 Direct load.** `/events/[slug]` loaded directly renders the full page (not a modal)
with the same sections; unknown slug → 404.
**schedule-web-015 Sections.** A pregame USVI game shows venue-local + Atlantic time, venue, Add to
calendar (.ics download with correct DTSTART in UTC), line score empty state, and "Roster to be
announced" when the team has no active players; with active players it lists them (number, name,
position). A final game shows the line score with R/H/E and the winner emphasized.
**schedule-web-016 JSON-LD.** A game page has one `application/ld+json` `SportsEvent` with
`startDate` (ISO with offset), `homeTeam`/`awayTeam` names, `location.name` = venue.
**schedule-web-017 OG.** A game page's `og:image` URL returns `image/png` 200.
**schedule-web-018 Tournament page.** `/tournaments/[slug]` shows derived dates and only its events.
**schedule-web-019 Guest team page.** `/teams/[guest-slug]` shows flag, country, division, its games;
no roster section; `/teams` directory does not list guests.
**schedule-web-020 Spanish event page.** `/es/events/[slug]` shows Spanish country names and Spanish
date/time labels.

## S4 — Scorekeeper

**schedule-e2e-001 Role gate.** A `scorekeeper` reaches `/admin/scoring` but gets no article/board/
teams admin actions; an anon user is redirected to login; a contributor is denied scoring.
**schedule-e2e-002 Live line score.** Scorekeeper opens a fixture game → Start game → taps +1 run for
away twice in inning 1 → Next inning → +1 home. The public event page shows away 2, home 1, state live.
**schedule-e2e-003 Undo.** After two +1 taps, Undo leaves one run saved (reload confirms).
**schedule-e2e-004 Offline queue.** With the context offline, taps show "Offline — will sync"; back
online they sync in order and reload shows the right totals.
**schedule-e2e-005 Lineup + box score.** On a USVI fixture game, the lineup checklist creates lines for
checked players; entering AB 3, H 1, RBI 1 for a player shows on the public box score; H > AB is
blocked with a hint.
**schedule-e2e-006 Final.** Final (confirmed) sets state final; the public page shows "Final".

## S5 — Timeline, calendar, sitemap

**schedule-web-021 Timeline view.** `?view=timeline` (switcher `events-view-timeline`) renders
`events-timeline` for one venue-local day: day selector `timeline-day[data-date]` (selected is
aria-current; no `date` → the first upcoming day with events; picking sets `date=YYYY-MM-DD`), one
`timeline-lane[data-venue]` per venue (labelled), an hour axis `timeline-axis`, and items
`timeline-item[data-slug][data-usvi]` linking to `/events/{slug}`, placed left→right by venue-local
start (12:00 left of 15:00 in E2E Field Bravo). Clicking an item opens the modal/drawer. On mobile the
timeline scrolls horizontally inside its container; the page never overflows horizontally.
**schedule-web-022 Calendar view + list date filter.** `?view=calendar` (switcher
`events-view-calendar`) renders `events-calendar` with `calendar-month-heading` (localized month +
year), `calendar-prev`/`calendar-next` changing `month=YYYY-MM`, default month = month of the first
upcoming event, and `calendar-day[data-date]` cells for whole weeks (Sunday-first en, Monday-first
es). Event days show `calendar-day-count`, link to `?view=list&date=YYYY-MM-DD`, and are
`data-usvi="true"` when they have a USVI game. `/events?view=list&date=YYYY-MM-DD` shows only that
venue-local day (one `events-day`) plus `events-date-clear` back to the full list. `/es/…` names the
month in Spanish ("marzo de 2099").
**schedule-web-023 Sitemap + robots.** `GET /sitemap.xml` → 200 XML with absolute
`https://usvisoftball.org` URLs for `/`, `/events`, `/es/events`, each event `/events/{slug}` +
`/es/events/{slug}` (with `xhtml:link rel="alternate" hreflang="en|es"` pairs), `/tournaments/{slug}`
and guest `/teams/{slug}`. `GET /robots.txt` allows `/`, disallows `/admin`, lists the sitemap URL.
**schedule-unit-011 Month grid.** `calendarMonthGrid(year, month, weekStartsOn)` → weeks of 7 ISO
dates incl. leading/trailing days: 2099-03 Sun-start Mar 1 … Apr 4 (5 weeks); Mon-start Feb 23 …
Apr 5 (6 weeks); exact-fit months have no padding; leap years and year rollover handled.
**schedule-unit-012 Timeline range.** `timelineRange(events, tz)` → `{startHour, endHour}`: floor of
the earliest venue-local start, ceil of the latest `endsAt ?? startsAt + 2h`, capped at 24 (09/12/15
→ 9–17; 18:30/19:00 → 18–21; 21:00/23:00 → 21–24).
**schedule-unit-013 Timeline position.** `timelinePosition(iso, range, tz)` → linear 0..1 within the
range in venue-local time, clamped (range 9–17: 09:00 → 0, 13:00 → 0.5, 17:00 → 1, 08:00 → 0).
**schedule-unit-014 Default calendar month.** `defaultCalendarMonth(events, nowIso, tz)` →
`"YYYY-MM"` of the first event whose venue-local date is today or later (an event earlier today
still counts); none upcoming → the latest event's month; no events → the current venue-local month.

## Results import — 2026 Central American and Caribbean Games

**schedule-db-003 CAC Games results seed.** After `npm run seed:cacg` (twice — idempotent) the
`2026-central-american-and-caribbean-games-softball` tournament has 22 game events at Santo Domingo
(UTC−4): games 1–20 `final` with line scores matching WBSC report NR. 6 (200 runs, 279 hits), USVI
(`womens-national-team`) box scores for its 5 games (AB 144, R 47, H 59, 30⅓ IP), 15 USVI players;
games 21 (bronze, MX@DO) and 22 (gold, VI@PR) `pregame` — no result in the report. Opponent box
scores are not loaded (D6). Pinned by `tests/unit/cacg-fixtures.test.ts`.
