# Status: softball/redesign (+ launch content)

**Updated:** 2026-10-21   **Branch:** `redesign`   **PR:** [#1](https://github.com/jouvae/usvisoftball/pull/1) (open, not merged)

> ▶ **SESSION HANDOFF (2026-10-21)** — entry point for a fresh session with no memory of the prior one.
>
> **State:** the public-site redesign + a home-carousel fix are on PR #1 (2 commits, pushed, **unmerged**).
> 15 researched news articles are **live in the shared Supabase DB (= prod)** and render on both `main`
> (prod, old design) and `redesign`. The Federation board demo was 2026-10-21 (evening).
>
> **UPDATE (2026-10-21, later):** all three items below are done. The Giddins spelling is fixed in prod.
> PR #1 was merged at 00:38 UTC. The home layout update is on PR #2 (branch `home-layout`).
> **Current handoff: `docs/features/softball/home-layout/status.md`.**
>
> ~~NEXT: (1) fix the spelling `Ryann Giddens` → `Ryann Giddins`; (2) decide/merge PR #1; (3) start
> the home page layout update.~~

## Done

### PR #1 — `redesign` → `main` (open)
| Commit | What |
|---|---|
| `6067e97` | Public-site redesign: brand palette (#2A51C6 blue / #E5E849 yellow) via `globals.css` tokens; frosty translucent sticky nav; centered footer + FB/IG icons; brand-blue home hero + highlights carousel (board grid moved to `/about`); image-cover `ArticleCard`; `/about` rebuilt from a Tailwind UI template; `/shop` placeholder behind `NEXT_PUBLIC_SHOP_ENABLED` (off in prod); shadcn initialized; `scripts/provision-editor.ts` |
| `fb95134` | Home highlights carousel fix: cards were fixed `sm:w-80` so 4 highlights overflowed by ~232px (3½ cards visible, one click hit the end, controls looked dead). Now whole cards per view (3 desktop / 2 tablet / 1+peek mobile), one-card steps, prev/next `aria-disabled` + dimmed at the ends (scroll + ResizeObserver). e2e `home-highlights` now asserts the track actually moves |

Verified: real-browser walk-through at 1440/820/390 (Chromium), `tsc` + `eslint` clean, updated carousel
e2e passes (desktop; the describe is desktop-only so mobile skips). **Not tested in Safari/Firefox**
(Playwright WebKit/Firefox builds not installed).

### Launch content — 15 articles (in prod DB now)
- Researched from public sources (VI gov, Delegate Plaskett, St. Thomas/St. Croix Source, St. John
  Tradewinds, VI Daily News, VI Consortium, MLB.com, WBSC, Harvard Athletics, Wikipedia). Every row's
  sources are stored in `articles.ai_provenance.source`.
- Written as `source='ai'`, `ai_provenance.model='claude-opus-5-5'`, byline **"Federation Staff"**,
  `status='published'`, `published_at` = event date (2023 stories carry 2023 dates).
- Highlights (`is_highlight=true`): 18U World Series title · CAC Games silver · Amanda Thompson spotlight ·
  One Caribbean Invitational.
- Categories: Game Recap, Player Spotlight, Feature, Federation News, Team News, National Team, Youth.
- The 2 fake seed articles (`st-croix-clinches-territory-title`, `federation-launches-2026-season`) were
  **deleted**.
- Covers are **branded typographic graphics** (no real photos exist) rendered with Playwright, stored in
  Supabase Storage **`board-photos/article-covers/v2/<slug>.jpg`** — the only bucket `next.config.ts`
  `images.remotePatterns` allows, so they render on prod without a deploy. Content kept inside the
  center ~760px because cards `object-cover`-crop the sides.
- Tooling lives in the session scratchpad (NOT the repo): `articles-data.ts` (all article text + cover
  specs + sources), `render-covers.ts`, `publish-articles.ts` (idempotent: deletes the 2 seed slugs +
  its own 15 slugs, re-uploads, re-inserts via `createArticle`, sets highlights). If a re-run is needed,
  regenerate from the DB rows (`select slug, title, body, ... from articles`) — the scratchpad may be gone.

## What's left

### Content fixes (before anyone else reads the articles)
- ✅ **`Ryann Giddens` → `Ryann Giddins` — FIXED 2026-10-21** in all three article bodies (the only
  occurrences; verified on the live site). The Federation's own U18 travel schedule (`softball-schedule.jpeg`)
  spells it *Giddins*. Appears in: `usvi-18u-wins-nike-rbi-softball-world-series`,
  `usvi-18u-two-year-climb-semifinalists-to-champions`, `meet-the-2026-usvi-18u-roster`. The same sheet
  **confirms** the spellings already used: Isabella Viruet, Inocencia Bermudez, Richard Clendinen, Keira
  Frazier, Alahya Jackson, Mekaela (Aaliyah) Richardson.
- Still unconfirmed by a Federation source: **Erin Sugg vs Suggs**, **Love Moise-Creque vs Love Creque**.
- Articles are AI-written: an editor should read them. Board may supply real photos to replace covers.

### PR #1 follow-ups (listed in the PR body)
- [ ] Remove stray `cn@^0.2.6` dependency (`cn()` lives in `lib/utils.ts`).
- [ ] Move `shadcn` out of runtime `dependencies` (CLI → devDeps or `npx`).
- [ ] Replace `/about` placeholders: FAQ Q&A, stock hero gallery + feature image.
- [ ] Commit `6067e97` carries an AI `Co-Authored-By` trailer; repo rule bans AI attribution → fix at squash-merge.

### Infra / launch blockers (carried over)
- **Supabase free tier auto-pauses** — it paused again on 2026-10-20 (hostname `ENOTFOUND`; prod 500s on
  every DB page until the user restored it). Must move off the pausing tier before launch. The Supabase
  MCP connected in Claude sessions is a *different* account (can't see/restore this project).
- Real PayPal donate URL (`PAYPAL_DONATE_URL` in `lib/flags.ts` is a placeholder).
- Rotate the Supabase DB password (leaked to a transcript); real editor accounts.
- Dedicated `article-covers` Storage bucket + `remotePatterns` entry (covers currently piggyback on `board-photos`).

### Test-suite hazard
- `tests/e2e/init/init-web-001.spec.ts` / `init-web-002.spec.ts` **re-seed the fake articles from
  `lib/seed/fixtures.ts` into the shared DB, which is prod**. Running the full e2e suite will put the two
  fake stories back on the live site. Fix: point e2e at a non-prod Supabase project, or retire those
  fixtures. Until then, run only targeted specs (`-g`).

## Next feature — home page layout update

> **2026-10-21:** assessed and specified. See `docs/features/softball/home-layout/assessment.md`
> (pros, cons, decisions) and **`design-guide.md`** (the binding spec and the 5 implementation
> slices). The notes below are the original raw read of the comp.

Sample designs (untracked, repo root; **do not commit as-is**):

- **`softball-layout.jpeg`** — target home page, top to bottom:
  1. Nav: Home · About · National Teams · Events & Results · Join Us · Support · News · Contact + yellow "Support the Federation" pill.
  2. Hero: full-bleed team photo, "VIRGIN ISLANDS / SOFTBALL / FEDERATION", tagline "From the Virgin Islands to the World.", CTAs Explore Our Teams · Upcoming Events · Support the Federation.
  3. Stat strip (3): Women's National Team **No. 32** WBSC ranking *(unverified)* · 2026 CAC Games **Silver** · U18 Girls' National Team "Preparing for the 2026 U-18 Women's Pan American Championship".
  4. "Our National Teams": two photo cards (Women's National Team, U18 Girls' National Team) → Learn More.
  5. Upcoming event band: **2026 U-18 Women's Pan American Championship, Nov 21–28, 2026, San Salvador, El Salvador** → Event Details.
  6. "Get Involved" (3 cards): Athletes & Parents · Coaches, Umpires & Volunteers · Support ISV Softball.
  7. "Latest News": 3 photo cards (Women Earn Silver · Pan American Campaign · One Caribbean Title) → More News.
  8. Navy footer: crest, contact (email/location/phone), Facebook + YouTube, "From the Virgin Islands to the World."
  Implications: Teams + Events are currently flag-gated OFF (`NEXT_PUBLIC_TEAMS_ENABLED` / `NEXT_PUBLIC_EVENTS_ENABLED`); the design needs national-team pages + an events surface, and real photos. The sample's contact details (`info@usvsoftball.org`, `(340) 555-0123`, © 2025) are mock placeholders — use real `contact_info` rows.
- **`softball-schedule.jpeg`** — Federation U18 El Salvador travel schedule (arrivals Nov 17–21, departures
  Nov 23–29, SAL). Useful as an **upcoming-event content source** and as the name-spelling reference
  above. ⚠️ It lists **minors' names with flight numbers/times** — never publish it or its itinerary
  publicly.

Also untracked: `.fly.toml.swp` (a stale vim swap file — not project content).
