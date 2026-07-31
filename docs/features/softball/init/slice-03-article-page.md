# Slice 03 — Public article page (`/news/[slug]`) + draft 404

**Scenario in scope:** `init-web-002` (and ONLY this one).
**Builds on:** slice 02 (the public news feed) and slice 01/01b (the shell + brand). Reuses their
tokens, the single-`<main>` rule, the `createArticle()`-is-the-one-write-path rule, and the
`data-testid` / a11y / responsive conventions **verbatim**.

> **init-web-002 — Given** one article is `published` and another is `draft`/`in_review` **When** an
> unauthenticated visitor opens the published article's `/news/[slug]` and then attempts the draft's
> slug **Then** the published article renders (headline, byline, body, gallery), and the
> draft/`in_review` slug returns **404** (never exposed to the public).

This contract is what `nextjs-tester` writes assertions against **before** the components exist, and
what `nextjs-implementer` emits verbatim. Read `DESIGN.md` (repo root, incl. §"Brand & design
tokens") and `slice-02-news-feed.md` first — they are the binding frontend source of truth. This is a
**standalone Next.js 16.2.10 App Router app**; the inherited Jouvae Go/GORM/gRPC/SpiceDB rules
(`.claude/rules/data.md`, `AGENTS.md` Go guidance, `.opencode/rules/*`, the `design-system` skill)
**do not apply** (lesson L-init-01). There is **no** Go, GORM, `apiClient`/`useApis`/`serverApiClient`,
`src/`, `clients/web/`, ULID prefixes, Dorothy proxy, or shadcn/ui — do not invent any of them. IDs are
native Postgres `uuid` via `gen_random_uuid()`.

Every framework claim below is grounded in the bundled docs under `node_modules/next/dist/docs/` and
cited by path (the convention established by `slice-02-news-feed.md`).

> **✅ QA-reviewed (2026-07-10) — APPROVED WITH FIXES, folded in.** `nextjs-qa-reviewer` reviewed this
> contract; the verdict was *approved with fixes* and every fix is now incorporated in place (mirroring
> how `slice-02-news-feed.md` records its QA outcome). The review independently confirmed the core
> security decisions — RLS-as-sole-visibility-control on the by-slug path (no status filter), the
> null-vs-throw split, whole-table-grant column coverage, the shallow `jsonb_typeof(gallery) = 'array'`
> CHECK, and the no-`dangerouslySetInnerHTML` rule — and verified `.maybeSingle()` against the installed
> `@supabase/supabase-js@2.109.0` source and every Next 16 doc citation. Folded fixes: **MINOR-1** —
> `article-hero` testid is pinned to the `<Image>` element itself (not its wrapper), so the `alt`
> assertion targets the node that carries `alt` (§4.1, §9.2). **NIT-1** — a segment-level `loading.tsx`
> (or any Suspense boundary above the awaited fetch) in `app/news/[slug]/` is explicitly forbidden this
> slice, because it would flush the shell and degrade the `notFound()` status from 404 to a streamed 200
> (§3, §7, §8-#2). **NIT-2** — gallery-image `alt`s are asserted **per index** (`.nth(0)`/`.nth(1)`) in
> fixture order (§9.2). **NIT-3** — the stale `NAV_HREFS` note was removed (the symbol is `NAV_TEST_IDS`
> at line 40, used at line 110; eslint is clean — no pending cleanup).

---

## 1. Data model + migration

`articles` already has every column slice 02 needs. Slice 03 adds **one** column: `gallery`.

### 1.1 The migration — `supabase/migrations/0002_articles_gallery.sql`

Written as a contract artifact in this slice; applied out-of-band by a human via
`psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_articles_gallery.sql`. **Never run from
application code**, and not run by this doc. It is **replayable/idempotent** in 0001's style. Its two
statements:

```sql
alter table public.articles
    add column if not exists gallery jsonb not null default '[]'::jsonb;

alter table public.articles
    drop constraint if exists articles_gallery_is_array;
alter table public.articles
    add constraint articles_gallery_is_array
    check (jsonb_typeof(gallery) = 'array');
```

- **Element shape:** `[{ "url": string, "alt": string }]`.
- **`jsonb`, not a child table** — the gallery is a small, ordered, read-mostly list always rendered
  wholesale with its article and never queried across articles. A normalized media table would add
  joins for a query we never run this slice. (The real `MediaAsset` upload pipeline — `docs/entities.md`
  §MediaAsset — is out of scope, §7.)
- **`not null default '[]'`** so every existing row and every gallery-omitting INSERT carries a
  well-formed empty array. The renderer always `.map()`s without a null guard, and "empty gallery" is a
  first-class state, not `null`.

### 1.2 CHECK depth — decision (shallow, justified)

The CHECK asserts `jsonb_typeof(gallery) = 'array'` and **stops there** — it does **not** validate that
each element is an object with `url`/`alt` string keys. Rationale:

- The **only** write path is `createArticle()` through the BYPASSRLS admin client. `anon`/`authenticated`
  have no INSERT/UPDATE (default-deny, 0001), so there is no untrusted writer to defend against at the
  DB. `CreateArticleInput` (§2.3) already constrains elements to `{ url, alt }` at the application boundary.
- A per-element CHECK needs a plpgsql/jsonpath expression that is harder to keep replayable + readable and
  is redundant with the typed write path.
- **array-vs-non-array is the only distinction that actually crashes the page** (the renderer iterates
  the value). A missing/extra element key degrades to a broken `<img>`, not a 500.

**Rejected:** a deep element CHECK — redundant with the single trusted, typed write path and fragile to
keep idempotent.

### 1.3 Why NO grant / RLS / policy change is required

The gallery rides the existing SELECT-only grant + published-only row policy from 0001. This is stated
explicitly because it is the security crux of the slice:

- **Grants:** 0001 granted **whole-table** `select` (`grant select on public.articles to anon,
  authenticated`), not a column-list grant. A whole-table SELECT privilege automatically extends to
  columns added later, so `gallery` is readable under the same grant with no new statement. (Had 0001
  used a column-level grant, a new column would **not** be auto-covered — it did not, so we are fine.)
- **RLS:** `articles_public_read_published` gates **rows, not columns** (`using (status = 'published')`).
  A draft/`in_review`/`unpublished` row's gallery is invisible to the public role for exactly the same
  reason its title is — the whole row is filtered out before any column is returned. A new column adds no
  new row-visibility surface, so no policy change is warranted.

Net: the "drafts never leak" guarantee that 0001 established already covers the gallery the moment it is
a column on this table.

---

## 2. Data-access delta to `lib/articles.ts` (contract only, not implemented here)

`lib/articles.ts` stays a single **`server-only`** module (it imports the admin client). The delta is:
one new read function, a `gallery` field on `Article`, a new `GalleryImage` type, and an extended
`CreateArticleInput`. **`ArticleListItem` does NOT change** — the feed must never start shipping galleries.

### 2.1 New read function — signature

```ts
// Public read path for one article by slug. Reads through the RLS-ENFORCED
// publishable client. Returns the full Article (incl. gallery) when a PUBLISHED
// row with that slug exists; returns null when no such row is visible. A genuine
// DB/transport error THROWS — it must never be mapped to null (see §8, the
// "404 hides an outage" trap).
export function getPublishedArticleBySlug(slug: string): Promise<Article | null>;
```

- **Reads through `createPublicClient()` (`lib/supabase/public.ts`, `anon`, RLS-enforced)** — the same
  client `listPublishedArticles()` uses, and for the same non-negotiable reason (status.md; slice-02 §2.3):
  the public read path must be RLS-enforced so a **broken policy fails the tests** rather than being
  masked. If the article page instead read through the admin client (BYPASSRLS), a broken RLS policy would
  still render drafts — silently defeating the exact property init-web-002 exists to prove. **Rejected:**
  reading via `createAdminClient()`.
- **The query relies on RLS alone to exclude non-published rows — it does NOT add `.eq("status",
  "published")`.** This is a deliberate divergence from `listPublishedArticles()` (which keeps its status
  filter as a query-shaping convenience that also drives the partial index + ordering). On the by-slug
  path the slug is unique and needs no status-shaping, so we let **RLS be the sole visibility control**:
  a broken policy would leak the draft, the article would render, and the 404 test (§9) would fail —
  making the e2e a genuine RLS assertion instead of one a query filter could mask. **Rejected:** adding
  `.eq("status","published")` for symmetry with the list — it would let the filter mask a broken policy on
  this path, hollowing out the scenario. Both paths still read through the RLS-enforced client, so the
  boundary is identical; only the redundant convenience filter differs.
- **`.maybeSingle()`, not `.single()`.** With `.maybeSingle()`, zero visible rows → `{ data: null, error:
  null }` (no error), which maps cleanly to `null`. `.single()` instead returns the supabase-js
  `PGRST116` "no rows" error for zero rows, forcing the caller to special-case that code and re-throw
  everything else — more error-prone. `slug` is `unique`, so the "multiple rows" case `.maybeSingle()`
  would error on is impossible.
- **Mapping "no row" → `null` → `notFound()`:** the function returns `null` **only** when `data` is null
  and `error` is null (no visible row). If `error` is set (transport/DB failure), it **throws** (`if
  (error) throw error;`) — never returns `null`. The page (§3) turns `null` into `notFound()` (404) and
  lets a thrown error surface as a 500. A 404 that hides an outage is a real trap (§8-#1); the null-vs-throw
  split is what prevents it.
- Selects the **full** column set including `gallery` (an explicit `ARTICLE_COLUMNS` list mirroring the
  existing `LIST_COLUMNS` discipline, or `select("*")` — either is acceptable; explicit is preferred so it
  is obvious `gallery` is included). Maps the row to `Article` via the existing `toArticle` mapper,
  extended per §2.4.

### 2.2 `Article` type + `GalleryImage`

```ts
export interface GalleryImage {
  url: string;
  alt: string;
}
```

Add to `Article` (append, keeping every existing field):

```ts
export interface Article {
  // ...all slice-02 fields unchanged...
  gallery: GalleryImage[]; // never null; DB default '[]'
}
```

### 2.3 `CreateArticleInput` extension

```ts
export interface CreateArticleInput {
  // ...all slice-02 fields unchanged...
  gallery?: GalleryImage[]; // defaults to [] at the DB when omitted
}
```

`createArticle()` persists `gallery` (e.g. inserts `gallery: input.gallery ?? []`) so the seed and the
future admin editor set it through the one write path. Passing `[]` is equivalent to omitting it (DB
default).

### 2.4 snake_case → camelCase mapping

- The column name is `gallery` (single word, no case change); element keys are `url`/`alt` (already
  lowercase). So the mapping is effectively a **pass-through** — supabase-js returns the `jsonb` already
  parsed into a JS array of `{ url, alt }` objects. `toArticle` gains `gallery: (row.gallery ?? []) as
  GalleryImage[]` (the `?? []` is belt-and-suspenders; the NOT-NULL column guarantees an array).
- Add `gallery: GalleryImage[]` to the internal **`ArticleRow`** shape (the full row). **`ArticleListRow`
  and `LIST_COLUMNS` stay unchanged** — the list path never selects `gallery`.

### 2.5 `ArticleListItem` — explicitly unchanged

`ArticleListItem` (the feed payload) does **NOT** gain `gallery`. The feed must stay minimal and must not
start shipping gallery arrays for every card. Only the by-slug detail read carries the gallery. State
this so no one "helpfully" adds it.

---

## 3. Route + component inventory for `/news/[slug]`

New dynamic route `app/news/[slug]/page.tsx`. Import via the `@/*` alias (repo root). Server Components
unless a `"use client"` is genuinely justified (none is, this slice).

### 3.1 `app/news/[slug]/page.tsx` — Server Component

- **`async` Server Component.** `params` is a **`Promise`** in Next 16 — it must be awaited:
  `const { slug } = await params`
  (`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` §"Creating a dynamic
  segment"). Prefer the ambient `PageProps<'/news/[slug]'>` helper over a hand-rolled prop type (same doc,
  §"Route Props Helpers"; DESIGN.md authoring conventions).
- **`export const dynamic = "force-dynamic";`** — same reasoning as `/news` (slice-02 §3.1): the article
  is DB-backed, mutable data read via **supabase-js, which is not `fetch`**, so Next's fetch cache does
  not track it. With `cacheComponents` off (`next.config.ts` has no such flag) and no request-time API,
  Next may prerender a frozen page at build; `force-dynamic` forces per-request rendering — "routes being
  rendered for each user at request time"
  (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` §`dynamic`). This
  also keeps the tester deterministic (a freshly published/edited article reflects immediately) and is
  what lets the 404 for a draft be evaluated at request time against live DB state.
- **Data + 404:**
  ```ts
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();
  ```
  `notFound()` (imported from `next/navigation`) throws `NEXT_HTTP_ERROR_FALLBACK;404` and terminates
  rendering of the segment
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`). It needs no `return`
  (its return type is `never`). Because it is called **after** awaiting the data and **before** returning
  any JSX, the shell has not begun streaming, so Next emits an HTTP **404** status for the document (see
  the streamed-vs-non-streamed note in §8-#2).
- **NO segment-level `loading.tsx` (or any Suspense boundary above the awaited fetch) in
  `app/news/[slug]/` this slice.** A `loading.tsx` auto-wraps the segment in a `<Suspense>` boundary that
  **flushes the shell before** the page's awaited data resolves; once the shell has streamed, `notFound()`
  degrades the response to a streamed **200** (with `<meta name="robots" content="noindex">`) instead of a
  real HTTP **404** — silently breaking §9's `res.status()).toBe(404)` assertions. The 404-status guarantee
  therefore **depends on** the fetch being awaited at the top of the page component with no Suspense above
  it. Do not add `loading.tsx` here (§7, §8-#2).
- **Must NOT emit its own `<main>`.** The root layout owns the sole `<main data-testid="site-main">`
  (`app/layout.tsx`; slice-01 §2). The page roots at a `<article>`/`<div>`/`<section>` — never a second
  `<main>` (two `<main>`s break `getByRole('main')` strict mode).
- **Exactly one `<h1>`** — the headline. The body has no heading; the gallery is a labelled `<section>`
  with no heading (or, if a visible label is wanted, an `<h2>` — never a second `<h1>`). Heading hierarchy
  stays well-formed.

### 3.2 `not-found.tsx` — scoped, recommended

Add **`app/news/[slug]/not-found.tsx`** (Server Component). Decision + rationale:

- A `not-found.tsx` is **not strictly required** for the scenario — with none present, Next renders its
  built-in default 404 UI and still returns HTTP 404, which is all init-web-002's status assertion needs.
- It is **recommended** so the 404 renders inside the site chrome (header/footer/`<main>` from the root
  layout) with article-appropriate branded copy, and so the 404 body is under our control for the leak
  check (§9). A **segment-scoped** file (`app/news/[slug]/not-found.tsx`) gives news-specific copy; a root
  `app/not-found.tsx` would also work but with generic copy. `not-found.js` renders between `loading.js`
  and `page.js`, wrapped by the segment's boundaries
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`).
- **Security bonus, load-bearing for the leak check:** `not-found.js` components **accept no props** (same
  doc, §Reference/Props). The 404 UI therefore has **no access** to the draft's title/body — it literally
  cannot render it. That is what makes "the draft's title never appears in the 404 response" structurally
  true, not merely coincidental.
- It renders inside the root layout's `<main>`, so it must **not** emit its own `<main>`, and its heading
  is the segment's `<h1>` (e.g. "Article not found"). Root: `<div data-testid="article-not-found">`.

### 3.3 New components

| Component | File | Kind | Root | Notes |
|---|---|---|---|---|
| `ArticleHero` | `components/ui/article-hero.tsx` | Server | `<div class="relative aspect-[16/9]">` wrapping `next/image` | above-the-fold cover; `priority`; renders `null` when `coverImageUrl` is null |
| `ArticleBody` | `components/ui/article-body.tsx` | Server | `<div data-testid="article-body">` | plain-prose body; **no `dangerouslySetInnerHTML`** (§3.4) |
| `ArticleGallery` | `components/ui/article-gallery.tsx` | Server | `<section data-testid="article-gallery">` | renders each `GalleryImage`; returns **`null`** when `images.length === 0` (§3.5) |

- **All Server Components** — nothing here is interactive (no state, events, or browser APIs), so no
  `"use client"` is warranted (`05-server-and-client-components.md` §"When to use Server and Client
  Components?"). `next/image` renders fine from Server Components.
- Each takes `className?: string` and merges it onto its root (DESIGN.md authoring conventions).
- The article **meta** — category chip, `<h1>` headline, byline, date — renders directly inside the page's
  header block (`<header>` inside the page's `<article>`), reusing `formatArticleDate` from **`lib/format.ts`**
  (deterministic UTC; **never `toLocaleDateString`**, slice-02 §3.3) inside `<time dateTime={publishedAt}>`.
  The category is a **navy-text-on-gold chip** (`bg-accent text-accent-foreground`, 8.13:1) — the same
  inversion as the card eyebrow; **never gold text on white** (1.57:1, banned — DESIGN.md rule 6 / rule 1).

### 3.4 Body rendering (this slice) — plain prose, XSS-safe

- `articles.body` is a `text` column seeded as **plain prose** today, though `docs/entities.md` calls it
  "rich text". **This slice renders it as plain text**, not HTML: split `body` on blank lines (`\n\n`) into
  an array of `<p>` elements (or a single `<p className="whitespace-pre-line">{body}</p>` to preserve line
  breaks). React auto-escapes text children, so this is XSS-safe by construction.
- **`dangerouslySetInnerHTML` on DB-sourced `body` is FORBIDDEN this slice** (§8-#3). The body is
  editor/AI-authored untrusted input; injecting it as raw HTML is a stored-XSS hole. There is no
  sanitizer in scope, and adding one is not this slice's job.
- **A real rich-text slice later** would need: a constrained, structured body format (Markdown or a
  portable-text/AST JSON), a server-side sanitizer/allow-list renderer (never raw HTML from the DB), and
  its own scenario + tests. Explicitly deferred.

### 3.5 Gallery rendering — `next/image`, local `/public` paths

- Each item renders via **`next/image`** with the element `url` (a root-relative `/public` path, e.g.
  `/seed/season-opener.png`). Local `/public` sources need **no `remotePatterns`** and are served from the
  local filesystem — "Files inside `public` can then be referenced by your code starting from the base URL
  (`/`)" (`node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` §"Local images"). **`next.config.ts`
  stays unchanged** — it keeps ONLY `turbopack: { root: __dirname }`; do not add an `images.remotePatterns`
  block.
- **`fill` + `sizes` inside a `relative` ratio wrapper.** The wrapper must carry `position: relative`
  (Tailwind `relative`) or `fill` will not position: the parent element "**must** assign `position:
  "relative"`, `"fixed"`, `"absolute"`"
  (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` §`fill`). Each item is
  `<div class="relative aspect-[4/3]"><Image fill sizes="(min-width: 768px) 50vw, 100vw" … class="object-cover" /></div>`.
- **`priority` only above the fold.** The hero gets `priority`; gallery images are below the fold — no
  `priority` (lazy-load).
- **Empty gallery (a published article with `gallery = []`):** `ArticleGallery` returns **`null`** when
  `images.length === 0`, so there is **no** `<section>`, no empty container, and no broken layout — and the
  `article-gallery` testid is simply absent (the tester asserts count 0). The page may render
  `<ArticleGallery images={article.gallery} />` unconditionally; the empty branch is encapsulated in the
  component.

### 3.6 `generateMetadata` — in scope, minimal, non-leaking

- **In scope**, kept minimal. Export an `async generateMetadata({ params })` (Server-Component-only — the
  export is "only supported in Server Components",
  `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` §intro/§"Generated
  metadata"). It awaits `params`, calls the **same** `getPublishedArticleBySlug(slug)`, and:
  - when an article is found → `{ title: article.title, description: article.excerpt ?? undefined }`;
  - when `null` (draft/`in_review`/`unpublished`/nonexistent) → a **generic** fallback (e.g. `{ title:
    "Article not found" }`) that contains **no** draft-derived text.
- Because it reads through the **RLS-enforced** public client, a non-published slug returns `null`, so a
  **draft's title can never leak via `<title>`/metadata** on a slug that 404s (§8, leak check).
- Because both `generateMetadata` and the page call `getPublishedArticleBySlug`, the implementer **may**
  wrap the read in React `cache()` for request-level dedupe (optional optimization, not required).
- **Rejected:** static `metadata` (cannot reflect the per-article title) and omitting metadata entirely
  (acceptable, but a real `<title>` for the article is cheap and useful; OG images stay out of scope, §7).

---

## 4. EXACT `data-testid` contract (hard contract for the tester)

Final strings. The tester writes these before the components exist; the implementer emits them verbatim.

### 4.1 New testids on `/news/[slug]`

| `data-testid` | Element | Component / location | Notes |
|---|---|---|---|
| `article-hero` | `next/image` (the `<Image>` element itself) | ArticleHero | cover image; `alt` = `coverImageAlt` (empty ⇒ `alt=""`). **Pin the testid to `<Image>`, NOT the `relative` wrapper `<div>`** — `next/image` forwards `data-testid` to the underlying `<img>` that carries `alt`, so §9.2 assertion 5's `alt` check targets the right node (mirrors how `ArticleCard` sets `article-card-image`). |
| `article-category` | `<span>` | page header | navy-on-gold chip; category text |
| `article-headline` | `<h1>` | page header | the sole `<h1>`; accessible name = title |
| `article-byline` | `<span>` | page header | renders `By {authorName}` |
| `article-date` | `<time dateTime={publishedAt}>` | page header | deterministic `formatArticleDate` (e.g. `June 20, 2026`) |
| `article-body` | `<div>` | ArticleBody | plain-prose body; no raw HTML |
| `article-gallery` | `<section>` | ArticleGallery | **present only when `gallery.length > 0`**; absent for empty gallery |
| `article-gallery-image` | `next/image` | ArticleGallery | **one per gallery item**; `alt` = element `alt`; repeats → scope under `article-gallery` |
| `article-not-found` | `<div>` | `not-found.tsx` | branded 404 UI; contains an `<h1>` |

### 4.2 Card delta — `article-card-headline` becomes a link

Now that `/news/[slug]` exists, the card headline links to it (status.md; slice-02 §3.3/§8-#5, recorded
as *decided*). **Exact resulting DOM in `ArticleCard`:**

```tsx
<h2 data-testid="article-card-headline" className="…">
  <Link data-testid="article-card-link" href={`/news/${slug}`}>
    {title}
  </Link>
</h2>
```

- The `data-testid="article-card-headline"` **stays on the `<h2>`**. Its text content is still `{title}`
  (the nested `<a>`'s text), so `getByRole("heading", { level: 2 })` and `getByTestId("article-card-headline")`
  both still resolve to the heading with accessible name = title. `<a>` is a `link` role, not a second
  heading — heading hierarchy is unchanged.
- A **new** `data-testid="article-card-link"` goes on the `<Link>` (renders `<a href="/news/<slug>">`),
  enabling href + click-navigation assertions.
- **Playwright strict mode / scoping:** `article-card-link` repeats once per card and is **not** globally
  unique — the tester MUST scope it under a card locator (`cardBySlug(page, slug).getByTestId("article-card-link")`),
  exactly as slice-02 §4 scopes the other inner testids. Global `getByTestId("article-card-link")` would
  match every card and violate strict mode.
- `<Link>` is a Client Component but renders fine from the Server `ArticleCard`
  (`03-layouts-and-pages.md` §"Linking between pages"; DESIGN.md §breaking-changes #4). It auto-prefetches
  on viewport entry — expected, no action needed.

### 4.3 Deltas later agents must apply (enumerated, NOT applied here)

1. **`slice-02-news-feed.md` §4 testid table:** add a row
   `article-card-link | <a> (next/link) | ArticleCard | wraps headline text; href=/news/<slug>; scope per card`,
   and amend the `article-card-headline` note from "plain text (no `<Link>`, B1)" to "wraps a `<Link>`
   (slice 03); heading accessible name still = title".
2. **`slice-02-news-feed.md` §3.3, §6, §7, §8-#5:** update the "Headline is PLAIN TEXT this slice — not a
   link" prose to record that the `<Link>` arrived in slice 03 (the route now exists). §7's "No article
   detail page … headlines are plain text" line no longer holds.
3. **`tests/e2e/init/init-web-001.spec.ts`:** **no existing assertion changes or breaks** — the `<h2>`
   text is unchanged, so both `getByTestId("article-card-headline").toHaveText(title)` and
   `getByRole("heading",{level:2}).toHaveText(title)` still pass with the nested `<a>`. Optionally a later
   agent MAY add a scoped `article-card-link` href assertion, but it is **not required** (link + navigation
   are covered by init-web-002 §9). The one thing the implementer must NOT do is move the
   `article-card-headline` testid off the `<h2>` onto the `<a>` — that would break init-web-001.

---

## 5. Seed / fixture delta — `lib/seed/fixtures.ts`

Everything still goes through **`createArticle()` — the ONE write path** (no hand-written rows, no raw
SQL). The seed stays **idempotent with a NARROW catch**: it catches only the `slug` unique-violation
(`error.code === "23505"`) and re-throws everything else (`scripts/seed-articles.ts`, unchanged behavior).

### 5.1 What changes

- The two existing published fixtures gain a `gallery`:
  - **`st-croix-clinches-territory-title`** (published, newest) → a **NON-EMPTY** gallery of **2** images,
    reusing existing `public/seed/*.png` files. This is the article init-web-002 opens and asserts a
    gallery on.
  - **`federation-launches-2026-season`** (published) → **empty** gallery `[]`. This exercises the
    empty-gallery branch (a published article that renders fine with no gallery section) — a **real
    fixture**, so the empty branch is actually tested, not assumed.
- The existing draft (`unannounced-roster-shakeup`, `status: "draft"`) is unchanged (gallery omitted ⇒
  `[]`). It is the `draft` 404 fixture.
- **Two NEW fixtures** are added so all three hidden statuses are covered by real rows (both non-published,
  so **neither appears on `/news`** and `init-web-001`'s `toHaveCount(2)` still holds):
  - an **`in_review`** fixture, and
  - an **`unpublished`** fixture.

> **init-web-001 safety:** the published set stays exactly `{st-croix…, federation…}` = 2. `in_review` and
> `unpublished` are not `published`, so `SEED_ARTICLES.filter(status==='published')` is still those two,
> `toHaveCount(2)` still passes, and the empty-state test's delete-all + re-seed just re-seeds all five.
> Adding `gallery` to a fixture does not affect init-web-001 (it never reads gallery).

### 5.2 Exact fixture values the tester asserts on

Reuse **only** the three existing on-disk files (`stjohn-tournament.png`, `season-opener.png`,
`team-profiles.png`) — **do not invent new image files.**

| slug | title | status | publishedAt (UTC) | coverImageUrl | gallery (`[{url, alt}]`) |
|---|---|---|---|---|---|
| `st-croix-clinches-territory-title` | `St. Croix Clinches the Territory Title` | `published` | `2026-06-20T18:30:00Z` | `/seed/stjohn-tournament.png` | **2 items** (below) |
| `federation-launches-2026-season` | `USVI Softball Federation Launches the 2026 Season` | `published` | `2026-03-01T14:00:00Z` | `/seed/season-opener.png` | `[]` (empty) |
| `unannounced-roster-shakeup` | `Roster Shakeup Ahead of the Playoffs` | `draft` | `null` | `/seed/team-profiles.png` | `[]` |
| `playoff-brackets-in-review` | `Playoff Brackets Set for Review` | `in_review` | `null` | `/seed/team-profiles.png` | `[]` |
| `2025-season-recap-archived` | `2025 Season Recap` | `unpublished` | `2025-11-15T12:00:00Z` | `/seed/season-opener.png` | `[]` |

`st-croix-clinches-territory-title` gallery (exact):

```ts
gallery: [
  { url: "/seed/season-opener.png", alt: "St. Croix players warming up before the championship game" },
  { url: "/seed/team-profiles.png", alt: "The St. Croix squad posing with the territory trophy" },
]
```

- The two NEW fixtures need a `body`, `category`, `authorName`, `coverImageAlt`, `excerpt` too (author's
  choice; suggested `category`: `Playoffs` / `Season`; `authorName`: `Denise Gumbs` / `Marcus Prince`).
  Their exact content is not asserted except that their **titles must NOT appear** on their 404 pages
  (§9), so pick distinct, recognizable titles (above).
- `publishedAt` for `in_review` is `null` (never published). `unpublished` carries a real past
  `published_at` (`2025-11-15T12:00:00Z`) — it was once live, then pulled; the `articles_published_requires_published_at`
  CHECK only constrains `status = 'published'`, so an unpublished row may keep its old timestamp. It still
  never appears on the feed (RLS + the feed's `status='published'` filter).

### 5.3 Seed loudness (unchanged, restated)

The seed asserts a nonzero created-or-existing count before exiting 0, and fails loudly on any non-`23505`
error (RLS/permission/NOT-NULL/connection). A green empty test proves nothing if the seed silently
failed (§8-#4).

---

## 6. Accessibility + responsive contract

**Landmarks / headings**
- The root layout owns the sole `<main>`. **`app/news/[slug]/page.tsx` and `not-found.tsx` must NOT emit
  their own `<main>`** — the page roots at `<article>`/`<div>`, the 404 at `<div>`.
- Exactly **one `<h1>`** on the article page (the headline) and one `<h1>` on the 404 page. Gallery has no
  heading (or an `<h2>` if labelled) — never a second `<h1>`.

**Images / alt text**
- The hero `alt` comes from `coverImageAlt`; each gallery image's `alt` comes from that element's `alt`.
  An empty `alt` renders `alt=""` (decorative) — **never fabricate** alt text
  (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` §`alt`: a decorative image
  "should be an empty string"). Seed fixtures supply meaningful `alt`s.

**Links**
- The card headline link's accessible name is its text = the article title (§4.2). The 404 page's
  "return to news"/home link (if present) has its own visible text as its accessible name.

**Responsive (mobile-first, `md` breakpoint)**
- Article column: single, constrained-width prose column at all sizes (e.g. `max-w-3xl mx-auto`); hero is
  full column width at `aspect-[16/9]`.
- Gallery grid: `grid-cols-1` (`< md`) → `md:grid-cols-2 lg:grid-cols-3`; each item keeps its
  `aspect-[4/3]` ratio at every width, so no layout shift.
- Content/order assertions are CSS-reflow-independent, so they hold at every viewport (as in slice-02 §6).

---

## 7. Out of scope (explicit)

No related-articles / "more from this category", no `tags[]`, no pagination or prev/next article nav, no
share buttons, no comments. No `MediaAsset` upload pipeline (gallery points at existing local
`public/seed/*.png` files). No **rich-text / HTML body** rendering and **no `dangerouslySetInnerHTML`**
(§3.4) — body is plain prose this slice. No auth, no `users` table, no `author_id` FK (byline stays
denormalized text). No admin, no editorial workflow, no draft/review/publish transitions (slices 05–07).
No AI drafts / `ai_provenance` (init-e2e-007). No Stripe/store/donations. No OG images/favicons. No
ISR/`revalidateTag` (force-dynamic now; revisit at `/actualize`). No shadcn/ui, no new fonts. No
`next.config.ts` change (no `remotePatterns` — local images). **No `loading.tsx` in `app/news/[slug]/`**
(nor any Suspense boundary above the awaited fetch) — it would flush the shell and degrade the `notFound()`
status from 404 to a streamed 200 (§3.1, §8-#2).

---

## 8. Risks / notes for the implementer

1. **A 404 must never hide an outage.** `getPublishedArticleBySlug` returns `null` **only** for "no
   visible row" (`data == null && error == null` via `.maybeSingle()`), and **throws** on any real
   error. A `try/catch` that swallowed the error and returned `null` would turn a DB/RLS/transport outage
   into a silent 404 — the site would "work" while every article was actually unreachable. Keep the
   null-vs-throw split; let thrown errors become 500s, not 404s.
2. **The 404 HTTP status is streamed-response-sensitive — assert it, verify it empirically.** Next returns
   "`200` … for streamed responses, and `404` for non-streamed responses"
   (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`). Because the
   page `await`s the data and calls `notFound()` **before returning any JSX**, the shell has not started
   streaming, so the document response is a real **404** — which is what §9 asserts via
   `page.goto(...).status()`. **The concrete way to break this is to add `app/news/[slug]/loading.tsx`** —
   it auto-creates a `<Suspense>` boundary that flushes the shell before the awaited fetch resolves, after
   which `notFound()` yields a streamed **200-with-noindex**, not a 404. So this slice **forbids a
   segment-level `loading.tsx`** (and any Suspense boundary above the fetch) — see §3.1 and §7. Verify the
   404 status by observation (run the suite, drive a browser) — never assume it.
3. **`dangerouslySetInnerHTML` on `body` is a stored-XSS hole — forbidden (§3.4).** The body is
   editor/AI-authored untrusted input. Render it as plain, React-escaped text this slice.
4. **A green empty/404 test proves nothing if the seed silently failed** (slice-02 §8-#1, restated for
   the article page). A suite that only asserted "drafts 404" could pass with a totally broken read path —
   because a *published* article would 404 too. §9 therefore **also** asserts the published article renders
   **200** with real content (headline, byline, date, hero, body, and the 2 gallery images) — so a
   silently-empty DB or a broken public read fails loudly, not quietly.
5. **`params` is a `Promise` (Next 16).** `const { slug } = await params` — forgetting the `await` yields a
   `Promise`-typed slug and a guaranteed 404 for every article (03-layouts-and-pages.md §"Creating a
   dynamic segment").
6. **The gallery CHECK is shallow by design (§1.2)** — a malformed element (missing `url`) degrades to a
   broken `<img>`, not a crash. That is acceptable given the single trusted, typed write path; do not add
   a deep DB CHECK.
7. **Category chip is navy-text-on-gold (8.13:1); gold text on white is banned (1.57:1)** — reuse the
   card's `bg-accent text-accent-foreground` pattern (DESIGN.md rules 1 & 6). Do not relitigate.
8. **Metadata reads the DB too** — `generateMetadata` and the page both call
   `getPublishedArticleBySlug`. Optional React `cache()` dedupe; either way the metadata read must be the
   same RLS-enforced path so a draft's title cannot leak into `<title>`.

---

## 9. Tester contract (`tests/e2e/init/init-web-002.spec.ts`)

The exact assertion set `nextjs-tester` compiles for `init-web-002`, mirroring slice-02 §9 and the spec
conventions of `tests/e2e/init/init-web-009.spec.ts`.

### 9.1 Spec conventions

- **YAML-in-comment frontmatter** at the top: `id: init-web-002`, `name: "init-web-002: Public visitor
  reads a published article; drafts stay hidden"`, `feature: softball/init`, `stack: web`, `priority: P0`,
  `group: A`, `status: red`, and `references:` listing `docs/features/softball/init/slice-03-article-page.md`,
  `docs/features/softball/init/scenarios.md`, and `DESIGN.md` (mirror the block in `init-web-001.spec.ts` /
  `init-web-009.spec.ts`).
- **Seed via the canonical path only.** Reuse the `seedCanonicalArticles()` pattern from
  `init-web-001.spec.ts`: import `createArticle` from `@/lib/articles` and `SEED_ARTICLES` from
  `@/lib/seed/fixtures`, drive `createArticle` per fixture in `beforeAll`, catching only `23505`. The
  fixtures and the seed can never drift (both import `SEED_ARTICLES`).
- **This spec only SEEDS (idempotent); it never deletes.** So it is safe under both the `desktop` and
  `mobile` projects — no desktop-only gating is required. `playwright.config.ts` is `fullyParallel: false,
  workers: 1` deliberately (shared Supabase DB; the init-web-001 empty-state test mutates it) — **do not
  suggest reverting that.**
- Read the 404 status the same way init-web-009 reads section statuses:
  `const res = await page.goto("/news/<slug>"); expect(res!.status()).toBe(404)`.

### 9.2 Required assertions

Constants derived from the fixtures (keep them concrete so a silently-broken read cannot pass by
tautology): `PUBLISHED_SLUG = "st-croix-clinches-territory-title"`, `EMPTY_GALLERY_SLUG =
"federation-launches-2026-season"`, `DRAFT_SLUG = "unannounced-roster-shakeup"`, `IN_REVIEW_SLUG =
"playoff-brackets-in-review"`, `UNPUBLISHED_SLUG = "2025-season-recap-archived"`, `NONEXISTENT_SLUG =
"this-article-does-not-exist"`, and the expected date `"June 20, 2026"`.

**Published article renders (the positive proof):**
1. `page.goto("/news/st-croix-clinches-territory-title")` returns **HTTP 200** (`res!.status()`).
2. `article-headline` (the `<h1>`) has text = fixture `title` (`St. Croix Clinches the Territory Title`);
   also assert via `page.getByRole("heading", { level: 1 })`.
3. `article-byline` has text `By Denise Gumbs`.
4. `article-date` has the deterministic string `June 20, 2026` (from `lib/format.ts`; **never**
   `toLocaleDateString`).
5. `article-hero` is visible and its `alt` equals the fixture `coverImageAlt`.
6. `article-body` is visible and **contains a known body substring** (e.g. `capped an undefeated run`) —
   proves the real body rendered, not an empty shell.
7. **Gallery:** `article-gallery` is visible; `article-gallery-image` scoped under it has **count 2**;
   assert the two `alt`s **per index in fixture/array order** (the gallery renders in array order), NOT as
   an unordered set — `images.nth(0)` has `alt = "St. Croix players warming up before the championship
   game"` and `images.nth(1)` has `alt = "The St. Croix squad posing with the territory trophy"`. Scope the
   images under the `article-gallery` section (strict mode; §4.1), e.g.
   `const images = page.getByTestId("article-gallery").getByTestId("article-gallery-image")`.

**Empty-gallery published article:**
8. `page.goto("/news/federation-launches-2026-season")` returns **200**, renders its `article-headline`
   and `article-body`, and has **no gallery section**: `expect(page.getByTestId("article-gallery")).toHaveCount(0)`.

**Drafts / in_review / unpublished 404 (never leak):** for each of `DRAFT_SLUG`, `IN_REVIEW_SLUG`,
`UNPUBLISHED_SLUG`:
9. `page.goto("/news/<slug>")` returns **HTTP 404** (`res!.status()).toBe(404)`).
10. **Leak check** (not just a status check): the hidden article's exact **title never appears anywhere in
    the response body** — e.g. `await expect(page.getByText("Roster Shakeup Ahead of the Playoffs")).toHaveCount(0)`
    (and the corresponding `Playoff Brackets Set for Review`, `2025 Season Recap`). Assert the branded 404
    UI is shown instead (`article-not-found` visible, or the `<h1>` "Article not found").

**Nonexistent slug:**
11. `page.goto("/news/this-article-does-not-exist")` returns **HTTP 404**.

**Navigation from the feed:**
12. `page.goto("/news")`, then click the published card's headline link — scoped:
    `page.locator('[data-testid="article-card"][data-slug="st-croix-clinches-territory-title"]').getByTestId("article-card-link").click()`
    — and assert the URL is `/news/st-croix-clinches-territory-title` and the `article-headline` `<h1>` is
    the fixture title. (This proves the slice-02→03 link delta actually navigates.)

### 9.3 Why this suite cannot pass for the wrong reason

- Asserting the published article **renders 200 with real content** (headline + body substring + 2 gallery
  images) means a broken public read or an empty DB fails — a 404-only suite could pass with everything
  broken (§8-#4).
- Reading the article page through the **RLS-enforced** client with **no status filter** (§2.1) means a
  broken RLS policy leaks the draft → the draft page renders 200 → assertion 9 fails. The 404 is a genuine
  RLS check, not a query-filter artifact.
- The **leak check** (assertion 10) catches a 404 that still ships the draft's title in the body/metadata —
  a status-only check would miss it.
