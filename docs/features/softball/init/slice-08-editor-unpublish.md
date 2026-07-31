# Slice 08 — Editor unpublishes a live article (`init-e2e-006`)

> **Phase:** Conceptualize (Phase 2). **Type:** contract/sketch — no implementation or test code.
> **Scenario (sole scope):** a signed-in `editor` unpublishes a `published` article; it transitions to
> `status=unpublished`, disappears from the public `/news` feed and its `/news/[slug]` returns **404**,
> **while remaining visible in the editorial queue for re-publish**.
> **L-init-01 (binding):** standalone Next.js **16.2.10** + Supabase. NO Go, gRPC, proto, Dorothy,
> `gormClient`, `useApis`/`serverApiClient`, shadcn, `src/`. `app/` is at repo root; public routes live
> under `app/(public)/`, admin under `app/admin/(protected)/`. Binding doc: **`DESIGN.md`**.
>
> **QA status:** `nextjs-qa-reviewer` validated every technical premise **GREEN** (no-migration claim,
> real-404 property, testid isolation, safe queue broadening, Server-Action pattern, the
> `published_at`-keep decision, and the data lifecycle all check out against the real code). The three
> QA additions are folded in below: (a) distinct submit testids (§4/§6), (b) the "no new file under
> `app/(public)/news/`" constraint (§4/§7), and (c) the whole-test 3-published window + heal-by-marker
> + re-publish churn debt (§7/§9).

---

## 0. Grounding (every framework / Supabase / Postgres-RLS claim cited to an installed source)

| Claim | Source (verified this session) |
|---|---|
| A Server Action "runs as a POST request against the page … reachable to anyone who can send the same POST. Treat every action as an untrusted entry point." Inside every action: **authenticate and authorize** ("Render-time gating … is not a security boundary"), **validate inputs**, **constrain return values**. | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` §Security (L20-22, L78, L88-95) |
| `revalidatePath` "can be called in Server Functions and Route Handlers … **cannot** be called in Client Components or Proxy"; a **literal path** (`/product/1`) omits `type`; a path with a **dynamic segment** (`/product/[slug]`) **requires** `type`. | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` L10-12, L25-28 |
| `params` is async in dynamic routes (`const { id } = await params`); sole-`<main>` rule; `data-testid` mandatory; deterministic UTC dates. | `DESIGN.md` §"Next.js 16 breaking changes"; §"Component authoring conventions" |
| The cookie-backed **session** client runs as the end user (anon/publishable key, RLS-enforced); the admin client is service-role / RLS-bypassing. | `lib/supabase/server.ts`; `lib/auth.ts` `requireUser()`; `lib/roles.ts` `requireRole()`; `lib/supabase/admin.ts` |
| `0001` `status` CHECK admits `'unpublished'`; the `articles_published_requires_published_at` CHECK constrains **only** `status='published'`; the anon/authenticated read policy is `using (status = 'published')`. | `supabase/migrations/0001_articles.sql` L43-44, L58-62, L112-117 |
| `0004` `articles_editor_update` (USING/WITH CHECK = `has_role(auth.uid(),'editor')`) permits **any** row transition incl. `published → unpublished`; `articles_editor_read_all` makes **every** row visible to an editor session. | `supabase/migrations/0004_editor_policies.sql` L30-53 |
| The `articles_public_read_published` policy is `to anon, authenticated`; the editor policies are `to authenticated` only — anon is untouched. | `0001` L113-117; `0004` L31-35, L48-53 |
| `ArticleStatusBadge` already maps all four statuses (`unpublished` → `bg-surface text-muted border border-border`, muted slate-on-surface). | `components/ui/article-status-badge.tsx` `LABELS`/`TONES` (L12-24) |

> **⚠️ Grounding gap surfaced honestly (verify-by-observing):** as in slices 02/03/05/06, there is
> still **no Supabase-RLS guidance bundled in `node_modules/@supabase/*`** (only READMEs/CHANGELOGs).
> The visibility reasoning below rests on **Postgres semantics** (an `unpublished` row satisfies none of
> the three permissive SELECT predicates for anon: it is not `published`, anon has no `author_id`, and
> anon is not `authenticated`). Structural existence proves nothing — the implementer MUST **prove it
> empirically** (§8 out-of-band probes) exactly as prior slices did. Slice-06 **probe 2** already
> observed an editor UPDATE `published → unpublished` succeeding and the row then vanishing from an anon
> SELECT; slice 08 is the app realization of that proven capability.

---

## 1. Migration — **NONE. No DB change is needed. Do not write one.**

Confirmed against the live policies and constraints (not inferred):

1. **The transition is already permitted.** `0004`'s `articles_editor_update` has `USING (has_role editor)`
   and `WITH CHECK (has_role editor)` with **no status predicate** — an editor may set any legal status on
   any row, including `published → unpublished`. Slice-06 §1.4 **probe 2** proved this empirically (the row
   then disappeared from anon). Slice 07 (`init-e2e-004`) confirmed a contributor still cannot reach
   `published`, so the permissive OR-composition is a genuine, unchanged barrier.
2. **`unpublished` is a legal status.** `0001` `status` CHECK:
   `status in ('draft','in_review','published','unpublished')`.
3. **The `published_at` invariant does not block it.** `articles_published_requires_published_at` is
   `status <> 'published' or published_at is not null` — it constrains **only** the `published` state. An
   `unpublished` row may carry a **non-null** `published_at` (see §2's decision).
4. **The row goes invisible to the public automatically.** The only anon-facing SELECT policy is
   `articles_public_read_published` (`using (status = 'published')`). Once `status='unpublished'`, an anon
   SELECT (the public feed + by-slug read, both via `createPublicClient()`) returns no row → gone from
   `/news`, slug 404s **exactly like a draft** (the mechanism `init-web-002` already asserts for
   `draft`/`in_review`/`unpublished`).
5. **No grant change.** `authenticated` already holds `UPDATE` (`0003`) + `SELECT` (`0001`); the unpublish
   path is UPDATE+SELECT only. `anon` stays SELECT-only — `init-web-001`/`init-web-002` cannot regress.

**Explicit statement: slice 08 introduces zero SQL.** The entire slice is application code on the proven
`0001`+`0003`+`0004` substrate.

---

## 2. Write path — `unpublishArticle(id, supabase)` in `lib/articles.ts` (client-injectable, RLS-enforced)

Add one typed mutator beside `publishArticle` / `saveArticleAsEditor`, following the identical
injected-client pattern (session client on the assertion path — **never** the admin client, which bypasses
RLS and would defeat the point). Contract:

```ts
// The ONE unpublish mutator (slice-08 §2). Injected client => RLS-enforced by
// articles_editor_update (has_role editor). Sets status='unpublished'; it does NOT
// touch published_at (decision below). No .eq('status', …) guard: RLS is the boundary
// and an editor may transition any editor-visible row. `.single()` throws
// PostgrestError 'PGRST116' on 0 rows (RLS denied — caller is not really an editor —
// or a missing id); the unpublishArticle Server Action MUST catch that and return
// { error }. The returned Article carries `slug`, which the action needs to revalidate
// the public article path.
export async function unpublishArticle(
  id: string,
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ status: "unpublished" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}
```

**`published_at` decision — KEEP it (do NOT null it). Justification:**
- The `0001` CHECK only constrains `published ⇒ published_at not null`; an `unpublished` row may legally
  retain a non-null `published_at`. So keeping it is valid.
- Keeping it preserves a **historical record** ("this was live, originally published at X"), the more useful
  editorial semantic.
- **No functional downside on the feed:** `listPublishedArticles` filters `status='published'` and orders
  by `published_at desc` — an `unpublished` row is excluded regardless of its `published_at`, so a retained
  timestamp can never leak into or reorder the feed.
- **Re-publish is unaffected either way:** the existing `publishArticle` sets `published_at = now()`
  **unconditionally** (its NIT-1 debt), so re-publishing an unpublished row refreshes the timestamp and
  floats it to the top of the feed **whether or not** we nulled it here. Nulling would be redundant churn.
- Net: `unpublishArticle` patches **only `status`** — the minimal, single-column transition.

This mutator is **not** used by the seed (the seed only creates rows); it is exercised solely by the Server
Action below.

---

## 3. Unpublish Server Action (`'use server'`) — in `app/admin/(protected)/review/[id]/actions.ts`

Add a second action beside `publishArticle`. A Server Action is an independently-reachable POST endpoint
(server-actions.md §Security), so it **re-verifies** the session + `editor` role itself and does **not**
lean on the `(protected)` layout guard — the DB `articles_editor_update` policy is the real boundary.
Contract:

```ts
export type UnpublishArticleState = { error: string } | undefined;

// unpublishArticle — bound via `unpublishArticle.bind(null, id)` so the id is a
// server-closure reference, not a forgeable field (server-actions.md §Security). The
// unpublish runs through the SESSION client so RLS enforces as the editor. A
// non-editor-visible or missing id matches 0 rows -> `.single()` throws PGRST116,
// caught and returned as { error }. On success, revalidate every affected LITERAL
// path BEFORE returning (no redirect — stay on the review desk; the fresh Unpublished
// status + Re-publish control ship in the same roundtrip).
export async function unpublishArticle(
  id: string,
  _prevState: UnpublishArticleState,
  // no formData is read — unpublish is a pure status transition, no untrusted body
): Promise<UnpublishArticleState> {
  await requireRole("editor");

  const supabase = await createSupabaseServerClient();

  let unpublished;
  try {
    unpublished = await unpublishArticleRow(id, supabase);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "PGRST116") {
      return { error: "Could not unpublish this article." };
    }
    throw err;
  }

  revalidatePath("/news");                          // feed loses the card
  revalidatePath(`/news/${unpublished.slug}`);      // public article page now 404s for anon
  revalidatePath("/admin/queue");                   // queue row's badge flips to Unpublished
  revalidatePath(`/admin/review/${id}`);            // review view flips to Unpublished + Re-publish
  return undefined;                                 // no redirect — stay on the review desk
}
```

- **Literal paths, no `type`** — every path passed is a concrete literal (`/news`, `/news/${slug}`,
  `/admin/queue`, `/admin/review/${id}`), so `type` is omitted (revalidatePath.md L25-28). Do **not** pass
  the pattern `/news/[slug]`.
- **Revalidate `/news`** here (unlike a save) — unpublishing is exactly the mutation that removes a card
  from the public feed.
- **No `formData` validation clause** — unlike `publishArticle`, unpublish reads no untrusted body; there
  is nothing to validate. Keep the `_prevState`/`formData` shape only as required by `useActionState`'s
  action signature; the body is ignored.
- **No redirect** — mirror `publishArticle`: stay on the review view; revalidation ships the fresh
  `Unpublished` status + the Re-publish control in the same roundtrip.

**Re-publish reuses the existing `publishArticle` action** — no new action is needed for re-publish (§4).

---

## 4. Review view is status-aware (`app/admin/(protected)/review/[id]/page.tsx`)

Today the page renders `<PublishArticleForm>` unconditionally and shows `review-live-link` only when
`status==='published'`. Make the **controls** status-aware (the metadata block — `review-status-badge`,
`review-source`, title, category, hero — stays for every status; the page still `requireRole('editor')`,
still reads via `getArticleById` through the session client, which the `articles_editor_read_all` policy
makes visible for **any** status incl. `unpublished`):

| `article.status` | Controls rendered | Rationale |
|---|---|---|
| `in_review` | `<PublishArticleForm>` (editable `editor-body` + `publish-article` "Publish") | **Unchanged** — the slice-06 publish gesture. |
| `published` | **`review-live-link`** (→ `/news/[slug]`) **+ `<UnpublishArticleForm>`** (`unpublish-article` button, `unpublish-article-error` slot). Body shown **read-only** (already live). | The scenario's primary gesture. Unpublish is a pure status transition — **no body editor**, so no stray Publish button and no second submit island competing on the DOM. |
| `unpublished` | **`<PublishArticleForm submitTestId="republish-article" submitLabel="Re-publish">`** (editable body + `republish-article` button, reusing `publish-article-error`) | "Remains … for re-publish" made real. **Reuses the existing `publishArticle` action** (`.bind(null,id)`) verbatim — it sets `status='published'` + `published_at=now()`, so an editor can also fix the body while re-publishing. No live link (not live). |

- **`<UnpublishArticleForm>`** is a **new** `'use client'` island (`components/client/unpublish-article-form.tsx`),
  structurally the minimal twin of `PublishArticleForm`: `useActionState(action)`, a single **Unpublish**
  submit `<button data-testid="unpublish-article">`, pending state, and a
  `data-testid="unpublish-article-error"` slot. **No `<textarea>`** (unpublish carries no body).
  Navy-on-white button per DESIGN.md — gold stays scarce (no CTA in the admin).
- **`PublishArticleForm` gains two optional props** — `submitLabel?: string` (default `"Publish"`, pending
  `"Publishing…"`) and `submitTestId?: string` (default `"publish-article"`). This is the minimal change
  that lets the same island serve both `in_review` (Publish) and `unpublished` (Re-publish) with a
  **distinct testid** for the re-publish button while reusing the identical `publishArticle` action +
  `publish-article-error` slot. In-review behavior is byte-for-byte unchanged when the props are omitted.
  **(QA (a), kept):** the distinct submit testids `unpublish-article` (UnpublishForm) and `republish-article`
  (PublishForm via `submitTestId`) never co-render because the branch renders exactly one control set — so
  reusing `editor-body`/`publish-article-error` on the `unpublished` branch is safe (no duplicate testid).
- **testid isolation / sole-`<main>`:** the review route already roots at `<section data-testid="review-view">`
  inside the layout's sole `admin-main` `<main>`. Rendering exactly **one** of the three control sets
  (branch on status) guarantees only one submit island / one relevant error slot is on the DOM at a time —
  no `publish-article` and `unpublish-article` colliding, no duplicate-testid strict-mode failure.
- **`dangerouslySetInnerHTML` on DB-sourced body stays banned** (stored-XSS) — the read-only `published`
  body display uses the same React-escaped rendering as everywhere else.

> **QA (b) — HARD CONSTRAINT (the slice-03 real-404 trap):** slice 08 must **NOT add any new file under
> the public `app/(public)/news/` route** — in particular **never add a `loading.tsx` / Suspense boundary
> above the awaited by-slug fetch** in `app/(public)/news/[slug]/`. `notFound()` yields a real HTTP **404
> only for a non-streamed response**; a `loading.tsx` (or any Suspense above the fetch) flushes the shell
> and silently downgrades the unpublished-slug **404 → a streamed 200**, defeating the scenario's *Then*.
> **All of slice 08's file changes live under `app/admin/**` + `lib/articles.ts`** (see the file list in
> §10). The public news routes are read-only for this slice and are touched by nothing but cache
> revalidation.

The page imports both `publishArticle` and `unpublishArticle` from `./actions`; it binds the id server-side
for each (`.bind(null, id)`) and passes the bound action into the matching island.

---

## 5. Broaden the editor queue — `listEditorialQueue(supabase)` in `lib/articles.ts`

The editor must (a) **reach** a `published` article to unpublish it and (b) **still see** it as
`unpublished` afterward. Today `listReviewQueue` returns only `in_review`, so neither is possible. Add a
broadened editor read:

```ts
// The editor-wide EDITORIAL queue (slice-08 §5). ALL in_review + published +
// unpublished rows through the SESSION client, visible only because
// articles_editor_read_all makes every row visible to an editor. `draft` is EXCLUDED:
// a draft is still being authored by a contributor and is not an editorial-decision
// item (the contributor sees their own drafts via listQueueArticles). Newest edit
// first. Returns [] when the queue is empty (NOT an error).
export async function listEditorialQueue(
  supabase: SupabaseClient,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .in("status", ["in_review", "published", "unpublished"])
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toArticle(row as unknown as ArticleRow));
}
```

- **Grouping/ordering decision:** a **flat list ordered by `updated_at desc`** (newest editorial activity
  first). Each row already renders a status badge (`queue-item-status`) that distinguishes `in_review`
  (gold, "needs action") from `published` (navy, "live") from `unpublished` (muted, "retired"), so a single
  ordered list is legible without server-side grouping. Explicit status-priority grouping (in_review →
  published → unpublished) is **optional polish**, deferred as debt — it is not needed for the scenario and
  PostgREST cannot express a custom rank order cleanly.
- **`draft` excluded on purpose** — matches the slice-06 rationale (the *editorial* queue is items an editor
  acts on; drafts belong to the authoring contributor). The editor SELECT-any policy *would* surface drafts,
  but the query narrows them out.
- **`listReviewQueue` becomes dead code** once the queue page switches to `listEditorialQueue`. **Confirmed
  it has exactly ONE caller** — `app/admin/(protected)/queue/page.tsx` (line 24; the only import site is
  that page's line 2). Replacing that single call with `listEditorialQueue` is therefore safe; recommend the
  implementer **remove** `listReviewQueue` (no other caller) — alternatively keep it if a future
  "needs-review-only" filter is wanted. Flagged as debt either way, not left ambiguously live.

**Queue page branch** (`app/admin/(protected)/queue/page.tsx`) — a one-line swap of the editor branch; the
contributor branch is **unchanged**:

```tsx
const articles = isEditor
  ? await listEditorialQueue(supabase)   // was listReviewQueue — now in_review + published + unpublished
  : await listQueueArticles(supabase);   // contributor: own draft + in_review (UNCHANGED)
```

- **Queue-item link target is unchanged:** editor rows link to `/admin/review/${id}` (the review desk now
  handles all three statuses per §4); contributor rows link to `/admin/articles/${id}`.
- **No badge change needed** — confirmed `ArticleStatusBadge` already maps all four statuses
  (`unpublished` → `bg-surface text-muted border border-border`, muted slate-on-surface;
  `components/ui/article-status-badge.tsx` L12-24). The `unpublished` queue indicator is the existing
  `queue-item-status` badge with `data-status="unpublished"`.

---

## 6. `data-testid` contract (the e2e targets exactly these)

| `data-testid` | Element | New/Reused | Where |
|---|---|---|---|
| `unpublish-article` | **Unpublish** submit `<button>` (shown when `status==='published'`) | **NEW** | `components/client/unpublish-article-form.tsx` |
| `unpublish-article-error` | unpublish error (present only on failure) | **NEW** | `unpublish-article-form.tsx` |
| `republish-article` | **Re-publish** submit `<button>` (shown when `status==='unpublished'`) | **NEW** | `publish-article-form.tsx` (via `submitTestId` prop; same `publishArticle` action) |
| `review-status-badge` | status chip on the review view — now asserts `published` then `unpublished` | Reused | `review/[id]/page.tsx` (via `ArticleStatusBadge`) — `data-status="unpublished"` |
| `review-live-link` | link → `/news/[slug]`, shown ONLY while `status==='published'` (absent after unpublish) | Reused | `review/[id]/page.tsx` |
| `review-view` / `review-source` | review desk root + source marker | Reused | `review/[id]/page.tsx` |
| `editor-body` | editable body `<textarea>` (prefilled) — present on the `in_review` and `unpublished` branches, never the `published` branch | Reused | `publish-article-form.tsx` |
| `queue-item` / `queue-item-title` / `queue-item-status` | editorial queue rows — now include `published` + `unpublished`; the unpublished throwaway shows `queue-item-status` `data-status="unpublished"` | Reused | `queue/page.tsx` |
| `article-card` (+ `data-slug`) | the throwaway on `/news` — asserted **absent** after unpublish (`toHaveCount(0)` filtered by `data-slug`) | Reused | `components/ui/article-card.tsx` (asserted, not added) |
| `article-not-found` | the branded 404 body when the unpublished slug is opened by anon (plus the real HTTP **404** status) | Reused | `app/(public)/news/[slug]/not-found.tsx` |

**Absence/presence** assertions use auto-retrying `expect(...).toHaveCount(n)` / `.toBeVisible()` —
**never** a bare `locator.count()` (the recorded false-defect gotcha). Any new testid added during
implementation MUST be added to this table (DESIGN.md §Component authoring).

---

## 7. Data lifecycle (shared-DB, `workers:1`, feed = exactly 2)

`init-web-001` asserts **exactly 2** published cards (`toHaveCount(2)`). The scenario's *Given* is a
**published** article, so the spec must seed one and remove it cleanly. Design `init-e2e-006` to leave the
feed at **2**:

- **`beforeAll`:** (a) **delete-by-marker (heal)** — clean any leftover from a prior aborted run **before**
  seeding; then (b) seed **one** throwaway **`published`** row via the **BYPASSRLS admin client**:
  `createArticle({ …, status:'published', publishedAt: new Date().toISOString(), source:'human',
  authorId:null }, adminClient)` with a per-run **unique marker title** `[e2e-006] editor unpublish
  {randomUUID()}` and a **unique slug**. This is the scenario's *Given* (a precondition), so the admin
  client is sanctioned — exactly as `init-web-001` seeds and slices 03/05/06 tear down via the admin client.
  The **assertion path** (the editor unpublishing) still runs through the **real editor UI → session client
  → `articles_editor_update`**, so RLS is genuinely exercised.

> **QA (c) — the window is the WHOLE test, not a brief flash (differs from e2e-005).** e2e-005 seeds an
> `in_review` throwaway (invisible to the feed) and only *briefly* creates a 3rd published card at its
> publish step. **e2e-006 seeds a `published` throwaway, so a 3-published state exists for the ENTIRE test
> from `beforeAll` until the UI unpublish step.** This is safe **only** because `playwright.config.ts` is
> `fullyParallel:false` + `workers:1` and files run **serially**: the throwaway is unpublished (and then
> deleted in `afterAll`) **before** the `init-web-001` file runs, so the "exactly 2" assertion never sees
> the 3rd card. **Do NOT "optimize" the config back to parallel workers.** After the unpublish step the row
> is already off the feed (`status='unpublished'`), so `/news` is back to 2 even before teardown.
>
> **An aborted run after the seed leaves a 3rd published card on the shared DB.** The next run's
> `beforeAll` **heal-by-marker delete (step a) MUST remove it** — the same mitigation e2e-005 relies on.
> This is why the heal precedes the seed and matches on the `[e2e-006]` marker prefix, and why the marker
> prefix must be stable across runs while the per-run suffix (`randomUUID()`) stays unique.

- **`afterAll` (fail-closed):** targeted delete of every row whose title starts with the marker prefix
  (`.like('title', '${MARKER_PREFIX}%')` via the admin client) — **never** `deleteAllArticles()` (which
  would nuke the seeded published rows the feed specs depend on) and **never** touch the seeded fixtures.
  Restores the feed to exactly **2** and makes the suite re-runnable.
- **Don't reuse a seeded fixture** — a uniquely-marked throwaway is isolated and cleanly deletable; mutating
  a shared seed row (e.g. the `playoff-brackets-in-review` fixture) would couple specs.
- **Gate to the `desktop` project only** (`beforeEach` `test.skip` on non-desktop, the working pattern) — a
  real sign-in mutates a shared session and the assertions are not viewport-specific (mirrors
  `init-e2e-003`/`005`/`004`).
- **No new file under `app/(public)/news/`** (QA (b), §4) — the 404 property depends on the by-slug fetch
  staying non-streamed; the spec asserts the real HTTP 404, so nothing in the public route may change.

---

## 8. Verification plan for `init-e2e-006` (observe, never infer; real Supabase, never mock)

Precondition: migrations `0001`–`0004` already applied (**no new migration**); `npm run seed` +
`npm run seed:admin` (the admin, `roles=['editor']`) have run. Drive the **real** Supabase sign-in — no
forged/minted session.

**Happy path (the scenario):**
1. `beforeAll` heals-by-marker then seeds the **published** throwaway (marker title + slug, §7).
2. **Confirm the Given is live:** navigate `/news` → `expect` an `article-card` with the throwaway's
   `data-slug` **present**; `/news/[slug]` → renders (headline = marker title).
3. Sign in as the **editor** (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) → lands `/admin`; `admin-nav`
   visible; click `admin-queue-link` → `/admin/queue`.
4. `expect` a `queue-item` `filter({ hasText: markerTitle })` present with `queue-item-status`
   `/published/i` (proves the **broadened** editorial queue surfaces a `published` row — the editor can
   reach it).
5. Click it → `/admin/review/[id]`; `review-view` visible; `review-status-badge` `/published/i`;
   `review-live-link` visible; `unpublish-article` visible.
6. Click `unpublish-article`. `expect(review-status-badge).toHaveText(/unpublished/i)` (auto-retrying);
   `expect(review-live-link).toHaveCount(0)`; `expect(republish-article).toBeVisible()`.
7. **Gone from `/news`:** navigate `/news` (fresh/anon context) → `expect` an `article-card` with the
   throwaway's `data-slug` → `toHaveCount(0)`.
8. **Slug 404s:** `page.goto('/news/[slug]')` → assert the **response HTTP status is 404** and
   `article-not-found` is visible (real 404, not a soft render — the same property `init-web-002` asserts
   for drafts; guaranteed by the no-`loading.tsx` constraint, §4/§7).
9. **Remains in the editor queue as `unpublished`:** back to `/admin/queue` → `expect` the `queue-item`
   `filter({ hasText: markerTitle })` **still present** with `queue-item-status` `/unpublished/i`.
10. `afterAll` targeted-deletes the throwaway → feed back to exactly **2** published.

**Out-of-band empirical checks (the slice-05/06 way):**
- **dcon-style row read** (admin client): the throwaway row is `status='unpublished'`; `published_at` is
  **still non-null** (the KEEP decision, §2); `body` unchanged.
- **Anon cannot see it:** a fresh **anon** SELECT by slug returns `[]` (published-only composition intact);
  the overall anon feed still returns exactly the seeded 2 published.
- **Re-publish works** (bonus, proves "for re-publish"): as the editor, click `republish-article` →
  `expect(review-status-badge).toHaveText(/published/i)`, `review-live-link` returns, and a fresh anon
  SELECT by slug sees the row again / it reappears on `/news`. Then unpublish (or delete via `afterAll`) so
  the feed returns to 2. This closes the loop the scenario's final clause implies.

Respect the auto-retry-`expect` gotcha; real Supabase (never mock); targeted cleanup only. `tsc --noEmit` +
`eslint` clean; run the full suite yourself from a clean `.next`; drive a real browser end-to-end;
screenshot the "Unpublished" chip + the empty `/news` slot + the 404.

**Regression watch (flag for the tester — the architect does not edit test files):**
- **Feed exactly-2** must survive — the throwaway is published only within this spec's own window and is
  targeted-deleted in `afterAll`; `init-web-001`'s `toHaveCount(2)` must still pass.
- **Broadening the editor queue** now lists `published` + `unpublished` rows (incl. the 2 seeded published)
  for an editor. Verify **`init-e2e-005` does not assert the editor queue is *exclusively* `in_review`**
  (slice-06 §7 uses **presence** assertions, so it should be safe) — but the tester must confirm no
  exclusivity/count assertion on the editor queue regresses. The contributor queue (`listQueueArticles`,
  own draft+in_review) is untouched, so `init-e2e-003` is unaffected.
- **`init-e2e-004`** (contributor cannot publish) is untouched — no policy or gate changed; slice 08 adds no
  capability a contributor could reach (`unpublishArticle` action `requireRole('editor')`; the RLS UPDATE
  policy is editor-gated).

---

## 9. Prototype debt (recorded for `/actualize`) + entities check

**New/updated debt:**
- **`unpublishArticle` → `publishArticle` re-publish rewrites `published_at=now()` unconditionally**
  (QA (c)) — because re-publish reuses `publishArticle`, which has no idempotency guard on `published_at`, a
  publish → unpublish → re-publish cycle **rewrites `published_at` and floats the article to the top of the
  feed**. Acceptable for the prototype; the re-publish-guard debt from slice 06 now also covers this path.
- **An aborted run after the `published` seed leaves a 3rd published card** on the shared DB (QA (c)) — the
  next run's `beforeAll` heal-by-marker removes it, but the shared-DB, no-per-worker-isolation posture is
  itself prototype debt; a real environment needs isolated test data.
- **Editor UPDATE `WITH CHECK` still pins only the editor role** (slice-06 debt) — it does not pin
  `source`/`author_id` unchanged across an unpublish either. Mitigation holds: `unpublishArticle` patches
  **only `status`**, so it cannot alter provenance; pinning "unchanged" needs a `BEFORE UPDATE` trigger,
  deferred.
- **Editorial queue is a flat `updated_at`-ordered list**, not grouped by status. Explicit grouping
  (needs-action → live → retired) is deferred polish.
- **`listReviewQueue` becomes dead code** once the queue page switches to `listEditorialQueue` (exactly one
  caller confirmed) — remove it (or repurpose as a future "needs-review-only" filter). Flagged so a "trivial
  cleanup" note does not outlive the thing it describes.
- **Unpublish is a pure status flip with no audit trail** — no record of *who* unpublished or *why* (no
  editorial-log entity exists). A future editorial-audit slice would capture it.
- **No optimistic-concurrency guard** — two editors racing publish/unpublish on the same row is
  last-write-wins (inherited).
- **Nothing shippable from Conceptualize** — slice 08 still owes `/actualize` (debt audit, backfilled tests,
  dcon on the `Then` data, red-team of the unpublish action/RLS, CI) before ship.

**Entities check (`docs/entities.md`):** The **Article lifecycle now actually reaches `unpublished` via
editor authorization exercised through the app** — realizing the §Authz **Editor** "transition any Article
to `published`/`unpublished`" capability that slice 06's changelog line noted as *forward-correct/permitted*.
No entity is added, renamed, or re-shaped, and **no DB capability is added** (the `0004` policy already
permitted it). A brief dated changelog line is **warranted** (the lifecycle's `unpublished` state is now
app-reachable, not merely policy-permitted). Recommended Appendix A line — **provided here for the
orchestrator/build to append; the sketch does not edit the file** (Conceptualize sketch discipline):

```
- 2026-07-31 — Editor unpublish realized (slice 08 conceptualize; ratify in /plan). §Authz "Editor"
  "transition any Article to published/unpublished" is now exercised through the app: an editor
  unpublishes a live Article (status published → unpublished) via the /admin/review/[id] desk and the
  session client, enforced by the existing migration-0004 articles_editor_update policy — NO new
  migration. The unpublished Article leaves the public anon read surface (0001 published-only policy),
  so it vanishes from /news and its slug 404s like a draft, while remaining visible in the editor's
  broadened editorial queue (in_review + published + unpublished) for re-publish (which reuses the
  slice-06 publish path). published_at is retained on unpublish (the 0001 CHECK constrains only the
  published state), preserving the original-publish record. No entity was added or renamed. Proposed —
  softball/init conceptualize; ratify in /plan.
```

---

## 10. Smallest-slice check — **one slice; ship it whole (do not split)**

Slice 08 is materially smaller than slice 05 (which was split) and even smaller than slice 06: **zero
migrations**, **one** mutator (`unpublishArticle`, a single-column update), **one** Server Action, **one**
new client island (`unpublish-article-form`, a button-only twin of an existing form), a **two-prop**
additive change to `PublishArticleForm` (to re-label its reused button), one broadened read
(`listEditorialQueue`), and a status-branch on the review view + a one-line queue swap. The observable
behavior maps to a **single** scenario's When/Then (unpublish → gone from `/news` → slug 404 → still in
queue). The highest-risk element — the `published → unpublished` RLS transition and its invisibility to
anon — is **already proven** (slice-06 probe 2) and re-provable out of band **before** the UI is wired.
**Recommendation: build slice 08 as one slice.** If the orchestrator wants a gate, the natural checkpoint is
"re-confirm the unpublish RLS + anon-invisibility out of band" **before** "wire the Unpublish/Re-publish
UI" — a checkpoint, not a separate shippable increment.

---

### Files this slice touches (all absolute)

- `/home/tony/code/softball/lib/articles.ts` — add `unpublishArticle(id, supabase)`; add
  `listEditorialQueue(supabase)`; (remove/repurpose `listReviewQueue`).
- `/home/tony/code/softball/app/admin/(protected)/review/[id]/actions.ts` — add `unpublishArticle` Server
  Action + `UnpublishArticleState`.
- `/home/tony/code/softball/app/admin/(protected)/review/[id]/page.tsx` — status-branch the controls
  (in_review → publish; published → live link + unpublish; unpublished → re-publish).
- `/home/tony/code/softball/components/client/unpublish-article-form.tsx` — **new** button-only island.
- `/home/tony/code/softball/components/client/publish-article-form.tsx` — add optional `submitLabel` /
  `submitTestId` props (in-review behavior unchanged when omitted).
- `/home/tony/code/softball/app/admin/(protected)/queue/page.tsx` — editor branch calls
  `listEditorialQueue`.
- **No migration.** `/home/tony/code/softball/supabase/migrations/` is untouched.
- **No new file under `/home/tony/code/softball/app/(public)/news/`** (QA (b) hard constraint) — the public
  news routes are read-only for this slice; a `loading.tsx`/Suspense above the by-slug fetch would downgrade
  the 404 to a streamed 200.
- Entities changelog line (§9) recommended for `/home/tony/code/softball/docs/entities.md` Appendix A —
  provided as text, not applied.

No implementation or test code was written; this is the contract/sketch for `nextjs-qa-reviewer` →
`nextjs-tester` → `nextjs-implementer`.
