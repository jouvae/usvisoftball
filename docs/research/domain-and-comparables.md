# Domain & Comparable-Org Research — USVI Softball Federation

**Prepared:** 2026-07-09
**Purpose:** Ground the platform's information architecture, content model, stats approach, editorial
roles, and the AI-article feature's legal guardrails in verified patterns from peer organizations.

> **Method caveat:** WBSC.org and The Athletic hard-block automated fetching. WBSC findings come from
> Wayback Machine snapshots; its player/rankings pages are client-rendered SPAs, so page *structure*
> and stat-field *labels* are confirmed but individual data rows are not. The Athletic was inaccessible.
> Verified facts are separated from best-practice patterns throughout.

---

## 0. Critical callouts (read first)

1. **⚠️ The "2024 St. John tournament" date doesn't match the public record.** The closest verified
   event appears to be **March 2023**, not 2024. **Confirm the actual event + date with the federation**
   before publishing it as the flagship event. (This is exactly the kind of fact Empathize must not
   invent — flagged, not corrected.)
2. **⚠️ An existing prototype already exists:** a site with matching branding at
   **`usvisoftball.vercel.app`** ("Juvae"/Jouvae branding — consistent with the `tony@jouvae.com`
   owner). Review it before building; it likely encodes prior decisions, content, and design intent.
3. **⚠️ The AI-article generator "from various sources" carries active-litigation-grade copyright
   risk.** Re-scope to **owned/licensed source material + mandatory human editorial review + stored
   provenance/attribution**. See §4.
4. **Stats: plan for manual CSV import.** GameChanger (the dominant amateur scorekeeping app) has **no
   usable public API**. Expect volunteer manual entry or CSV upload, not a live integration. See §3.

---

## 1. The organization & context (verified vs unverified)

- The federation governs/promotes softball in the US Virgin Islands (a multi-island territory:
  **St. Thomas, St. John, St. Croix** — this geography matters for the board/team structure, see §2).
- Caribbean/Pan-American softball sits under **WBSC** (World Baseball Softball Confederation) and its
  regional bodies; USA Softball is the US national governing body and a structural model for board/org
  pages. *Specific USVISF affiliations, tournament results, and the flagship-event date should be
  confirmed with the federation — not asserted from web research.*

## 2. Comparable-site information architecture (what "good" looks like)

**WBSC.org** — two IA choices that force a design decision for USVISF:
- **News is org-voiced, no author byline** (unlike ESPN), under a large flat 60+ tag taxonomy mixing
  topic/competition/region/type. → *Decision: does USVISF want bylined member authors (ESPN model) or
  org-voice? The brief assumes **bylined**, since members author articles.*
- **No persistent team hubs** — a team exists only *inside* a tournament (`/events/{event}/teams/{id}`)
  plus a world-ranking slot. **This is a real fork for USVISF:**
  - **Persistent team hubs** (ESPN/college model) — ongoing Team → Player → stats pages. **Recommended**,
    since USVISF explicitly wants standing team/player profiles.
  - **Tournament-scoped rosters** (WBSC model) — lighter, but no evergreen player pages.
- **Event page sub-nav template (clean, reusable):** Home / News / Teams & Rosters / Schedule & Results
  / Standings / Stats / Event Info / **Editions** (past-year archive). → Adopt this for the USVISF
  tournament/event archive, with **Editions** giving each event a permanent, year-over-year home.

**Board-page patterns (directly actionable):**
- **USA Softball** board fields: photo, name, email, position, region, **term ("2025–2027")**; plus a
  PDF archive of agendas/minutes. Sponsors = tiered logo grid. Donate is minimal (single CTA).
- **VI Olympic Committee** (most directly comparable *local* body): board uses a **geographic-seat
  structure** (VP–St. Thomas/St. John, VP–St. Croix, at-large) — **mirror this** given USVI's
  multi-island makeup. Each member: photo, title, bio. Keeps **separate permanent pages per board term**
  (doesn't overwrite). Funds itself via **merchandise rather than a donate page**.
- **Cross-cutting:** donate pages are consistently *underbuilt* even at national scale, and their links
  bit-rot. → USVISF's donate/merch flow is an **opportunity to beat peers**, not just match them.

**ESPN / team-hub confirmed field lists (sharpen the content model):**
- **Player profile:** name / team / number / position; vitals (HT, WT, birthdate+age, birthplace,
  **bats/throws**); season summary with league rank; stat table across **Regular Season / Career**;
  splits; game log; player news feed.
- **Team hub core taxonomy** (consistent across ESPN, MiLB, college softball): Roster / Schedule /
  **Results (separate from Schedule)** / Standings / Stats (split **Hitting + Pitching** tabs). Rosters
  group by position with No. / B–T / HT / WT / DOB / Hometown; college adds Class + Previous School.

## 3. Player/team stats & highlights

- **Softball stat set (from confirmed ESPN/WBSC labels):**
  - *Hitting:* GP, AB, R, H, 2B, 3B, HR, RBI, BB, SO (+ AVG/OBP/SLG derivable).
  - *Pitching:* separate block (IP, W-L, ERA, K, BB, etc.).
  - *Fielding:* separate block.
- **Capture reality for a volunteer org:** **manual entry or CSV import**, not live tracking.
  **GameChanger has no usable public API** — the common amateur scorekeeper can't feed the site
  automatically. Design a simple stats entry/CSV-upload path; treat any scorekeeper integration as
  out-of-scope for launch.
- **Highlights:** **YouTube (or similar) embeds** are the pragmatic choice over self-hosted video
  (bandwidth, storage, transcoding). Player/Team profiles reference highlight embeds.

## 4. AI article generator — approach & RISKS (⚠️ most important)

- **The risk:** generating articles "from various sources" (i.e., scraping/ingesting third-party
  copyrighted news) and republishing derived text is **active-litigation-grade copyright exposure**
  (ongoing suits over training/output on copyrighted news). Reproducing or closely paraphrasing
  third-party articles is the core hazard.
- **Re-scope to a safe design:**
  1. **Owned/licensed sources only** — the federation's *own* material: game notes, box scores,
     press releases, interviews, photos, and licensed wire content. Not open-web scraping of news sites.
  2. **Drafting aid, never autopublish** — AI produces a **draft** that a human **editor must review,
     fact-check, and edit** before publishing. This is the non-negotiable editorial gate.
  3. **Store provenance** — record which sources and model produced each draft (`ai_provenance`), so
     attribution and an audit trail exist if a claim of infringement or inaccuracy arises.
  4. **Attribution & original voice** — encourage original phrasing + cite facts to owned sources;
     avoid reproducing third-party expression.
- **Editorial workflow (maps to EventStorming Content context):**
  `draft (human OR ai) → in_review → editor edits → published → (unpublished/removed)`.

## 5. Roles for the site (maps to overview P6–P10 / entities Role enum)

- **Public visitor** — reads published content; no account.
- **Contributor/Author** (federation member) — submits articles + photos; may trigger AI draft;
  **cannot publish**.
- **Editor/Content admin** — reviews (human + AI) drafts, edits, **publishes/unpublishes/removes**.
- **Data steward** — maintains teams/players/coaches/events/board (structured content).
- **Store/Finance admin** — products, orders, donations reconciliation.
- **Site/Super admin** — users, roles, settings.
- One person will hold several roles (small volunteer team).

## 6. Consolidated content model (recommended for the build)

`NewsArticle` (headline, category, tags, optional author byline, date, hero image, body, related) ·
`Team` (name, logo, roster, schedule, **results**, standings) · `Player` (name, photo, position,
number, bio/vitals incl. **bats/throws**, hometown, **season + career** stats, highlight embeds,
related news) · `Event` (name, dates, venue, teams, bracket/standings, results, **editions archive**) ·
`BoardMember` (name, title/**seat**, photo, bio, **term**) · `AboutPage` (mission, history, symbols) ·
`DonationTier` + `MerchItem` (name, price, image, checkout link). — reconciled into `docs/entities.md`.

## Sources
- wbsc.org (via Wayback Machine), usasoftball.com, virginislandsolympics.org, espn.com, milb.com,
  soonersports.com. (Field lists confirmed from live/archived structure; some SPA data rows not fetchable.)

## Flagged unverified / to confirm with the federation
- The flagship-event **date** ("2024 St. John" vs a verified ~March 2023 event).
- Specific USVISF affiliations, competition history, and results.
- Contents/decisions encoded in the existing **`usvisoftball.vercel.app`** prototype (review directly).
