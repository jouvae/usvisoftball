# Feature: softball/home-feed — ESPN-style home feed + highlights rail (Phase A) and content fixes (Phase B)

**Started:** 2026-11-23 · **Branch:** `home-feed` · **Tier:** T2 (prod-shared DB, public home page)
**Driver:** board call 2026-11-23 — "make the homepage more like an ESPN flow". Brief: the
usvisoftball.org redesign brief (Phase 0 + homepage §4), cut to Phases A + B by the human.

> **L-init-01 (binding):** standalone Next.js **16.2.10** + Supabase. Data access in `lib/*.ts`
> (server-only) + `lib/*-view.ts` (client-safe pure helpers). Writes are Server Actions on the cookie
> session client (RLS is the boundary). Migrations are replayable, additive SQL applied out-of-band.

## 1. Decisions (human-confirmed 2026-11-23)

| # | Decision |
|---|---|
| H1 | Scope = **Phase A** (home feed) + **Phase B** (brief Phase 0 fixes). Live layer, PayPal giving, campaigns, subscribers, partners, shop: later PRs. |
| H2 | **Drop the hero.** The lead story is the top of the page. |
| H3 | Highlights rail is **sticky** on desktop: it stays in view while stories scroll; its own list scrolls inside it if taller than the viewport. On phones it becomes a horizontal strip under the lead story. |
| H4 | **Lead story** = newest editor-featured article (`is_highlight`), else the newest article. The feed lists every other published article, newest first. |
| H5 | **Infinite scroll with a real "Load more" button.** Auto-load (IntersectionObserver) runs for at most 3 pages, then only the button loads — the footer stays reachable. Keyset paging on `(published_at, id)`, 8 per page, via `GET /api/feed`. |
| H6 | **Refresh = "N new stories" pill.** The page checks `GET /api/feed?since=` every 60 s while visible; tapping the pill prepends the new stories. New highlights re-render the rail silently (`router.refresh()`; feed state is kept). |
| H7 | **Highlights are their own table** (`home_highlights`) — not the article `is_highlight` flag (that stays "featured article", and now picks the lead). Two kinds: `manual` (editor text en+es, optional link) and `game_final` (auto, from a USVI game going final; the line is rendered from the game, localized, at read time). |
| H8 | **No new player surfaces** (brief "deferred"); existing rosters/box scores stay. |
| H9 | Recap stories show a score bar when the article is **linked to a game** (`articles.game_id`, set by an editor on the review desk); other stories show their category. |
| H10 | Kept sections, after the feed: Our Teams, Get Involved. The next-tournament band is a feed interstitial after the 3rd story. Stats strip: an interstitial after the 6th story (renders only when published stats exist — none today). |

## 2. Data model (`0029_home_feed.sql`, ADDITIVE)

- `articles.game_id uuid null references games(id) on delete set null` (+ partial index).
- `home_highlights` — `id`, `kind` (`manual` \| `game_final`), `text_en`, `text_es`, `link_url`
  (https:// or a site path), `game_id` (unique for `game_final`), `is_published` (default true),
  `published_at` (default now), timestamps. CHECKs: manual ⇒ both texts 1–200 chars; game_final ⇒ game_id.
- RLS: anon/authenticated SELECT published rows; editor SELECT all + INSERT/UPDATE/DELETE (`has_role`).
- Trigger `games_final_highlight` (SECURITY DEFINER): a USVI game (`teams.country_code = 'VI'`, either
  side) moving **into** `final` inserts its `game_final` row (`published_at` = now); moving **out of**
  `final` deletes it. Backfill: existing USVI finals, `published_at` = `coalesce(ends_at, starts_at + 2h)`.

## 3. Design plan (frontend-design pass)

Inside the existing system — tokens in `app/globals.css`, Oswald display + Geist sans, shared
`components/ui/`. No new colours.

- **Colour roles:** navy `#0A2557` (the rail, headlines) · royal `#2A51C6` (links + focus only) · gold
  `#F7CF4F` (rail timeline dots, Support) · surface `#F4F6FB` · white (story surface) · slate `#475569` (meta).
- **Type:** lead headline Oswald 700, `clamp(2rem, 4.2vw, 3.25rem)`, leading 1.04, sentence case (as
  written by the editor). Story headline Oswald 600 1.375rem. Dek/body Geist 1rem/1.55, max 68ch.
  Rail text Geist 0.9375rem/1.45 on navy.
- **Layout (left-aligned throughout):**

```
lg ≥1024 — max-w-6xl (the site width), grid [1fr 20rem], gap 2.5rem
┌───────────────────────────────┐ ┌──────────────┐
│ lead photo 16:9               │ │ Highlights   │ ← sticky top: header + 1rem
│ category  date                │ │ ● 2 h ago    │   max-h: 100dvh − header − 2rem
│ Lead headline (big Oswald)    │ │   text  link │   overflow-y: auto inside
│ dek                           │ │ ● Nov 21     │
├ Latest ───────────────────────┤ │   …          │
│ headline / dek / meta | thumb │ └──────────────┘
│ ─────────────────────────────  │
│ [next-tournament band]        │
│ rows… sentinel / Load more    │
└───────────────────────────────┘
then: Our Teams · Get Involved · footer

390 — lead → highlights strip (horizontal snap, ~80% width items) → rows (thumb 96px right)
```

- **Principles:** one loud thing — the navy rail is the only dark block above the fold; stories are
  quiet white rows split by hairlines, no card shadows. Time is always visible (a feed is about
  recency). The rail's gold dots on a vertical line are a real timeline (chronological), not decor.
  Motion only where the reader acts: the new-stories pill slides in; nothing animates on load.
- **Review against the generic default:** the default here is the 3-up rounded image-card grid with soft
  shadows (what the home has today). Replaced with headline rows + one lead, which is what a news feed
  reads like. Kept the site's existing category label (it carries information: the story type).

## 4. Phase B fixes

1. A game whose start has passed but is still `pregame` never says "Upcoming": during its slot →
   "In progress" / "En curso"; after `coalesce(ends_at, starts_at + 3h)` → "Final · score pending" /
   "Final · resultado pendiente". Admin scoring list flags these "Needs score". Past ceremonies: no state.
2. `/es` nav: the Support link's text content is the full label once (short label via CSS `attr()`).
3. Home: hero removed (fixes the heading-space bug); Our Teams / Get Involved / event band / feed
   strings all go through the dictionaries; links localized (`/es/...`).
4. About: the FAQ (placeholder answers) is not rendered until real answers exist. Committee members in
   prod are seed names → **human decision** to delete them (data, not code).
5. Team page: B/T column hidden when no player has it; roster block hidden when a team has no players.
