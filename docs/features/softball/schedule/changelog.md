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
