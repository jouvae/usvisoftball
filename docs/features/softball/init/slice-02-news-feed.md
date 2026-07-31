# Slice 02 — Public news feed

**Scenario in scope:** `init-web-001` (and ONLY this one).
**Builds on:** slice 01 (the foundation shell). Reuses its tokens, its single-`<main>` rule, and
its `data-testid`/a11y/responsive conventions verbatim.

> **init-web-001 — Given** published articles exist and an unauthenticated visitor opens `/news`
> **When** the feed loads **Then** only `published` articles appear, newest first, each showing
> headline, category, author byline, date, and hero image; and when no articles are published the
> feed shows an empty state (not an error).

This contract is what `nextjs-tester` writes assertions against **before** the components exist.
Read `DESIGN.md` (repo root) and `slice-01-shell.md` first — they are the binding frontend source
of truth. This is a **standalone Next.js 16 App Router app**; the inherited Jouvae Go/GORM/gRPC
rules (`.claude/rules/data.md`, `AGENTS.md` Go guidance, `.opencode/rules/*`) **do not apply**
(lesson L-init-01). There is no Go, no GORM, no `apiClient`/`useApis`, no `src/`, no shadcn/ui.

Every framework claim below is grounded in the bundled docs under `node_modules/next/dist/docs/`
and cited by path.

> **✅ QA-reviewed (2026-07-09) — APPROVED WITH FIXES, folded in.** `nextjs-qa-reviewer` reviewed
> this contract; the verdict was *approved with fixes* and every fix is now incorporated in place
> (mirroring how `slice-01-shell.md` records its QA outcome). Material changes from the original
> draft: headlines render as **plain text** this slice (the `/news/[slug]` link arrives in slice 03,
> B1); hero images are **local `/public/seed/*.png` files**, so `next.config.ts` stays unchanged and
> there is **no `remotePatterns`** (B2); the seed catches **only** the `slug` unique-violation
> (`23505`) and re-throws everything else, asserting a nonzero count before exiting (M2); the
> empty-state test is a serial, **desktop-only**, DB-mutating test that truncates → asserts → re-seeds
> so the two Playwright projects cannot race the shared DB (M1); a §9 **Tester contract** enumerates
> the exact assertions (M3); the migration gains a `published ⇒ published_at is not null` CHECK (n1);
> and `formatArticleDate` moves to an unfenced `lib/format.ts` (n2).

---

## 1. Data model + migration

The migration is written to **`supabase/migrations/0001_articles.sql`** and applied out-of-band by
a human via `psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_articles.sql`. **Do not run it
from application code.** The doc does not run it either.

### 1.1 `articles` table (trimmed to slice 02 + near-term needs)

Columns (see the SQL for exact DDL): `id` (uuid, `gen_random_uuid()`), `title`, `slug` (unique),
`body`, `excerpt`, `cover_image_url`, `cover_image_alt`, `author_name`, `category`, `status`,
`source`, `published_at`, `created_at`, `updated_at`. This is a subset of `docs/entities.md`
§Content/Editorial → Article. Deferred to later slices: `gallery[]`, `tags[]`, `ai_provenance`
(arrives with AI drafts, init-e2e-007), and the real `author` relation (below).

### 1.2 Decisions and justifications

- **`author_name` is a denormalized byline this slice — deliberately.** `docs/entities.md` models
  `author` as `→User`. Auth/`users` do not exist until a later slice (init-e2e-003..005). Rather
  than block the public feed on an identity system it does not need, we store the display byline as
  text now. When auth lands: add `author_id uuid references public.users`, backfill, and keep
  `author_name` as the denormalized display value (editorial bylines legitimately need to render
  without a live account — guest writers, imported content). **This is stated so no reviewer treats
  it as an oversight.**
- **`status` and `source` use CHECK constraints, not Postgres ENUMs.** The lifecycle
  (`draft → in_review → published → unpublished`) is still evolving. A CHECK is amended with a
  plain, replayable `ALTER TABLE`; an ENUM needs `ALTER TYPE ... ADD VALUE` (values cannot be
  removed/reordered, and it fights transactional/idempotent migration goals). Text also maps
  cleanly onto supabase-js string filters.
- **`id` is a native Postgres `uuid`** (`gen_random_uuid()`), not a prefixed ULID. The ULID/prefix
  scheme in `AGENTS.md` is Jouvae-specific and does not apply here.
- **Idempotent / replayable:** `create table if not exists`, `create index if not exists`,
  `create or replace function`, `drop trigger/policy if exists` before create. Safe to re-run.
- **Index:** a **partial** index `articles_published_feed_idx on (published_at desc) where status =
  'published'` — matches the feed's exact predicate and ordering and stays small as drafts pile up.
- **`updated_at` trigger:** included (not omitted). `set_updated_at()` fires `before update`.
  Justification: the admin editor (slices 05–07) will UPDATE rows constantly.

### 1.3 The database boundary is TWO layers: grants + RLS (not the query filter)

The boundary is layered, and both layers are load-bearing: **grants bound what verbs are reachable
at all; RLS bounds which rows a reachable verb sees.** The migration `enable`s **and** `force`s RLS
on `articles`, **revokes all** then re-`grant`s **only `select`** to `anon, authenticated`, and adds
ONE policy:

```sql
create policy articles_public_read_published on public.articles
  for select to anon, authenticated
  using (status = 'published');
```

- The publishable-key client runs as the `anon` role. Under this policy it can read **only**
  published rows — draft/in_review/unpublished rows are invisible **at the database**. This is what
  makes init-web-002's "drafts never leak" true.
- **A `.eq('status','published')` filter in `lib/articles.ts` is a convenience, NOT the boundary.**
  If someone later forgets that filter, RLS still refuses the draft rows. The filter must never be
  the only defense. (Stated explicitly per the slice brief.)
- There is **no** INSERT/UPDATE/DELETE policy for `anon`/`authenticated` → default-deny. Writes are
  only possible through a `BYPASSRLS` role, i.e. the secret-key admin client. Inserting a draft is
  not a public capability.
- **`revoke all` before `grant select` is not cosmetic.** Supabase's default privileges grant ALL
  on new public-schema tables to `anon`/`authenticated`. RLS default-deny covers
  INSERT/UPDATE/DELETE, but **not `TRUNCATE`: Postgres row security does not apply to `TRUNCATE`**,
  which is gated solely by the table privilege. `anon` is the publishable key that ships in the
  browser bundle, so the destructive `TRUNCATE` grant must be revoked at the table level — RLS will
  not catch it. Not exploitable today (PostgREST exposes no `TRUNCATE` verb), but the table's real
  privileges must match this migration's stated model. This is the one case where **only** the grant
  protects you.
- **`force row level security`** additionally subjects the table owner to policies (defense in
  depth). It does **not** affect `service_role`/secret-key writes, which have `BYPASSRLS`.

> **Risk flagged (see §8):** if RLS is enabled but the seed never ran, or the policy is misapplied,
> the feed returns `[]` and the empty-state test passes for the WRONG reason. The tester MUST
> assert against **seeded published articles**, never merely "no error / empty is fine".

---

## 2. Data access module — `lib/articles.ts` (contract only, not implemented here)

**Module inventory for this slice** (contract only — none implemented here):

| Module | Fenced? | Purpose |
|---|---|---|
| `lib/articles.ts` | **`server-only`** | `Article`/`ArticleListItem`/`CreateArticleInput` types + `listPublishedArticles()` / `createArticle()` (imports the admin client) |
| `lib/format.ts` | **unfenced** (no `server-only`) | pure `formatArticleDate(iso)` — client-reusable, no server deps (n2; moved out of `lib/articles.ts`) |
| `lib/supabase/public.ts` | unfenced (browser-safe) | `createPublicClient()` — `anon`, RLS-enforced (§2.3) |
| `lib/supabase/admin.ts` | **`server-only`** | `createAdminClient()` — secret key, RLS-bypassing (§2.3) |
| `scripts/seed-articles.ts` | node script | calls `createArticle()` only; seeds the canonical fixtures (§2.4) |

`lib/articles.ts` is a single **`server-only`** module. It imports the admin client, so the whole
module is server-fenced (`import 'server-only'` at the top). Importing it from a Client Component is a
build-time error (05-server-and-client-components.md §"Preventing environment poisoning"). The pure
date formatter is **deliberately NOT here** — it lives in the unfenced `lib/format.ts` (§3.3, n2) so a
future Client Component can import it without dragging in the server fence.

### 2.1 TypeScript types

DB columns are `snake_case`; the module maps rows to `camelCase` so components consume clean props.
Timestamps cross the boundary as ISO strings (`string`), never `Date` (serialization + determinism).

```ts
export type ArticleStatus = "draft" | "in_review" | "published" | "unpublished";
export type ArticleSource = "human" | "ai";

export interface Article {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  authorName: string;
  category: string;
  status: ArticleStatus;
  source: ArticleSource;
  publishedAt: string | null; // ISO 8601 (UTC)
  createdAt: string;          // ISO 8601 (UTC)
  updatedAt: string;          // ISO 8601 (UTC)
}

// Exactly the fields the feed card renders. Keeps the client payload minimal and
// makes it obvious the feed never ships `body`.
export type ArticleListItem = Pick<
  Article,
  "id" | "title" | "slug" | "excerpt" | "coverImageUrl" | "coverImageAlt" | "authorName" | "category" | "publishedAt"
>;

// The ONE write shape. Admin editor (slices 05-07) and the seed both build this.
export interface CreateArticleInput {
  title: string;
  slug: string;
  body: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  authorName: string;
  category: string;
  status?: ArticleStatus;   // defaults to "draft" at the DB
  source?: ArticleSource;   // defaults to "human" at the DB
  publishedAt?: string | null; // ISO; set when status === "published"
}
```

### 2.2 Signatures

```ts
// Public read path. Ordered newest-first by published_at. RLS + the query both
// constrain to published. Returns [] when nothing is published (NOT an error).
export function listPublishedArticles(): Promise<ArticleListItem[]>;

// The ONE canonical write path. Nothing anywhere hand-writes an article row.
// The admin editor reuses this verbatim; the seed calls this only.
export function createArticle(input: CreateArticleInput): Promise<Article>;
```

- `listPublishedArticles` selects only the `ArticleListItem` columns,
  `.eq("status","published").order("published_at", { ascending: false })`, and maps rows to
  `camelCase`. This is called by the `/news` Server Component (fetch-data-in-a-Server-Component with
  a DB client — 06-fetching-data.md §"With an ORM or database": credentials/query stay server-side).
- `createArticle` inserts one row and returns the created `Article`. Pure insert — no upsert (an
  upsert would let the admin editor silently overwrite; idempotency belongs in the seed, §2.4).

### 2.3 Supabase client factories — which client, and why

Two factories, each in its own file so the server/browser boundary is legible:

| File | Factory | Env vars | Supabase role | RLS | Used by |
|---|---|---|---|---|---|
| `lib/supabase/public.ts` | `createPublicClient()` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `anon` | **enforced** | `listPublishedArticles` (the public read) |
| `lib/supabase/admin.ts` | `createAdminClient()` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_KEY` (the `sb_secret_…` full-access key) | `service_role` | **bypassed** | `createArticle`, seed |

- **The public read uses the publishable-key (RLS-enforced) client on purpose.** This is the point
  of the slice: the feed genuinely exercises RLS. If the policy is wrong, the feed shows nothing —
  which the tester catches by asserting seeded rows appear.
- **`createArticle` uses the secret-key client** because inserting a draft/publishing is not a
  public capability; it must bypass the read-only public policy.
- **`lib/supabase/admin.ts` starts with `import "server-only"`.** Its secret key must NEVER reach a
  Client Component. Only `NEXT_PUBLIC_`-prefixed vars may appear in browser-bound code; Next.js
  strips non-prefixed vars from the client bundle, and `server-only` makes accidental client import
  a build error (05-server-and-client-components.md §"Preventing environment poisoning").
- `lib/supabase/public.ts` uses only browser-safe vars, so it is safe anywhere; but in this slice it
  is called exclusively from the server-fenced `lib/articles.ts`.
- **Do NOT use `SUPABASE_SERVICE_ROLE_KEY` (the legacy `eyJ…` JWT).** Standardize the admin client
  on the new-format `SUPABASE_KEY` (`sb_secret_…`). Both are full-access/RLS-bypassing; we pick the
  new format. (`SUPABASE_KEY` is badly named — it is a full-access secret, not an anon key. Never
  treat it as public.)

### 2.4 Seed script — `scripts/seed-articles.ts`

- Calls **`createArticle()` only** — never touches the DB directly, proving the canonical write path
  works end to end.
- Produces **both published AND at least one draft**, so the tester can prove drafts don't leak:
  - `published` × 2 with **distinct `published_at`** so newest-first ordering is observable;
  - `draft` × 1 that must NOT appear on the feed.
- **Idempotent — but the catch is NARROW.** `slug` is `unique`, so a re-run's duplicate insert
  raises a unique-violation. supabase-js surfaces the Postgres `unique_violation` as
  **`error.code === "23505"`**; the seed catches **only** that code (on the `slug` conflict) and
  treats the article as "already exists" — skip, count it as present, continue. **Every other error
  is re-thrown.** A broad `try/catch` here would silently swallow the exact failures this slice
  exists to prevent: an RLS/permission denial, a NOT-NULL violation, or a bad-env/connection failure
  would be "handled", the seed would exit 0 having inserted nothing, and `/news` would be silently
  empty — reproducing precisely the empty-feed trap §8 warns about. Therefore:
  - The seed **fails loudly** (non-zero exit, thrown error) on **any** error whose code is not
    `"23505"`.
  - Before exiting 0, the seed **asserts a nonzero created-or-already-existing count** (i.e. it
    verified at least the expected published fixtures are present). A run that created nothing AND
    matched nothing is a failure, not a success.
- **Invocation:** `npm run seed` → add to `package.json`:
  `"seed": "node --env-file=.env.local --import tsx scripts/seed-articles.ts"`.
  - A standalone script does NOT auto-load `.env.local` the way `next dev` does, so `--env-file`
    is required to supply `NEXT_PUBLIC_SUPABASE_URL` + the secret key (`SUPABASE_KEY`, `sb_secret_…`).
    `--env-file` is supported on Node ≥ 20.6.
  - **Runner needed:** add **`tsx`** as a `devDependency` (specify in `package.json`; do not hand-edit
    it from this contract). The runtime here is **Node v20.20.2** (`node -v`, confirmed 2026-07-09),
    which is 20-era and has **no** native TS stripping — `--experimental-strip-types` is Node 22.6+ —
    so `tsx` is genuinely required to execute the TypeScript seed directly. Flagged in §8.

**Canonical seed fixtures** (the tester and the seed agree on these EXACT values — see §9 for the
assertions built on them). Hero images are **local files already on disk** under `public/seed/`
(§3.3); `cover_image_url` is the root-relative path. All three images are assigned (2 published + 1
draft):

| slug | title | category | author (`author_name`) | published_at (UTC) | formatted date | status | cover_image_url | cover_image_alt |
|---|---|---|---|---|---|---|---|---|
| `st-croix-clinches-territory-title` | `St. Croix Clinches the Territory Title` | `Tournament` | `Denise Gumbs` | `2026-06-20T18:30:00Z` | `June 20, 2026` | `published` | `/seed/stjohn-tournament.png` | `St. Croix players celebrating the territory championship on the field` |
| `federation-launches-2026-season` | `USVI Softball Federation Launches the 2026 Season` | `Season` | `Marcus Prince` | `2026-03-01T14:00:00Z` | `March 1, 2026` | `published` | `/seed/season-opener.png` | `Players lined up on the baseline before the 2026 season opener` |
| `unannounced-roster-shakeup` | `Roster Shakeup Ahead of the Playoffs` | `Teams` | `Marcus Prince` | `null` | — | `draft` | `/seed/team-profiles.png` | `Team profile portraits pinned to the clubhouse board` |

- **Newest-first is unambiguous:** `2026-06-20T18:30:00Z` sorts before `2026-03-01T14:00:00Z`, so the
  published feed's exact DOM order is `["st-croix-clinches-territory-title",
  "federation-launches-2026-season"]`, formatting to two distinct, stable date strings
  (`June 20, 2026`, `March 1, 2026`).
- The `draft` fixture (`unannounced-roster-shakeup`) has `published_at = null` and must NEVER appear
  on `/news`.
- The three on-disk files are `public/seed/stjohn-tournament.png`, `public/seed/season-opener.png`,
  and `public/seed/team-profiles.png` (each 1200×675, a 16:9 ratio matching the card wrapper).

---

## 3. Route + component inventory for `/news`

Replaces the slice-01 `<SectionPlaceholder title="News" />` at `app/news/page.tsx` with the real
feed. Import via the `@/*` alias (repo root). Server Components unless a `"use client"` is justified.

### 3.1 `app/news/page.tsx` — Server Component

- `async` Server Component that `await`s `listPublishedArticles()` and renders `<ArticleFeed>` or
  `<EmptyState>` (06-fetching-data.md §"With an ORM or database" — the DB client runs on the server;
  credentials never reach the client).
- **Roots at `<div>`/`<section>`, NOT `<main>`.** The layout owns the sole
  `<main data-testid="site-main">` (slice-01 §2, QA MAJ-01). Two `<main>`s would break
  `getByRole('main')` strict mode.
- **Caching / revalidation posture: force dynamic.** Add:

  ```ts
  export const dynamic = "force-dynamic";
  ```

  Rationale, grounded in `caching-without-cache-components.md` (this repo does **not** enable the
  v16 `cacheComponents` flag — `next.config.ts` has no such flag, so the "Previous Model" caching
  rules apply): the feed is DB-backed, mutable data read via supabase-js (not `fetch`). With
  `dynamic = 'auto'` (the default) and no request-time API in play, Next may **prerender the page at
  build time** and serve a frozen feed — an editor publishing a story would not appear. supabase-js
  calls are **not** tracked by Next's `fetch` cache, so `fetch`-level options don't help here; the
  route-segment control is the right lever. `dynamic = 'force-dynamic'` forces per-request rendering
  (the doc: "rendered for each user at request time"), which also keeps the tester deterministic —
  the feed always reflects current DB state, so seeding then loading `/news` shows the seeded rows.
  (`export const revalidate = 0` is the documented equivalent — it also forces dynamic rendering;
  `force-dynamic` is kept as the clearer intent for "always live". Revisit at `/actualize` if
  ISR/`revalidateTag` is wanted.) **QA-verified (m2):** confirmed against
  `caching-without-cache-components.md` §`dynamic` — supabase-js is not `fetch`, so without
  `force-dynamic` Next may prerender a frozen feed at build; `export const dynamic = "force-dynamic"`
  is correct.

### 3.2 Component inventory (slice-01 style)

| Component | File | Kind | Root | Notes |
|---|---|---|---|---|
| `ArticleFeed` | `components/ui/article-feed.tsx` | Server | `<ul role="list" data-testid="news-feed">` | maps `ArticleListItem[]` → `<ArticleCard>` in `<li>`s; rendered only when ≥1 published |
| `ArticleCard` | `components/ui/article-card.tsx` | Server | `<li data-testid="article-card" data-slug={slug}>` | one per published article; see §3.3 |
| `EmptyState` | `components/ui/empty-state.tsx` | Server | `<div data-testid="news-empty-state">` | zero-published UI; see §5 |

- **All three are Server Components.** Nothing here is interactive — no state, no events, no browser
  APIs — so no `"use client"` is warranted (05-server-and-client-components.md §"When to use…";
  keep the client bundle minimal). `next/image` and `next/link` render fine from Server Components.
- Each component takes `className?: string` and merges it onto its root (DESIGN.md authoring
  conventions).

### 3.3 `ArticleCard` contents + `next/image`

Every card shows headline, category, author byline, date, and hero image.

- **Hero image via `next/image`** (`12-images.md`) — a **LOCAL** image. The three seed images live in
  `public/seed/*.png` and are referenced by the root-relative path in `cover_image_url` (e.g.
  `/seed/stjohn-tournament.png`). Per the images guide §"Local images"
  (`node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` §"Local images": "Files
  inside `public` can then be referenced by your code starting from the base URL (`/`)"), a
  `/public` path needs **no `remotePatterns`** and is not fetched from an external host — the Next
  image optimizer serves it from the local filesystem.
- **`next.config.ts` MUST remain unchanged this slice.** It keeps ONLY `turbopack: { root: __dirname }`
  (from slice-01). There is **no** `images.remotePatterns` block — do not add one; local `/public`
  sources do not require host allow-listing.
- **Use `fill` + `sizes`** inside an `aspect-[16/9]` wrapper. The wrapper **must** carry Tailwind
  `relative` (`position: relative`), or `fill` will not position: per the `<Image>` component's
  `fill` section (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` §"fill":
  "the parent element **must** have `position: relative` … for the proper rendering of the image
  element in that layout mode"). So the wrapper is `<div class="relative aspect-[16/9]">` with
  `<Image fill sizes="(min-width: 768px) 33vw, 100vw" … />`; the ratio wrapper prevents layout shift
  at every column count. `alt` comes from `cover_image_alt` (§6). Apply `priority` **only** to the
  above-the-fold card(s) (the first card / first row), **not** to below-fold cards.

- **~~Headline is PLAIN TEXT this slice — not a link (B1, decided).~~ SUPERSEDED BY SLICE 03
  (2026-07-10).** It *was* plain text only because `/news/[slug]` did not exist yet. That route now
  exists, so the headline is a **link**:
  `<h2 data-testid="article-card-headline"><Link data-testid="article-card-link" href={`/news/${slug}`}>{title}</Link></h2>`.
  **`article-card-headline` stays on the `<h2>`** (moving it to the `<a>` would break this slice's
  assertions). The `<h2>`'s text content is still the title, so `card.getByRole("heading", { level: 2 })`
  and every existing init-web-001 assertion continue to pass unchanged — verified. The card as a whole
  is still **not** wrapped in a link. Heading hierarchy (page `<h1>`, card `<h2>`) is unchanged.
  See `slice-03-article-page.md` §4.

- **Date formatting is deterministic** (no locale/timezone drift between CI and local). A pure helper
  **`formatArticleDate(iso: string): string`** lives in an **unfenced** util module **`lib/format.ts`**
  (NOT in the `server-only`-fenced `lib/articles.ts`), so a future Client Component can reuse it (n2 —
  see §2 module inventory). It formats from the ISO string using **UTC getters + a hardcoded month-name
  array** → `"June 20, 2026"`. Do NOT use `toLocaleDateString()` (locale/TZ dependent) and do NOT rely
  on the runtime default timezone. The `article-card-date` testid contains exactly this string; render
  it inside a `<time dateTime={publishedAt}>` element.

---

## 4. EXACT `data-testid` contract (hard contract for the tester)

Final strings. The tester writes these before the components exist; the implementer emits them
verbatim.

| `data-testid` | Element | Component | Notes |
|---|---|---|---|
| `news-feed` | `<ul role="list">` | ArticleFeed | feed container; present **only when ≥1 published article** |
| `article-card` | `<li>` | ArticleCard | **one per published article**; also carries `data-slug="<slug>"` |
| `article-card-image` | `next/image` | ArticleCard | hero; `alt` = `cover_image_alt` |
| `article-card-category` | `<span>` | ArticleCard | category label |
| `article-card-headline` | `<h2>` | ArticleCard | headline; accessible name = heading text. **Since slice 03** it wraps a `<Link data-testid="article-card-link">` to `/news/{slug}`; the testid stays on the `<h2>` |
| `article-card-link` | `<Link>` inside the `<h2>` | ArticleCard | **added in slice 03**; one per card, so scope it under a card locator (strict mode) |
| `article-card-byline` | `<span>` | ArticleCard | renders `By {author_name}` |
| `article-card-date` | `<time dateTime={publishedAt}>` | ArticleCard | deterministic `"June 20, 2026"` (§3.3) |
| `news-empty-state` | `<div>` | EmptyState | shown when **zero** published; mutually exclusive with `news-feed` |

### Card identity — decision (justified against Playwright strict mode)

**Chosen:** every card carries the SAME `data-testid="article-card"` **plus** a `data-slug="<slug>"`
attribute. **Rejected:** per-slug testids like `article-card-<slug>`.

- With a shared testid the tester can assert the **count and order** of cards directly —
  `expect(page.getByTestId("article-card")).toHaveCount(2)` and read them top-to-bottom to prove
  newest-first. That IS the init-web-001 assertion. Per-slug testids cannot be counted generically
  and force the test to hardcode/know every slug.
- Per-card identity for single-match comes from `data-slug`:
  `page.locator('[data-testid="article-card"][data-slug="st-croix-clinches-territory-title"]')`
  resolves to exactly one node (strict-mode safe).
- **Inner testids** (`article-card-headline` etc.) appear **once per card** and are therefore NOT
  globally unique. The tester MUST scope them under a card locator
  (`card.getByTestId("article-card-headline")`), never query them globally — Playwright strict mode
  is evaluated per-locator, so a card-scoped query is single-match. (This mirrors slice-01's
  single-DOM-instance discipline.)

---

## 5. Empty state (first-class UI, not an error)

When `listPublishedArticles()` returns `[]`, `/news` renders `<EmptyState>` **instead of**
`<ArticleFeed>` (never both; the tester asserts exactly one is present). It is a normal state, not
an error — no thrown error, no error boundary, HTTP 200.

- Root: `<div data-testid="news-empty-state">`.
- Copy (final): heading **"No stories yet"**, body **"Check back soon for the latest USVI softball
  news."** Styled with the muted token (`text-muted`) consistent with slice-01's placeholder tone.
- The heading here is the page's `<h1>` (see §6 — the page needs exactly one `<h1>` in both states).

---

## 6. Accessibility + responsive contract (slice-01 style)

**Landmarks / headings**
- The layout owns the sole `<main>` (slice-01 §2). **`app/news/page.tsx` must NOT emit its own
  `<main>`** — root at `<div>`/`<section>`.
- Exactly **one `<h1>`** on `/news` in BOTH states: a visible section title (e.g. "News") in the
  populated state, and the empty-state heading when empty. Card headlines are `<h2>` (or `<h3>`),
  never `<h1>` — heading hierarchy stays well-formed.
- The feed is a **list**: `<ul role="list">` with one `<li>` per card. (`role="list"` is asserted
  explicitly because some resets strip `<ul>` semantics.)

**Images / links**
- Every hero image's `alt` comes from `cover_image_alt`. If a fixture/author leaves it empty, the
  card renders `alt=""` (decorative) rather than fabricating alt text — the byline/headline already
  name the content. (Seed fixtures should supply meaningful `cover_image_alt`.)
- ~~The headline is **plain text inside the card's `<h2>`** this slice~~ — **superseded by slice 03.**
  The headline `<h2>` now wraps a `<Link>` to `/news/{slug}`. The link's accessible name is the title
  text, and the `<h2>`'s heading name is unchanged, so `card.getByRole("heading", { level: 2 })` still
  resolves. No `aria-label` is needed.

**Responsive (mobile-first, `md` breakpoint)**
- Default (`< md`): single-column stack — `<ul>` is `grid grid-cols-1 gap-6`.
- `≥ md`: multi-column — `md:grid-cols-2 lg:grid-cols-3` (a standard editorial grid). Cards keep the
  `aspect-[16/9]` hero ratio at every width, so no layout shift.
- Testing note (deterministic Playwright): all cards are always **attached**; only the column count
  changes by breakpoint. Assert content/order at a desktop viewport; the grid reflow is CSS-only and
  needs no separate interaction test (there is no interactive island in this slice).

---

## 7. Out of scope (explicit)

~~No article detail page (`/news/[slug]` — slice 03; headlines are plain text this slice, B1, so there
is no card link at all until slice 03).~~ **Both shipped in slice 03** — see `slice-03-article-page.md`. No
auth, no `users` table, no `author_id` FK (byline is denormalized text this slice). No admin, no
editorial workflow UI, no draft/review/publish transitions (slices 05–07). No AI drafts /
`ai_provenance` (init-e2e-007). No Stripe, no store, no donations. No MediaAsset upload pipeline
(seed points at existing/placeholder image URLs). No `gallery[]`, no `tags[]`. No pagination /
infinite scroll / filtering by category (feed is a flat newest-first list this slice). No ISR /
`revalidateTag` wiring (force-dynamic now; revisit at `/actualize`). No shadcn/ui, no new fonts, no
OG images.

---

## 8. Risks / notes for the implementer

1. **RLS misconfig silently returns `[]` — the empty test can pass for the wrong reason.** If the
   policy is wrong, or the seed never ran, or the wrong Supabase role is used, `listPublishedArticles`
   yields `[]` and the empty-state renders happily. **The tester MUST seed published fixtures and
   assert they appear** (count ≥ 2, newest-first, the draft slug absent) — never settle for "no
   error / empty is acceptable". The empty-state path should be exercised separately against a truly
   empty table, not conflated with the populated scenario.
2. **The publishable key is safe only because BOTH layers hold — RLS on rows, grants on verbs.**
   The `sb_publishable_…` key is browser-safe *by design of RLS* for reads — if RLS were off, that
   key would read every draft. But RLS does not bound `TRUNCATE`; only the table grant does, which
   is why the migration `revoke all`s before `grant select`. Confirm **both** after applying:
   `alter table ... enable row level security` took effect (query `pg_class.relrowsecurity = t`),
   **and** `anon`/`authenticated` hold `SELECT` only, not the Supabase-default ALL (query
   `information_schema.role_table_grants` — it must not list `TRUNCATE`/`INSERT`/`UPDATE`/`DELETE`
   for those roles). Do not ship the feed until both are verified.
3. **Never let a full-access secret reach the client.** `SUPABASE_KEY` (`sb_secret_…`) and
   `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) are RLS-bypassing. They may appear **only** in
   `lib/supabase/admin.ts` (fenced with `import "server-only"`) and the seed script. Any browser-
   bound code uses only `NEXT_PUBLIC_`-prefixed vars.
4. ~~**`next/image` remote host must be configured.**~~ **MOOT (B2).** Hero images are **local**
   `public/seed/*.png` files, not remote objects. Local `/public` sources need no `remotePatterns` and
   are not fetched from an external host, so there is no unconfigured-host throw and no external
   request-time optimizer fetch to flake in CI. `next.config.ts` stays unchanged.
5. ~~**Card link destination — DECIDED (B1).**~~ **RESOLVED IN SLICE 03 (2026-07-10).** `/news/[slug]`
   now exists, and the headline is a `<Link>` to it (`article-card-link`). Nothing 404s.
6. **Next 16 caching defaults differ from older mental models.** Do not assume a DB-backed page is
   dynamic by default — with `cacheComponents` off and no request-time API, Next can prerender it at
   build. `export const dynamic = "force-dynamic"` on `app/news/page.tsx` is required for a live feed
   (caching-without-cache-components.md §"dynamic"). supabase-js calls are not `fetch`, so
   `fetch`-level cache options are irrelevant here.
7. ~~**Turbopack `.next` staleness after a `remotePatterns` edit.**~~ **MOOT for local sources (B2).**
   No `next.config.ts` image change is made this slice, so there is no config edit to restart for on
   the image path. (A `.env.local` change is still read at server start — restart `next dev` after
   editing env, per risk #8.)
8. **Seed runner + env loading.** `npm run seed` needs `tsx` installed (devDependency) and
   `--env-file=.env.local` (a standalone script does not auto-load Next's env files). Without the
   env file the admin client has no URL/secret and every insert fails.
9. **`author_name` denormalization is intentional debt.** When auth arrives, add `author_id` and
   backfill; keep `author_name` as the display byline. Documented in §1.2 so it is not "fixed" by
   accident before auth exists.

---

## 9. Tester contract (`tests/e2e/init/init-web-001.spec.ts`)

This is the exact assertion set the `nextjs-tester` compiles for `init-web-001`. It is written so a
**passing suite cannot coexist with a broken RLS policy or a silently-empty feed**.

### 9.1 Spec conventions (m3 — mirror `init-web-009.spec.ts`)

The new spec **mirrors `tests/e2e/init/init-web-009.spec.ts`**:

- Same **YAML-in-comment frontmatter** block at the top: `id: init-web-001`, `name`, `feature:
  softball/init`, `stack: web`, `status: red`, and `references:` listing
  `docs/features/softball/init/slice-02-news-feed.md` + `docs/features/softball/init/scenarios.md` +
  `DESIGN.md`.
- Assert `/news` returns **HTTP 200** via the `page.goto` response (as init-web-009 does for each
  section route): `const res = await page.goto("/news"); expect(res!.status()).toBe(200);` — proves
  the route is not a 404/error and never a thrown error boundary.
- Read `data-slug` in DOM order using the same `evaluateAll` pattern init-web-009 uses for nav order
  (do not select by the `data-testid` attribute string; scope to the feed container and read the
  attribute).

### 9.2 The DB lifecycle under the two-project config (M1 — read carefully)

`playwright.config.ts` runs **two projects** — `desktop` (1280×720) and `mobile` (390×844) — with
`fullyParallel: true` against a **single shared Supabase database**. Under RLS the feed is empty only
when **zero `published` rows exist**, so the empty-state assertion is inherently DB-mutating and would
**race the other project** if run naively. The lifecycle below is deterministic under that config:

- **Populated is the default/canonical state.** A seeded DB (the 2 published + 1 draft fixtures of
  §2.4) is the baseline. All non-mutating tests (§9.3) run under **both** projects and assume this
  state. The suite **seeds the canonical fixtures before the populated test** (via the seed's
  idempotent `createArticle` path — re-running is safe, §2.4).
- **The empty-state test is the ONLY DB-mutating test, and it is confined + serialized:**
  - **Desktop only** — guard with
    `test.skip(({}, testInfo) => testInfo.project.name !== "desktop")` so the `mobile` project can
    never run it concurrently against the shared DB.
  - Inside a `test.describe.configure({ mode: "serial" })` block that: **truncate/delete all
    articles → assert the empty state → re-seed the canonical fixtures** so every subsequent test
    (and the other project) sees the baseline again.
- **Reset mechanism — named exactly.** Deletion goes through a `deleteAllArticles()` (truncate)
  helper invoked via the **secret-key admin client** (`createAdminClient()`, which has `BYPASSRLS`).
  It is **NOT** raw SQL issued from the test, and **NOT** the publishable client (which has no delete
  policy — default-deny — and could not delete anything anyway). Re-seeding uses the same canonical
  `createArticle` seed path.
- **Fail-closed on re-seed.** If the re-seed step fails, the **suite must fail** (surface the error)
  rather than leave the DB empty — an empty DB would poison the next run's populated assertions and
  make the RLS/empty distinction meaningless.

### 9.3 Required assertions (M3 — populated state)

Run the seed first (§9.2), then, against `/news` at a **desktop** viewport (content/order are
CSS-reflow-independent, §6):

1. **Seed the canonical fixtures** before the populated assertions run.
2. **Exactly 2 cards:** `expect(page.getByTestId("article-card")).toHaveCount(2)`. This proves the
   feed is non-empty AND that the draft is excluded (2, not 3) — RLS + query working.
3. **Draft absent by slug:**
   `expect(page.locator('[data-testid="article-card"][data-slug="unannounced-roster-shakeup"]')).toHaveCount(0)`.
4. **Newest-first order:** read `data-slug` in DOM order (the `evaluateAll` pattern from
   init-web-009) and assert the exact array
   `["st-croix-clinches-territory-title", "federation-launches-2026-season"]`.
5. **Per-card content, scoped under a card locator** (`const card = page.locator('[data-testid="article-card"][data-slug="…"]')`),
   for each published fixture:
   - headline text (`card.getByTestId("article-card-headline")` / `card.getByRole("heading",
     { level: 2 })`) equals the fixture `title`;
   - `article-card-category` equals the fixture `category`;
   - `article-card-byline` renders `By {author_name}` (e.g. `By Denise Gumbs`);
   - `article-card-date` equals the exact deterministic string (`June 20, 2026` / `March 1, 2026`);
   - `article-card-image` has `alt` equal to the fixture's `cover_image_alt`.
6. **Positive newest-headline assertion:** assert the first (newest) card's headline text is
   `St. Croix Clinches the Territory Title` — a concrete known string so a silently-empty or
   mis-ordered feed cannot pass.
7. **Empty state (the serial, desktop-only test of §9.2):** after `deleteAllArticles()`,
   `expect(page.getByTestId("news-empty-state")).toBeVisible()`,
   `expect(page.getByTestId("news-feed")).toHaveCount(0)`,
   `expect(page.getByTestId("article-card")).toHaveCount(0)`, the `/news` response is **HTTP 200**,
   and no error boundary is shown — then **re-seed**.
