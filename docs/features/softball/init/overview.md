# softball/init — USVI Softball Federation Platform (program umbrella)

## Problem statement

The **US Virgin Islands Softball Federation** — a non-profit whose mission is to *develop
softball in the Virgin Islands* — competes across the Caribbean and South America and, in
**March 2023, hosted a large tournament on St. John** that drew real attention. It had **no website
able to convert that attention** into followers, donors, or customers, so the moment was lost.

The Federation needs a single public platform that turns attention into **fans, donors, and
funds** and becomes the **system of record** for VI softball. Concretely it must:

1. **Capture & keep an audience** with an ESPN-style **news feed** for VI softball — articles
   with photos, authored by Federation members, plus an **AI drafting assistant** that proposes
   drafts from sources for editors to review, edit, and publish.
2. **Raise money** as a non-profit — **online donations** *and* **merchandise sales**.
3. **Showcase the sport** — **team and player profiles** (bios, stats, highlights), **coaches**,
   an **events/tournament archive** (starting with St. John, March 2023), and an **about** section
   covering the mission and **board-member profiles**.
4. Let non-technical Federation staff **upload and manage** all of the above through an admin
   portal, with an **editorial review gate** before anything goes public.

**Why now:** attention is event-driven and perishable. Without a live platform before the next
tournament cycle, each event's audience evaporates again. The bet: a credible, content-rich,
donation-ready site compounds each event's attention into a standing base of support.

> **This `init` feature is the program umbrella.** It establishes the platform WHY, the shared
> information architecture, the entity registry, and a build roadmap. Each capability then runs
> its own ECA loop (see §Roadmap). It is *not* a single shippable feature.

## Target users

**Public (unauthenticated) — the growth surface**
- **P1 — The Fan / Community Member (VI local & diaspora).** Follows VI softball, wants news,
  scores, team & player pages, event recaps. Mobile-first, often on Caribbean mobile networks.
  *Success:* comes for a game recap, subscribes/returns, maybe donates or buys a shirt.
- **P2 — The Supporter / Donor.** Believes in the mission (often diaspora or local business).
  Wants a trustworthy, frictionless way to give — one-time or recurring — and a tax receipt.
- **P3 — The Fan-Buyer.** Wants team merch (caps, jerseys, tournament tees) shipped or picked up.
- **P4 — The Player / Coach / Parent.** Looks up their own or a teammate's profile, stats, and
  highlights; shares the page. A source of pride and of social reach.
- **P5 — Press / Partner / Sponsor / Visiting Federation.** Evaluates the Federation's
  credibility (WBSC/Caribbean bodies, potential sponsors) — the site is the front door.

**Authenticated — the operators**
- **P6 — Contributor / Author (Federation member).** Submits articles with photos; may trigger
  the AI drafter. Not a developer; needs a dead-simple editor. *May not publish directly.*
- **P7 — Editor / Content Admin.** Reviews drafts (human + AI), edits, **publishes or removes**;
  curates the feed and homepage.
- **P8 — Data Steward.** Uploads/maintains teams, players, coaches, stats, events, board members
  — the structured content behind the profiles.
- **P9 — Store / Finance Admin.** Manages products, orders, fulfillment, and reconciles
  donations; owns the money surface.
- **P10 — Site / Super Admin.** Manages users, roles, and settings; accountable for the platform.

*(Roles P6–P10 will collapse onto a handful of real volunteers — likely 2–5 people wearing
multiple hats. The role model must support one person holding several roles.)*

## Primary journeys (to validate in EventStorming)

1. **Attention → audience:** tournament happens → editor publishes recap + photos (some AI-drafted)
   → fan lands from social → reads → follows a team/player → returns / subscribes.
2. **Attention → funds:** supporter reads mission + a compelling story → clicks Donate → gives
   (one-time or recurring) → gets a receipt → optionally buys merch.
3. **Content pipeline:** contributor drafts an article (or AI generates a draft from sources) →
   editor reviews/edits → publishes → appears in feed → can be unpublished/removed.
4. **Structured-content upload:** data steward creates a team → adds players/coaches with bios,
   stats, highlights → links them to an event → public profile pages render.
5. **Event archive:** admin uploads a past event (St. John, March 2023) with results, galleries, and
   participating teams → becomes a permanent, shareable page.

## Key pain points / risks (ranked)

1. **Perishable attention with no capture mechanism** *(the core pain)* — the reason the March 2023
   moment was lost. Everything else serves this.
2. **Non-technical volunteer operators** — a heavy/enterprise stack (self-hosted Magento, complex
   CMS) will not survive contact with a small volunteer team. Simplicity is a hard requirement.
3. **AI-article copyright/plagiarism exposure** — "generate from various sources" is a real legal
   risk if it reproduces third-party copyrighted text. Needs guardrails + a human editorial gate
   (see research/ domain brief). This is why draft→review→publish is non-negotiable.
4. **Money surface = T3 stakes** — donations + merch bring PCI, tax-receipt, and trust
   obligations. Offloading card handling to a PCI-compliant processor is strongly indicated.
5. **Data cold-start** — profiles/stats/events must be uploaded before the site looks alive;
   bulk-upload / low-friction data entry matters for launch.
6. **Small budget / small team** — favors managed/SaaS over self-hosted infra; TCO drives the
   ecommerce decision (see research/ ecommerce brief).
7. **Connectivity** — Caribbean mobile-first audience; performance and image optimization matter.

## Scope

**In (platform umbrella):**
- Public site: home, news feed + article pages, teams & players, coaches, events/tournament
  archive, about + board members, donate, shop.
- Admin/editorial portal: auth + roles, article authoring, **draft → review → publish/remove**
  editorial workflow, AI draft generation, structured-content management (teams/players/coaches/
  events/board), store & order management, donation reconciliation.
- Commerce: online **donations** and **merchandise** (see §Open questions — likely *two* flows).
- Shared: information architecture, design system, entity registry, deployment.

**Out (for now / explicitly deferred):**
- Live scorekeeping / in-game stat capture (stats are uploaded/imported, not live-tracked).
- Native mobile apps (responsive web only).
- Ticketing / event registration (candidate for a later feature; not in the initial ask).
- Multi-language (VI is English-speaking; revisit for Spanish given South America ties).
- User-generated public accounts/social features for fans (fans are anonymous readers at launch).

## Tier & activation manifest
<!-- Written by /triage. Downstream commands read this and activate ONLY what it names. -->
- **Tier:** **T3 Campaign** (full apparatus)
- **Reversibility:** irreversible (auth model, payment integration, published public content &
  donor data are one-way once live)
- **Stakes:** high (money, PII, public credibility of a non-profit)
- **Auto-escalation triggers fired:** **auth** (T3), **money/billing** (T3), **PII/sensitive
  data** (T3), **public-facing** surface. Any one forces T3; three fire.
- **Active subagents:** research-synthesizer ✔ (this phase), dcon ✔ (donations/orders/publish
  write data), red-team-code ✔, red-team-interactive ✔ (auth + payments), chaos ✔ (post-ship).
- **Active checkpoints:** all (see status.md).
- **Required artifacts:** full framing (this doc), design doc/RFC per child feature, prototype for
  genuinely novel interactions (AI-draft review UX), full BDD traceability on money/auth flows.
- **De-escalation rationale:** n/a (no downgrade requested).
- **Note:** the umbrella is T3; individual child features re-triage on their own (e.g. a static
  "board member profile" page may be T1). Triage per child at its `/empathize`.

## Roadmap — decomposition into child features
<!-- Proposed. The umbrella establishes shared IA + entities; these ship independently. -->
| Feature | What | Likely tier | Depends on |
|---|---|---|---|
| `softball/foundation` | Site shell, design system, nav/IA, layout, deploy pipeline | T2 | — |
| `softball/news` | News feed + article pages, categories, photos | T2 | foundation |
| `softball/admin-portal` | Auth, roles, editorial dashboard | T3 (auth) | foundation |
| `softball/ai-drafts` | AI draft generation + review workflow | T3 (content/legal) | news, admin-portal |
| `softball/teams-players` | Team/player/coach profiles, stats, highlights | T2 | foundation |
| `softball/events` | Event/tournament archive (St. John, Mar 2023 first) | T2 | teams-players |
| `softball/about` | Mission + board-member profiles | T1 | foundation |
| `softball/store` | Merchandise catalog + checkout + orders | T3 (money/PII) | foundation |
| `softball/donations` | One-time + recurring donations + receipts | T3 (money/PII) | foundation |

## Design / RFC notes
Full RFC deferred to child features. Two cross-cutting architectural decisions belong to the
umbrella and are called out under §Open questions: (a) backend/data platform, (b) commerce stack.

## Decisions locked (2026-07-09, human)
0. **Architecture → full Next.js web app (no Go/gRPC).** Backend logic runs in Next.js (route
   handlers / server actions) talking to **Supabase via `supabase-js`**. **Deploy target: Fly.io.**
1. **Backend / data platform → Supabase (Postgres + Auth + Storage).** Structured data (articles,
   players, teams, events, board, products, orders, donations) lives in Supabase Postgres; auth is
   **Supabase Auth**; media in **Supabase Storage**. (Neon dropped in favour of Supabase for the
   integrated auth+DB+storage.)
2. **CMS → built into the admin, not third-party.** Lightweight content-management tooling is part
   of the app's admin section; add capabilities incrementally to keep costs low. (No Sanity/Payload.)
3. **Commerce → split flows, both app-native.** Merch via **Stripe Checkout embedded in Next.js**,
   with **product / inventory / order management built into the app admin** (Product & Order live in
   our DB — *not* an external platform; supersedes the "external platform" option in entities.md).
   Magento/BigCommerce/Snipcart **not** used.
4. **Donations → separate Stripe flow.** Kept distinct from merch (fee eligibility + tax receipts).
   Givebutter/Donorbox remain an *option* for turnkey recurring/receipts; default is Stripe-native.
5. **Existing prototype → ignore; start clean** in this repo.
6. **Team model → persistent team hubs.**
7. **News voice → bylined member authors** (contributors submit; editors publish).
8. **First build slice → Foundation + News feed** (incl. the editorial draft→review→publish workflow).

## Still open (to confirm / defer)
- **AI drafter source policy** — re-scoped to owned/licensed sources + human review + provenance
  (design settled; the *specific owned sources* the Federation can feed it is a content question for them).
- **Authz mechanism** — simple **RBAC** (confirmed direction for a volunteer team); role rows in
  Supabase, enforced in route handlers (+ optional Postgres RLS). Not SpiceDB. Ratify in `/plan`.

## Resolved facts (2026-07-09)
- **✅ Flagship event = St. John, March 2023** (H9 closed — Federation-confirmed).
- **✅ Auth = Supabase Auth. ✅ Hosting = Fly.io. ✅ No Go backend.**

## Research
- **Prior lessons applied:** `06-27-2026-entities-registry-living-artifact` (entities.md as a
  living per-phase artifact); empathize scenario-discipline lessons (`identity-refine-01/02`).
  All Jouvae *technical* lessons (Go/GORM/SpiceDB) deliberately **not** applied — wrong stack
  (see `lessons.md` L-init-01).
- **Entities touched:** none pre-existing (`docs/entities.md` created fresh this phase).
- **Ecommerce platform comparison:** `docs/research/ecommerce-platform-comparison.md` ✔ (2026-07-09).
  **Verdict:** Magento/Adobe Commerce **disqualified** on cost + ops burden for a volunteer
  non-profit (Adobe Commerce license alone $22K–$125K+/yr; Magento OSS "free" = $30K–$60K first-yr
  TCO + a standing PCI obligation). BigCommerce wins *that* head-to-head but is more platform than a
  tens-of-SKU merch table needs. **Recommended instead: split the two problems** — donations via
  **Givebutter/Donorbox on Stripe** (non-profit 2.2%+30¢ rate, auto tax receipts, recurring built-in);
  merch via **Snipcart or Stripe Checkout** dropped into Next.js (days, not months). Total software
  cost ~<$100/mo vs tens of $K/yr. **BigCommerce (never Magento) is the fallback** if the board
  insists on one unified platform. **Keep donations separate from merch** regardless (fee eligibility
  + tax-receipt compliance). Resolves hotspots **H1/H2** toward "two flows, offloaded processor."
- **Domain + comparable-org IA + AI-article risks:** `docs/research/domain-and-comparables.md` ✔ (2026-07-09).
  **Key findings:** (a) adopt **persistent team hubs** (ESPN/college model), not WBSC's
  tournament-scoped rosters, since the Federation wants standing profiles; (b) mirror the **VI Olympic
  Committee's geographic board seats** (St. Thomas/St. John, St. Croix, at-large) and store board
  **term** ("2025–2027"); (c) events use an **"Editions" archive** (year-over-year); (d) confirmed
  ESPN player/team field lists sharpen the content model (see §Entities reconciliation); (e) **stats =
  manual/CSV import** — GameChanger has no usable API; (f) highlights = **YouTube embeds**; (g) the AI
  drafter must be re-scoped to **owned/licensed sources + mandatory human review + stored provenance**
  (active-litigation-grade copyright risk otherwise).
- **Facts resolved / noted (2026-07-09):**
  1. **✅ Flagship-event date = St. John, March 2023** (Federation-confirmed; brief's "2024" corrected).
  2. Existing prototype `usvisoftball.vercel.app` — **decision: ignore, start clean** in this repo.
  3. Specific affiliations/competition history — still take from the Federation, don't invent.
- **Primary research input:** the client brief (2026-07-09) — the human-gathered source this
  synthesis is grounded in. No findings invented beyond it + cited external research.
