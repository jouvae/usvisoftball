# Status: softball/home-layout

**Updated:** 2026-10-21 · **Branch:** `redesign` (uncommitted) · **Spec:** [`design-guide.md`](./design-guide.md)

## Slice 1 — tokens, motifs, chrome ✅ (uncommitted)
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

## Next
Slice 2: hero + Get Involved section + `/get-involved` page.
