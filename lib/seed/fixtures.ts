import type { CreateArticleInput } from "@/lib/articles";

// The canonical seed fixtures (slice-02 §2.4 + slice-03 §5.2 tables). The seed
// script AND the init-web-001 / init-web-002 specs all import THIS array, so they
// can never drift. Exactly two `published` fixtures (distinct `published_at` so
// newest-first is observable) plus three NON-published rows — one `draft`, one
// `in_review`, one `unpublished` — that must NEVER appear on the feed nor render
// on `/news/[slug]` (init-web-002 §9 asserts each 404s). Hero + gallery images are
// the local files already on disk under `public/seed/`; slice 03 invents no new
// image files.
//
// Slice 03 (§5.1) adds `gallery`:
//   - st-croix… (newest published) → a NON-EMPTY gallery of 2 images (init-web-002
//     opens this one and asserts the gallery renders, per index, in array order);
//   - federation… (published)      → an EMPTY gallery `[]`, exercising the empty
//     branch (a published article that renders fine with no gallery section);
//   - the three non-published rows omit `gallery` (⇒ DB default `[]`).
//
// `import type` above is erased at compile time, so importing this module never
// pulls the `server-only` fence from `lib/articles.ts`.
export const SEED_ARTICLES: CreateArticleInput[] = [
  {
    slug: "st-croix-clinches-territory-title",
    title: "St. Croix Clinches the Territory Title",
    body: "St. Croix capped an undefeated run through the territory tournament with a decisive win under the lights, securing the championship and a berth in the regional series.",
    excerpt: "An undefeated run ends with the territory crown.",
    category: "Tournament",
    authorName: "Denise Gumbs",
    status: "published",
    source: "human",
    publishedAt: "2026-06-20T18:30:00Z",
    coverImageUrl: "/seed/stjohn-tournament.png",
    coverImageAlt:
      "St. Croix players celebrating the territory championship on the field",
    // NON-EMPTY gallery (§5.2). init-web-002 asserts these two, per index, in
    // exactly this array order. Reuses the existing on-disk /seed/*.png files.
    gallery: [
      {
        url: "/seed/season-opener.png",
        alt: "St. Croix players warming up before the championship game",
      },
      {
        url: "/seed/team-profiles.png",
        alt: "The St. Croix squad posing with the territory trophy",
      },
    ],
  },
  {
    slug: "federation-launches-2026-season",
    title: "USVI Softball Federation Launches the 2026 Season",
    body: "The USVI Softball Federation opened the 2026 season with a full slate of matchups across the territory, welcoming returning clubs and several new rosters to the field.",
    excerpt: "A full slate of matchups opens the year.",
    category: "Season",
    authorName: "Marcus Prince",
    status: "published",
    source: "human",
    publishedAt: "2026-03-01T14:00:00Z",
    coverImageUrl: "/seed/season-opener.png",
    coverImageAlt:
      "Players lined up on the baseline before the 2026 season opener",
    // EMPTY gallery (§5.2): the published article with no gallery section — the
    // empty branch is a real, tested fixture, not an assumption.
    gallery: [],
  },
  {
    slug: "unannounced-roster-shakeup",
    title: "Roster Shakeup Ahead of the Playoffs",
    body: "Draft notes on the roster moves expected before the playoff bracket is finalized. Not for publication yet.",
    excerpt: null,
    category: "Teams",
    authorName: "Marcus Prince",
    status: "draft",
    source: "human",
    publishedAt: null,
    coverImageUrl: "/seed/team-profiles.png",
    coverImageAlt: "Team profile portraits pinned to the clubhouse board",
  },
  {
    // NEW (§5.2): the `in_review` 404 fixture. Never published, never on the feed.
    slug: "playoff-brackets-in-review",
    title: "Playoff Brackets Set for Review",
    body: "Editorial draft of the playoff bracket seeding, held for review before it is announced to the public.",
    excerpt: null,
    category: "Playoffs",
    authorName: "Denise Gumbs",
    status: "in_review",
    source: "human",
    publishedAt: null,
    coverImageUrl: "/seed/team-profiles.png",
    coverImageAlt: "Playoff bracket sketched on the clubhouse whiteboard",
  },
  {
    // NEW (§5.2): the `unpublished` 404 fixture. Once live, then pulled — it keeps
    // its old `published_at` (the published_at CHECK only constrains `published`
    // rows), yet RLS + the feed filter still hide it everywhere.
    slug: "2025-season-recap-archived",
    title: "2025 Season Recap",
    body: "A look back at the 2025 territory season, archived and pulled from public view pending a refresh.",
    excerpt: null,
    category: "Season",
    authorName: "Marcus Prince",
    status: "unpublished",
    source: "human",
    publishedAt: "2025-11-15T12:00:00Z",
    coverImageUrl: "/seed/season-opener.png",
    coverImageAlt: "Players celebrating during the 2025 season",
  },
];
