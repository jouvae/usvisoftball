# Platform Entity Registry — USVI Softball Federation

> Canonical, versioned registry of every platform entity. A first-class **input and output of
> every ECA phase**. Consult before synthesizing; reconcile as discoveries land. Entities not yet
> ratified are marked *proposed — {feature} {phase}; ratify in /plan*; entities whose contracts
> have shipped are marked **ratified — {feature} /actualize; migrations {nnnn}**.
>
> **Version:** 0.2.0 (partially ratified) · **Updated:** 2026-07-31 · **Seeded by:** softball/init
> (Empathize) · **Ratified by:** softball/init (/actualize Step 1 — Content/Editorial *Article* +
> Identity/Access *User*/*Role*, against migrations `0001`–`0005`)

## Mental model

The platform is a **content + commerce hub for VI softball**. Three loosely-coupled contexts:

1. **Content/Editorial** — news articles (human- and AI-drafted) flow through a
   draft → review → published lifecycle. The growth engine.
2. **Registry** — the structured, evergreen record of the sport: teams, players, coaches,
   events, board members, and their stats/media. The credibility engine.
3. **Commerce** — donations and merchandise; the money engine. Card handling is expected to be
   **offloaded to a PCI-compliant processor** (see ecommerce research), so PANs never touch us.

A small set of **Users** with **Roles** operate contexts 1–2 through an admin portal; the public
consumes read models of all three.

## Core entities

> **Status legend.** **ratified** = the contract shipped and was human-confirmed (cite migrations);
> *proposed* = seeded/reconciled but not yet built (ratify in a future `/plan`). Only the
> Content/Editorial **Article** and the Identity/Access **User**/**Role** were realized by
> `softball/init`; the Registry and Commerce contexts remain wholly *proposed — deferred*.

### Content/Editorial context
- **Article** — **ratified** (softball/init /actualize; migrations `0001`, `0002`, `0003`, `0004`,
  `0005`). A news post, realized as `public.articles`. Shipped fields: `id` (uuid PK), `title`,
  `slug` (unique), `body`, `excerpt`, **`cover_image_url`** + **`cover_image_alt`** (split, not a
  single `cover_image`), **`author_name`** (denormalized byline, `not null`), **`author_id`**
  (→`auth.users`, **nullable** — pre-auth/seed rows stay NULL, backfill deferred), `category`,
  `status` (`draft|in_review|published|unpublished`, CHECK-constrained), `source` (`human|ai`,
  CHECK), **`gallery`** (inline `jsonb` array of `{ url, alt }`, `not null default '[]'`, CHECK
  `jsonb_typeof = 'array'`), **`ai_provenance`** (nullable `jsonb` `{ source, model }`; CHECK
  `source <> 'ai' OR ai_provenance IS NOT NULL` makes it mandatory for AI rows), `published_at`
  (CHECK `published ⇒ published_at IS NOT NULL`), `created_at`, `updated_at`. **Lifecycle**
  `draft → in_review → published ⇄ unpublished`, enforced at the DB (see §Authz). Ratified shipped
  realities that differ from the original draft: `gallery` is **inline `jsonb`, not** a MediaAsset
  relation (MediaAsset stays *proposed/deferred* — no upload pipeline); `ai_provenance` is a
  **single-source** `{ source, model }` (widen to `sources[]` if a real AiDraftJob later carries
  many). Still *proposed — deferred* on Article: **`tags[]`** (no column shipped) and **rich-text
  `body`** (the prototype `body` is plain text, React-escaped; `dangerouslySetInnerHTML` on
  DB-sourced content is banned — a future rich-text slice must pick a renderer/sanitizer).
- **MediaAsset** *(proposed — deferred; not built by softball/init)* — an uploaded image/photo (and
  later video/embed). `url`, `alt`, `credit`, `uploaded_by`, dimensions. Referenced by Article,
  Player, Team, Event, BoardMember. Article's `gallery` uses an inline `jsonb` shape until an upload
  pipeline exists; MediaAsset remains the target model for that relation.
- **AiDraftJob** *(proposed — standalone table deferred; partially realized on Article)* — a request
  to generate an Article draft. **Re-scoped for copyright safety** (domain research §4): `sources[]`
  must be **owned/licensed** material (game notes, box scores, press releases, interviews, licensed
  wire) — **not open-web scraping**; `prompt/params`, `model`, `status`, `result` (→Article draft,
  always `status=draft` — **never autopublish**), `ai_provenance` (sources + model, stored as an
  audit trail), `requested_by`. Mandatory human editorial review before publish. **What shipped
  (softball/init, migration `0005`):** the mandatory-human-review guarantee is realized **minimally**
  by folding provenance onto the Article — `source='ai'` + `ai_provenance` `{ source, model }` + the
  `status='draft'` insert-only workflow (an AI row is impossible to INSERT at any status other than
  `draft`, at the DB). A **standalone `ai_draft_jobs` audit table remains *proposed/deferred***.
  Generation is a deterministic in-app stub (`model='stub'`, `lib/ai-draft.ts` `generateDraft` — the
  clean swap-in seam for the real Claude call); the owned/licensed source list is a placeholder
  (`lib/ai-sources.ts` — the Federation still owes the real one).

### Registry context *(proposed — deferred; no Registry entity was built by softball/init)*
- **Team** — persistent hub (ESPN/college model, per domain research). `name`, `slug`, `logo`,
  `division/category`, `bio`, `roster` (→Player[]), `coaches` (→Coach[]), `schedule`, `results`
  (**separate from schedule**), `standings`, `events` (→Event[]), `stats` (aggregate, split
  Hitting/Pitching). Public profile page.
- **Player** — `name`, `slug`, `photo`, `bio`, `team` (→Team), `positions[]`, `jersey_number`,
  vitals (`height`, `weight`, `birthdate`, `birthplace`, **`bats_throws`**), `hometown`,
  `stats` (Regular Season **and** Career — hitting: GP,AB,R,H,2B,3B,HR,RBI,BB,SO; pitching &
  fielding blocks), `highlights[]` (→MediaAsset / **YouTube embed**), related news.
- **Coach** — `name`, `slug`, `photo`, `bio`, `role`, `team(s)`. (May be a Person specialization.)
- **Event** — a tournament/game/past event. `name`, `slug`, `location/venue`, `start/end`,
  `description`, `participating_teams[]`, `bracket/standings`, `results`, `gallery[]`, `status`,
  **`edition`** (year-over-year archive grouping, per WBSC "Editions" pattern). Flagship seed
  record: the **St. John tournament — March 2023** (Federation-confirmed).
- **BoardMember** — `name`, `title`/**`seat`** (geographic: St. Thomas/St. John, St. Croix,
  at-large — mirrors VI Olympic Committee), `photo`, `bio`, **`term`** ("2025–2027"), `order`.
  Board pages kept **per-term (permanent, not overwritten)**. Part of the About section.
- **Stat** *(shape TBD)* — softball stats attach to Player (and aggregate to Team), split into
  Hitting / Pitching / Fielding. **Capture = manual entry or CSV import** (GameChanger has no
  usable API — no live integration at launch).

### Commerce context — **app-native** *(proposed — deferred; no Commerce entity was built by softball/init)* (decision 2026-07-09: local DB + Stripe Checkout, no external platform)
- **Product** — merch SKU, managed in the app admin. `name`, `slug`, `description`, `images[]`,
  `price`, `variants[]` (size/color, each with own SKU/price/**inventory_qty**), `status`
  (`draft|active|archived`), `stripe_price_ref`. Lives in **our Postgres**.
- **Order** — a merch purchase via **Stripe Checkout**. `line_items[]` (→Product/variant, qty,
  unit_price), `customer` (name/email/shipping — PII), `totals`, `status`
  (`pending|paid|fulfilled|cancelled|refunded`), `stripe_session/payment_ref`, timestamps. Lives
  in our DB; Stripe is the processor/source-of-truth for payment. Inventory decremented on `paid`.
- **Donation** — separate **Stripe** flow. `amount`, `frequency` (`one_time|recurring`), `donor`
  (name/email — PII), `stripe_payment/subscription_ref`, `receipt_sent`, `campaign?`, timestamps.
  Distinct from Order (donation ≠ cart; different fee eligibility + tax-receipt handling).

### Identity/Access context
- **User** — **ratified** (softball/init /actualize; migration `0003`). An authenticated operator,
  realized as **`public.profiles`** (1:1 with Supabase Auth `auth.users`): `id` (→`auth.users`,
  `on delete cascade`), `name`, **`roles text[]` `not null default '{}'`**, `status`
  (`active|disabled`), `created_at`, `updated_at`. Email/auth-provider identity lives on
  `auth.users` (not duplicated). Every new `auth.users` row auto-creates an **empty-roles** profile
  via the `handle_new_user()` AFTER-INSERT trigger — a fresh account has no powers (no public
  signup, no self-escalation).
- **Role** — **ratified as a mechanism** (softball/init /actualize; migration `0003`). Realized as
  **membership in `profiles.roles`** (a `text[]`), **not** a join table; one user may hold several.
  **Authorization is simple RBAC enforced at the database via RLS** — **not SpiceDB** (decision
  2026-07-09). A **`has_role(uid, role)` SECURITY DEFINER** SQL helper is the choke point every
  article policy calls; roles are **assigned ONLY by the service role** — a **column-level GRANT**
  (`update (name)` only) makes `profiles.roles` non-user-writable at the privilege layer, and the
  seed path (`lib/roles.ts` `assignRoles`, service client) is the only writer. Realized/enforced
  roles this feature: **`contributor`** and **`editor`** (see §Authz). The remaining roles
  `data_steward | store_admin | finance_admin | super_admin` (overview P6–P10) stay
  *proposed — deferred* until their Registry/Commerce/settings surfaces are built.

## Authz schema — **simple RBAC enforced at the database via RLS** (SpiceDB: **N/A**)

> **SpiceDB is not used** on this platform (decision 2026-07-09; there is no `.zed` schema). This is
> a standalone **Next.js 16 + Supabase** app, not the Jouvae Go/gRPC/SpiceDB monorepo. Authorization
> is **simple RBAC** via `profiles.roles` + the `has_role()` SECURITY DEFINER helper, enforced by
> **Postgres RLS** on `public.articles` (render-time gating in Server Actions is a convenience layer,
> never the boundary). The rows below marked **ratified** match the shipped policies; the
> Registry/Commerce/admin rows stay *proposed — deferred* until those surfaces are built.

The **Article** access model as shipped (migrations `0001`, `0003`, `0004`, `0005`; RLS policies are
permissive and **OR-combined**):
- **Public (`anon`) — ratified:** SELECT `articles` **only where `status='published'`**
  (`articles_public_read_published`, `0001`); `anon` holds a whole-table SELECT grant and **no**
  INSERT/UPDATE/DELETE — drafts/in_review/unpublished are invisible at the DB, not by a query filter.
  Public read of Registry/Commerce read-models and Donation/Order checkout remain *proposed —
  deferred*.
- **Contributor — ratified:** may INSERT/UPDATE **only their own** (`author_id = auth.uid()`)
  **`human`** article while `status IN (draft, in_review)`; **cannot publish** — reaching
  `published` fails every WITH CHECK by construction (`articles_contributor_insert` /
  `articles_contributor_update` / own-read `articles_contributor_read_own`, `0003`).
- **Editor — ratified:** SELECT **any** row (the review queue) and UPDATE **any** row — edit the body
  and transition status, including `published` (sets `published_at=now()`) and
  `published → unpublished` (`articles_editor_read_all` / `articles_editor_update`, `0004`). The
  permissive OR-composition leaves the contributor "cannot publish" barrier intact.
- **AI draft insert — ratified:** a `contributor` **or** `editor` may INSERT an `author_id=self`,
  `status='draft'`, `source='ai'`, `ai_provenance IS NOT NULL` row (`articles_ai_draft_insert`,
  `0005`); coexists with the `source='human'` contributor policy (disjoint on `source`). The DB makes
  it **impossible to INSERT an AI row at any status other than `draft`** — the "never auto-published"
  property.
- **Data steward** *(proposed — deferred)*: CRUD Registry entities (Team/Player/Coach/Event/
  BoardMember) + MediaAssets.
- **Store/Finance admin** *(proposed — deferred)*: CRUD Products; read/manage Orders + Donations.
- **Super admin** *(proposed — deferred)*: manage Users/Roles/settings; superset of all.

> Decision (2026-07-09, **ratified**): **simple RBAC**, not SpiceDB — fits a small volunteer team.
> Role membership in `profiles.roles` (Supabase Postgres), enforced by **Postgres RLS** (the
> "+ optional RLS" of the original note became the **primary** boundary). Auth via **Supabase Auth**
> (`auth.users`); the `/admin` guard checks authentication server-side via `supabase.auth.getUser()`
> (never `getSession()`). Full **Next.js** app (no Go), deployed to **Fly.io**, `supabase-js` for
> auth + DB + storage.

## Appendix A. Changelog
- **2026-07-09** — Registry seeded (v0.1.0) by `softball/init` Empathize. All entities *proposed*;
  ratify in `/plan`. Contexts: Content/Editorial, Registry, Commerce, Identity/Access. Key open
  questions logged: Stat shape/import, Product/Order ownership (local vs external commerce
  platform), authz mechanism (RBAC vs SpiceDB).
- **2026-07-09** — Reconciled with domain research (`docs/research/domain-and-comparables.md`):
  Team = persistent hub with results-separate-from-schedule + standings; Player gains vitals
  (bats/throws, hometown) + Regular-Season/Career stat split + YouTube highlight embeds; Event
  gains `edition` (year archive) and flags the flagship-event **date as TBC**; BoardMember gains
  geographic **`seat`** + **`term`** + per-term permanence; Stat capture fixed to manual/CSV (no
  GameChanger API); **AiDraftJob re-scoped to owned/licensed sources + provenance + mandatory human
  review** (copyright risk). Still *proposed* — ratify in `/plan`.
- **2026-07-17** — **Auth gate realized (slice 04 conceptualize; ratify in `/plan`).** Operator
  authentication runs on Supabase Auth `auth.users` (seed admin via `auth.admin.createUser`,
  `email_confirm=true`); **no app-level `users`/`roles` table exists yet**. The `/admin` guard checks
  **authentication only** — a server-side `supabase.auth.getUser()` in the admin layout (JWT re-validated
  at the Auth server; **never `getSession()`**, which is unverified on the server). `User.roles[]` / RBAC
  is deferred to slices 05+. **"authenticated ⟺ admin" holds ONLY because there is no public signup
  today** — a temporary property to revisit when public accounts land. No entity was added or renamed.
  *Proposed — softball/init conceptualize; ratify in `/plan`.*
- **2026-07-09** — Locked platform decisions (human): **Supabase/Neon Postgres**; **CMS built into
  admin** (no third-party CMS); **commerce app-native** — Product/Order live in our DB, merch via
  **Stripe Checkout**, inventory/order management in admin (removed the "external platform" option);
  Donations = separate **Stripe** flow; **RBAC** (not SpiceDB); **Supabase Auth** assumed. First
  build slice: **Foundation + News feed**. Still *proposed* until `/plan` ratifies.
- **2026-07-09** — Stack finalized (human): **full Next.js app, no Go**; deploy **Fly.io**;
  **Supabase** for Auth + Postgres + Storage via `supabase-js`. Flagship Event seed date confirmed
  **March 2023** (H9 closed). Still *proposed* until `/plan` ratifies.
- **2026-07-10** — **Article.`gallery` realized (slice 03 conceptualize; ratify in `/plan`).** The
  entity models `gallery[]` as a list of **MediaAsset** references. The prototype implements it as an
  **inline `jsonb` array of `{ url, alt }`** on `public.articles` (migration `0002_articles_gallery.sql`,
  `not null default '[]'`, CHECK `jsonb_typeof(gallery) = 'array'`). Rationale: the gallery is a small,
  ordered, read-mostly list, always rendered wholesale with its article and never queried across
  articles, so a child table would add joins for a query we never run — and **MediaAsset does not exist
  yet** (no upload pipeline). *Proposed — softball/init conceptualize; ratify in `/plan`.* The
  MediaAsset relation remains the target model; the `jsonb` shape is prototype debt, recorded in
  `docs/features/softball/init/status.md` §Open loops.
- **2026-07-10** — **Article.`body` is plain text in the prototype, not rich text** (slice 03). The
  entity calls `body` "rich text"; the article page renders it as React-escaped prose split on blank
  lines. `dangerouslySetInnerHTML` on DB-sourced content is **banned** (stored-XSS: editor- and
  AI-authored bodies are untrusted input). A future rich-text slice must choose a renderer/sanitizer.
  *Proposed — softball/init conceptualize; ratify in `/plan`.*
- **2026-07-10** — **Article lifecycle confirmed load-bearing at the database, not in application
  code** (slice 03). `draft`/`in_review`/`unpublished` rows are invisible to the public `anon` role by
  **RLS policy** (`using (status = 'published')`), not by a query filter. The public by-slug read
  deliberately carries **no** status filter so that a broken policy fails the test suite rather than
  being masked. Treat `status` as a **security-relevant** field, not merely a workflow label.
- **2026-07-17** — **Auth gate realized (slice 04 conceptualize; ratify in /plan).** Operator authentication
  runs on Supabase Auth `auth.users` (seed admin via `auth.admin.createUser`, email_confirm=true); no
  app-level users/roles table exists yet. The `/admin` guard checks AUTHENTICATION only (server-side
  `supabase.auth.getUser()` in the admin layout, JWT re-validated at the Auth server — never
  `getSession()`); `User.roles[]` / RBAC is deferred to slices 05+. "authenticated ⟺ admin" holds ONLY
  because there is no public signup today — a temporary property to revisit when public accounts land.
  Proposed — softball/init conceptualize; ratify in /plan.
- **2026-07-30** — **Roles + authorship realized (slice 05 conceptualize; ratify in /plan).** The
  **User** entity is realized as **`public.profiles`** (`id → auth.users`, `roles text[]` default
  `'{}'`, `name`, `status`), created empty-roles by an `auth.users` AFTER INSERT trigger; roles are
  assigned ONLY by the service role (no public signup, no self-escalation — a **column-level GRANT**
  makes `profiles.roles` non-user-writable). **Article gains `author_id`** (→`auth.users`, **nullable**;
  pre-auth seed rows stay NULL, backfill deferred). §Authz **Contributor** is enforced at the
  **database**: RLS lets a contributor INSERT/UPDATE only their own `human` `draft`/`in_review` rows and
  **cannot reach `published` by construction**, via a `SECURITY DEFINER` `has_role()` helper (avoids
  recursive-RLS on `profiles`). No entity was added or renamed. *Proposed — softball/init conceptualize;
  ratify in /plan.*
- **2026-07-30** — **Editor publish realized (slice 06 conceptualize; ratify in /plan).** §Authz
  **Editor** is enforced at the **database**: migration `0004` adds two **permissive** RLS policies on
  `public.articles` for `authenticated`, each gated by `has_role(auth.uid(),'editor')` — **SELECT-any**
  (the editor-wide review queue sees every row; anon stays published-only, contributor own-read
  unchanged) and **UPDATE-any** (edit the body + transition status). The **Article lifecycle now reaches
  `published`** with `published_at` set (the Server Action writes `published_at=now()`; the 0001 CHECK
  `published ⇒ published_at is not null` is the backstop), and the policy also permits
  `published → unpublished` (forward-correct for slice 08). The permissive OR-composition leaves the
  contributor "cannot publish" barrier **intact** (a contributor passes NEITHER UPDATE WITH CHECK when
  targeting `published`), so `init-e2e-004` stays a genuine negative. No entity was added or renamed.
  *Proposed — softball/init conceptualize; ratify in /plan.*
- **2026-07-31** — AI draft realized (slice 09 conceptualize; ratify in /plan). Article.ai_provenance is
  realized as a nullable jsonb on public.articles ({ source, model }), with a table CHECK
  (source <> 'ai' OR ai_provenance IS NOT NULL) making provenance mandatory for AI rows. Migration 0005
  adds a SEPARATE permissive INSERT policy articles_ai_draft_insert (author_id=self AND status='draft'
  AND source='ai' AND ai_provenance IS NOT NULL AND (contributor OR editor)) that COEXISTS with the
  slice-05 human-source contributor INSERT policy (each pins its own source; permissive policies OR-
  combine) — so the "never auto-published" property is enforced AT THE DATABASE: an AI row cannot be
  INSERTed at any status other than 'draft'. AiDraftJob is partially realized — provenance on the Article
  + the status=draft/review workflow are the mandatory-human-review guarantee; a standalone ai_draft_jobs
  audit table is deferred. Generation is a deterministic in-app stub (model='stub'); the real Claude call
  is a clean swap-in behind lib/ai-draft.ts generateDraft. Owned/licensed sources are a placeholder list
  (Federation owes the real one). Proposed — softball/init conceptualize; ratify in /plan.
- **2026-07-31** — **RATIFIED (v0.2.0) by `softball/init` /actualize Step 1 (promotion gate).** All 9
  first-slice scenarios are `prototyped` and human-confirmed; the contracts SHIPPED, so the *proposed*
  qualifiers are dropped on what genuinely shipped, tied to migrations `0001`–`0005` + `lib/articles.ts`
  / `lib/roles.ts` / `lib/ai-draft.ts` / `lib/ai-sources.ts`:
  - **Article → ratified** (`public.articles`, migrations `0001`,`0002`,`0003`,`0004`,`0005`): status
    lifecycle `draft → in_review → published ⇄ unpublished`; `source` (`human|ai`); nullable
    `author_id`→`auth.users` + denormalized `author_name`; split `cover_image_url`/`cover_image_alt`;
    inline `gallery jsonb` `{url,alt}`; nullable `ai_provenance jsonb` `{source,model}` with the
    `source<>'ai' OR ai_provenance IS NOT NULL` CHECK; `published_at` with the `published ⇒
    published_at NOT NULL` CHECK. Shipped realities ratified as-is: gallery is **inline jsonb, not**
    MediaAsset; `ai_provenance` is **single-source**. Still deferred on Article: `tags[]` (no column)
    and rich-text `body` (prototype body is plain text; `dangerouslySetInnerHTML` banned).
  - **User → ratified** as `public.profiles` (migration `0003`): `id`→`auth.users`, `roles text[]`
    default `'{}'`, `name`, `status`; empty-roles profile auto-created by the `auth.users` AFTER-INSERT
    trigger (`handle_new_user`).
  - **Role → ratified as a mechanism** (migration `0003`): membership in `profiles.roles`, **simple
    RBAC enforced at the DB via RLS (no SpiceDB)**; `has_role()` SECURITY DEFINER helper; roles
    assigned only by the service role (column-level GRANT makes `profiles.roles` non-user-writable).
    Realized roles: `contributor`, `editor`. `data_steward|store_admin|finance_admin|super_admin`
    stay *proposed — deferred*.
  - **§Authz → ratified** for the Article model to match the actual RLS: anon published-only read
    (`0001`); contributor own-`human` `draft`/`in_review` insert/update, **cannot publish** (`0003`);
    editor SELECT-any + UPDATE-any incl. publish/unpublish (`0004`); AI-draft insert
    (`author_id=self` AND `status='draft'` AND `source='ai'` AND provenance present AND
    contributor|editor) (`0005`). **SpiceDB recorded N/A** (RBAC-via-RLS, per the 2026-07-09 decision).
  - **Still *proposed — deferred* (not over-ratified):** **MediaAsset**; the standalone **`ai_draft_jobs`**
    table (AiDraftJob only partially realized via Article provenance + the draft-only workflow); the
    entire **Registry** context (Team/Player/Coach/Event/BoardMember/Stat); the entire **Commerce**
    context (Product/Order/Donation); and the `data_steward|store_admin|finance_admin|super_admin`
    roles.
