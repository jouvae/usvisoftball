# Changelog: softball/home-feed

## 2026-11-23 — Phase A (ESPN-style home) + Phase B (content fixes)

**Phase A.** Home rebuilt as a feed: lead story (newest featured, else newest) → "Latest" story
rows with infinite scroll (keyset `GET /api/feed`, 8/page, auto-load ×3 then a real "Load more"
button) → Our Teams → Get Involved. Sticky navy **highlights rail** on desktop (timeline of
text items, scrolls inside itself), horizontal strip on phones. "N new stories" pill from a 60 s
visible-tab poll; new highlights re-render the rail. Next-tournament band + stats strip are feed
interstitials. Hero removed (and the home-only oversized crest). Recaps linked to a game
(`articles.game_id`, review-desk picker) show a score line. Everything on the home is en/es.
**Data:** `0029_home_feed.sql` — `home_highlights` (manual en/es + auto `game_final` via trigger
on USVI games; RLS public-read/editor-write), `articles.game_id`, feed index. New admin
`/admin/highlights`. New shared pieces: `components/ui/feed-story.tsx` (LeadStory, FeedStoryRow,
StoryScoreBar), `components/ui/highlights-rail.tsx`, `components/client/home-feed-list.tsx`,
`lib/feed.ts` + `lib/feed-view.ts`.

**Phase B.** Past pregame games read "In progress" / "Final · score pending" (never
"Upcoming"); admin scoring flags "Needs score". `/es` Support link text no longer doubles. About
FAQ (placeholder answers) hidden. Team page hides an empty roster block and an all-blank B/T
column. The 0011 seed committees (placeholder names) were deleted from prod and their inserts
removed from the migration — the Committees section hides until real ones exist. Retired `home-highlights.spec.ts` (old 3-card grid) and the hero/crest cases of
`home-hero-involved.spec.ts`.
