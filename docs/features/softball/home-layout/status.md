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

## Slice 3 — curated news grid ✅
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

## Next
Slice 4: `home_stats` migration + `lib/stats.ts` + admin editor + the stats strip.
