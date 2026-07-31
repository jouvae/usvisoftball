# Slice 06 — Editor reviews, edits, and publishes (`init-e2e-005`)

> **Phase:** Conceptualize (Phase 2). **Type:** contract/sketch — no implementation or test code here.
> **Scenario (sole scope):** a signed-in `editor` opens an article in `in_review`, **edits the body**,
> and **publishes** it; it transitions to `status=published` with a `published_at` timestamp and now
> **appears on the public `/news` feed and its `/news/[slug]` article page**.
>
> **Explicitly OUT of scope (later slices):** `init-e2e-004` (contributor cannot publish — **slice 07**;
> the RLS barrier is already proven by slice-05 probe 5 and MUST NOT be weakened here) and
> `init-e2e-006` (unpublish — **slice 08**; the editor UPDATE policy is designed so `published →
> unpublished` drops in cleanly, but no unpublish UI is built now).
>
> **Read-first (binding):** `DESIGN.md` (root) · `slice-05-contributor-draft.md` (the RBAC foundation
> this builds on) · `supabase/migrations/0001_articles.sql` (the live `articles` schema, grants, the
> anon published-read policy, the `published ⇒ published_at` CHECK) + `0003_profiles_and_authorship.sql`
> (profiles, `has_role`, the contributor policies) · `docs/entities.md` §Identity/Access + §Authz.
> **L-init-01:** standalone Next.js **16.2.10** + Supabase; NO Go, gRPC, proto, Dorothy, `gormClient`,
> `useApis`/`serverApiClient`, shadcn, or `src/`. `app/` is at repo root.

---

## 0. Grounding (every framework / Supabase / Postgres-RLS claim cited to an installed source)

| Claim | Source (installed) |
|---|---|
| A Server Action is `'use server'`, "runs as a POST request against the page … reachable to anyone who can send the same POST. Treat every action as an untrusted entry point." | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` L20-22, L78 |
| Inside every action: **authenticate and authorize** ("Render-time gating … is not a security boundary, because requests can be sent without going through the UI"); the doc's own delete example does `if (!(await canDelete(session.user, postId))) throw` | `.../server-actions.md` L89, L103-105 |
| Send a **reference (id) + the change**, and re-read/verify from a trusted source using the session; a well-formed object "can still refer to a row the caller does not own" | `.../server-actions.md` L113, L127-133 |
| A Server Action that revalidates does the mutation + cache-invalidation + re-render "in a single roundtrip"; **`redirect` throws a control-flow exception so "any code after it does not run … Place revalidation calls before `redirect`"** | `.../server-actions.md` L36, L72 |
| `revalidatePath` "can be called in Server Functions and Route Handlers … **cannot** be called in Client Components or Proxy"; a **literal path** (`/product/123`) refreshes that single page and needs **no** `type`; a path with a **dynamic segment** (`/product/[slug]`) **requires** `type` | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` L10-12, L25-28 |
| `redirect` in a Server Action serves **303**; elsewhere **307**; must be called **outside** any `try/catch` because it throws `NEXT_REDIRECT` and "terminates rendering of the route segment" | `.../04-functions/redirect.md` L11, L50-52, L61 |
| **Verify auth inside each Server Action** — a layout guard is not sufficient; "Next.js applications have multiple entry points, which will not prevent nested route segments and **Server Actions** from being accessed"; security belongs "as close as possible to your data source" | `node_modules/next/dist/docs/01-app/02-guides/authentication.md` §"Server Actions", §"Data Access Layer" |
| The cookie-backed, RLS-enforced **session** client runs as the end user (anon/publishable key, `getUser()`); the admin client is service-role / RLS-bypassing | `lib/supabase/server.ts`, `lib/auth.ts` `requireUser()`, `lib/roles.ts` `requireRole()`; `lib/supabase/admin.ts` |
| `params` is async in dynamic routes (`const { id } = await params`); sole-`<main>` rule; `data-testid` mandatory; deterministic UTC dates (never `toLocaleDateString`) | `DESIGN.md` §"Next.js 16 breaking changes", §"Component authoring conventions"; `lib/format.ts` |
| The seed admin (`SEED_ADMIN_EMAIL`) is assigned **`roles=['editor']`** by `assignRoles` — it IS the editor `init-e2e-005` signs in as | `scripts/seed-admin.ts` L36 |
| The `articles` table CHECK `articles_published_requires_published_at` (`status <> 'published' or published_at is not null`) is a **table constraint**, enforced for every writer including the editor session client | `supabase/migrations/0001_articles.sql` L58-62 |

> **⚠️ Grounding gap surfaced honestly (verify-by-observing):** there is still **no Supabase-RLS /
> permissive-policy-composition guidance bundled in `node_modules/@supabase/*`** (only READMEs /
> CHANGELOGs). The OR-composition reasoning in §1 is grounded in **Postgres semantics** (multiple
> PERMISSIVE policies for the same command are combined with `OR`; a row is updatable when
> `USING_a OR USING_b` holds and the new row must satisfy `WITH_CHECK_a OR WITH_CHECK_b`). Structural
> existence of a policy proves nothing — the implementer MUST **prove it empirically** (§1.4 probes)
> before trusting it, exactly as slices 02/03/05a did. The editor cannot be assumed to publish, and the
> contributor cannot be assumed to still be barred, until both are observed out of band.

---

## 1. Migration `0004_editor_policies.sql` (the contract)

Additive and replayable — the slice-01/02/03/05 discipline (`drop policy if exists` then `create`,
applied out of band with `psql "$SUPABASE_DB_URL" -f …`, **never** from app code: API keys reach
PostgREST, DDL is not exposed over HTTP — `status.md`). Two **new permissive** policies on
`public.articles`, both `to authenticated`, both gated by `public.has_role(auth.uid(),'editor')`. The
SQL below is the **contract**; the file is written/applied during build, not in this sketch.

### 1.1 Editor SELECT-any (the editor-wide queue needs to see every row)

```sql
-- A SECOND-and-a-half permissive SELECT policy (after 0001 anon/auth published-read
-- and 0003 contributor own-read). Permissive policies are OR-combined, so for an
-- authenticated caller the effective SELECT predicate becomes:
--     status = 'published'                       (0001, to anon+authenticated)
--  OR author_id = auth.uid()                     (0003, to authenticated)
--  OR public.has_role(auth.uid(), 'editor')      (this, to authenticated)
-- An EDITOR therefore sees EVERY article (draft/in_review/published/unpublished) —
-- exactly what the editor-wide review queue needs. anon is UNTOUCHED (this policy is
-- `to authenticated`; the only anon-facing policy is still 0001's published-only),
-- and the contributor own-read is unchanged.
drop policy if exists articles_editor_read_all on public.articles;
create policy articles_editor_read_all
  on public.articles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'editor'));
```

### 1.2 Editor UPDATE-any (edit the body + transition status)

```sql
-- USING gates WHICH rows an editor may update: ANY row (no author_id / no status
-- restriction) — an editor edits any article regardless of who authored it. WITH
-- CHECK gates the RESULT row: it need only re-assert the editor role. The target
-- status is NOT re-enumerated here on purpose — the set of legal statuses and the
-- `published ⇒ published_at is not null` invariant are already enforced by the 0001
-- TABLE CHECKs (`status in ('draft','in_review','published','unpublished')` and
-- `articles_published_requires_published_at`), which apply to EVERY writer including
-- this session client. Duplicating them in RLS would be redundant and drift-prone
-- (the repo's stated layered-controls model: GRANTs bound verbs, RLS bounds rows,
-- CHECKs bound column invariants). So this policy PERMITS published AND unpublished
-- (forward-correct for slice 08) with zero extra predicates.
drop policy if exists articles_editor_update on public.articles;
create policy articles_editor_update
  on public.articles
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));
```

- **No editor INSERT / DELETE policy** — default-deny stands; editors transition existing rows, they
  do not create or hard-delete articles in this slice.
- **`published_at` is set by the Server Action**, not a DB default (there is none). The action writes
  `published_at = now()` alongside `status='published'`; the 0001 table CHECK is the backstop that
  makes a `published` row with a NULL `published_at` **impossible** even if a future caller forgets.

### 1.3 Composition correctness — the anti-tautology point (why 004 stays a genuine negative)

The critical claim: adding the editor's permissive UPDATE policy **does not weaken** the contributor's
"cannot publish" barrier. Walk the two callers explicitly.

**A contributor (NOT an editor) trying to publish their own `in_review` row:**
- **USING (row selectable for update?):** `contributor_update.USING` (own + contributor + in_review) →
  **TRUE**; `editor_update.USING` (`has_role editor`) → **FALSE**. `TRUE OR FALSE` → the row *is*
  updatable. (Good — a contributor can still edit their own in_review row.)
- **WITH CHECK (is the NEW row, status=published, allowed?):** `contributor_update.WITH CHECK`
  (`status in ('draft','in_review')`) → **FALSE**; `editor_update.WITH CHECK` (`has_role editor`) →
  **FALSE**. `FALSE OR FALSE` → **UPDATE REJECTED** (`42501`), status unchanged.

So the contributor publish barrier is **intact** — the editor's permissive WITH CHECK only ever helps a
caller who genuinely holds the `editor` role (`has_role` gates each policy; an editor is not a
contributor and vice versa). `init-e2e-004` (slice 07) therefore becomes a **real** negative against a
capability that now genuinely exists, not a vacuous pass. This is exactly the swap rationale in
`status.md` ("build the real publish capability first, then 004 is a genuine negative").

**An editor publishing an `in_review` row:** `editor_update.USING` → TRUE (row selectable);
`editor_update.WITH CHECK` → TRUE; the 0001 table CHECK passes because the action sets `published_at`.
→ **SUCCEEDS.** The row is now `status='published'` and visible to anon via the 0001 policy.

### 1.4 Verifying the editor RLS **empirically** (out-of-band probes — the slice-02/03/05a way)

Structural checks only prove a policy *exists*. Probe the live REST API with real session JWTs
(`signInWithPassword`) out of band and assert **behavior**:

1. **editor session** UPDATE an `in_review` row → `status='published', published_at=now()` → **succeeds**;
   the row is then visible to a **fresh anon** SELECT by slug (published-read).
2. editor UPDATE `published → unpublished` → **succeeds** (forward-correct for slice 08); the row then
   **disappears** from an anon SELECT (published-only). *(Design-proof only — no unpublish UI this slice.)*
3. editor UPDATE that sets `status='published'` **without** `published_at` → **rejected** by the 0001
   table CHECK (`articles_published_requires_published_at`) — proving the invariant holds on the editor path.
4. editor SELECT returns `draft` + `in_review` + `published` + `unpublished` rows (the editor-wide read).
5. **contributor session** UPDATE own `in_review → published` → **rejected** (`42501`), status unchanged
   — the slice-05 probe-5 barrier, re-run to prove the editor policies did **not** weaken it (§1.3).
6. **anon** SELECT still returns ONLY `published` rows; anon SELECT of the (pre-publish) `in_review` row
   by slug → **`[]`** — the OR-composition did not widen anon.
7. after the editor publishes through the **app path**, a service-role read confirms `source` and
   `author_id` are **unchanged** from the seeded values — documenting that `publishArticle` does not
   alter provenance/authorship even though the editor UPDATE `WITH CHECK` would permit it (MINOR-1, §9).

### 1.5 Grants

`authenticated` already holds `SELECT` (0001) + `INSERT, UPDATE` (0003). The editor path is **UPDATE +
SELECT only**, so **no new grant is needed**; `anon` stays `SELECT`-only (unchanged — `init-web-001` /
`init-web-002` cannot regress). `service_role` (BYPASSRLS) is untouched. Confirm this empirically via
probe 6 (anon composition intact).

---

## 2. Write path — `lib/articles.ts` (client-injectable, RLS-enforced as the editor)

The editor publish MUST execute through the **cookie session client as the editor**
(`lib/supabase/server.ts`) so the `articles_editor_update` policy genuinely enforces — **never** the
admin client (which bypasses RLS and would defeat the point). Add two typed mutators + one typed read,
mirroring the slice-05 injectable pattern (seed defaults to admin, actions pass the session client).

### 2.1 `publishArticle` — edit the body (optional) + publish, atomically

```ts
// The ONE publish mutator (slice-06 §2). Injected client => RLS-enforced by
// articles_editor_update. Sets status='published' + published_at=now() and, when
// supplied, the edited body — in a SINGLE update, matching the scenario's "edit the
// body and publish it" gesture. No `.eq('status', …)` guard: RLS is the boundary and
// an editor may publish any editor-visible row. `.single()` throws PostgrestError
// 'PGRST116' on 0 rows (RLS denied — caller is not really an editor — or a missing
// id); the publishArticle Server Action MUST catch that and return { error }.
export async function publishArticle(
  id: string,
  fields: { body?: string },
  supabase: SupabaseClient,
): Promise<Article> {
  const patch: Record<string, unknown> = {
    status: "published",
    published_at: new Date().toISOString(), // ISO 8601 UTC — the 0001 CHECK requires non-null
  };
  if (fields.body !== undefined) patch.body = fields.body;

  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}
```

> **NIT-1 (not idempotent on `published_at`):** `published_at` is set to `now()`
> **unconditionally**, so re-publishing an already-`published` row rewrites the
> timestamp and reorders the feed. Out of scope this slice (the path is
> `in_review → published`, a single transition), but recorded as debt (§9).

### 2.2 `saveArticleAsEditor` — edit-body Save without publishing (forward-correct; optional wire-up)

```ts
// The editor edit-body Save (own-or-any row, RLS-enforced by articles_editor_update).
// Distinct from the contributor `saveDraftFields`, whose RLS requires author_id=self —
// an editor is NOT the author, so that helper 0-rows for them. Scoped to `body` this
// slice (the scenario edits only the body); title/category/hero stay author-owned
// (prototype debt §7). Injected client => RLS-enforced. PGRST116 handled by the caller.
export async function saveArticleAsEditor(
  id: string,
  fields: { body: string },
  supabase: SupabaseClient,
): Promise<Article> { /* .update({ body }).eq('id', id).select('*').single() */ }
```

> **Recommendation:** the scenario's critical path is **edit body → publish in one gesture**, so
> `publishArticle(id, { body })` alone satisfies `init-e2e-005`. `saveArticleAsEditor` is the
> forward-correct "save without publishing" affordance — sketch it, but wiring a separate editor Save
> UI is **optional** this slice (keeps the review view to one submit island; avoids a second error
> testid — same discipline as slice-05's deferred contributor Save).

### 2.3 `listReviewQueue` — the editor-wide "awaiting review" read

```ts
// The editor-wide review queue (slice-06 §3). Reads ALL in_review rows through the
// SESSION client — visible only because articles_editor_read_all makes every row
// visible to an editor (a contributor calling this would see only their OWN in_review
// via own-read, which is why the queue page BRANCHES on role and calls
// listQueueArticles for contributors instead). Newest edit first. Returns [] when
// nothing awaits review (NOT an error).
export async function listReviewQueue(
  supabase: SupabaseClient,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .eq("status", "in_review")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toArticle(row as unknown as ArticleRow));
}
```

Scoped to `in_review` deliberately: the *review* queue is items awaiting an editor decision. `draft`
(still being authored) and `published` (already live) do not belong there — a full editorial dashboard
is a later concern (§7).

---

## 3. Server Action(s) (`'use server'`) — auth + role checked **inside each action**

A Server Action is an independently-reachable POST endpoint (server-actions.md L78; authentication.md
§"Server Actions"), so it **re-verifies** the session + `editor` role itself — it does **not** lean on
the `(protected)` layout guard.

**`app/admin/(protected)/review/[id]/actions.ts` → `publishArticle(id, prevState, formData)`**
(bound via `publishArticle.bind(null, id)` so the id is a server-closure reference, not a forgeable
field — server-actions.md L113, L127-133; RLS re-verifies regardless).

1. `await requireRole('editor')` — the DAL choke point (`lib/roles.ts`): `requireUser()` (redirects if
   unauthenticated) + reads the caller's `profiles` row through the session/RLS client and confirms
   **active** `editor` membership; a non-editor is redirected to `/admin`. *(Render-time gating is not the
   boundary — authentication.md §"Server Actions"; RLS `articles_editor_update` is the real one.)* Do NOT
   destructure `{ user }` — the publish path needs no `user.id` (RLS handles identity), and an unused
   binding trips `eslint` no-unused-vars (NIT-2).
2. Read + minimally validate `body` from `formData` (untrusted — server-actions.md L89). Empty/whitespace
   body → `return { error: 'The article body cannot be empty.' }` (never publish an empty body).
3. `const supabase = await createSupabaseServerClient();` then, **inside try/catch**,
   `const published = await publishArticle(id, { body }, supabase)` — RLS-enforced as the editor. A
   non-editor-visible or missing id matches 0 rows → `.single()` throws `PGRST116`: **catch it and**
   `return { error: 'Could not publish this article.' }`; re-throw anything that is not `PGRST116`.
4. On success, **before** any redirect (server-actions.md L72), revalidate every affected path with
   **literal** paths (no `type` needed — revalidatePath.md L25-28):
   - `revalidatePath('/news')` — the feed gains a card;
   - `revalidatePath(`/news/${published.slug}`)` — the article page now renders (was a 404 for anon);
   - `revalidatePath('/admin/queue')` — the review queue loses this in_review row;
   - `revalidatePath(`/admin/review/${id}`)` — the review view's status chip flips to Published.
5. **No redirect** (recommended): stay on the review view; revalidation ships the fresh `Published`
   status + a live link in the same roundtrip (server-actions.md L36) — mirrors slice-05's
   `submitForReview` (stay + revalidate, no redirect). *If* a redirect to `/news/${published.slug}` is
   preferred, it MUST be **outside** the try/catch (throws `NEXT_REDIRECT`; 303 from an action → the
   browser GETs the live article — redirect.md L11, L50-52).

**Edit-body-only save (optional):** `saveArticle(id, prevState, formData)` — same `requireRole('editor')`
gate, `saveArticleAsEditor(id, { body }, session)`, `revalidatePath(`/admin/review/${id}`)`; NOT `/news`
(saving publishes nothing). Deferred unless the orchestrator wants a distinct Save (§2.2 note).

> **`/news` IS revalidated here** (unlike slice-05's submit, which published nothing) — publishing is
> exactly the mutation that changes the public feed. `revalidatePath` cannot run in Proxy/Client
> anyway (revalidatePath.md L12).

---

## 4. Editor UI (Server Components + minimal Client islands)

All protected pages render **inside the existing `<main data-testid="admin-main">`** (the `(protected)`
layout owns the sole `<main>`); pages root at a `<section>`, never a second `<main>`. DESIGN.md tokens;
gold stays scarce.

### 4.1 Dashboard nav — add the editor's Editorial-queue link (resolves the slice-05b deviation)

`app/admin/(protected)/page.tsx` today gates the whole `admin-nav` on `canAuthor = roles.includes('contributor')`.
Make it role-aware:

```tsx
const canAuthor = roles.includes("contributor"); // New article + own queue
const canReview = roles.includes("editor");       // editorial review queue
const showNav = canAuthor || canReview;
// nav renders admin-new-article-link ONLY when canAuthor;
//              admin-queue-link       when (canAuthor || canReview) — one route, role-aware (§4.2).
```

An **editor** now sees the `admin-queue-link` → `/admin/queue`. `admin-new-article-link` stays
**contributor-only** (an editor is not an author — `createDraft` requires `contributor`; a New-article
link for an editor would be a semi-dead link, the MAJOR-2 defect slice 05 avoided). The 05a
`admin-roles` / `admin-authenticated` / `admin-dashboard` markers are preserved.

> **⚠️ RETIRES the slice-05b deviation — and BREAKS a frozen 05a assertion (tester must update it).**
> `tests/e2e/init/init-e2e-003a-roles.spec.ts` test 3 ("admin-roles is NON-navigating in 05a") signs in
> as the **admin/editor** and asserts BOTH `/admin/articles/new` **and** `/admin/queue` have
> `toHaveCount(0)`. After this slice the editor legitimately has the `/admin/queue` link, so that
> assertion is **intentionally false** and **MUST be retired/updated by the tester as part of slice 06**
> (per `status.md`: "when slice 07 lands editor nav, that 05a assertion must be retired together with
> it" — slice 06 is that moment). The correct updated assertion: for the editor, `/admin/articles/new`
> stays **absent** (editor is not a contributor) while `/admin/queue` is now **present**. The
> orchestrator must brief the tester on this explicitly — the architect does not edit test files.

### 4.2 `/admin/queue` — role-aware (editor sees all `in_review`; contributor sees own)

`app/admin/(protected)/queue/page.tsx` branches on role (it already `force-dynamic`, reads via the
session client):

```tsx
const user = await requireUser();
const profile = await readOwnProfile(user.id);
const isEditor = (profile?.roles ?? []).includes("editor");
const supabase = await createSupabaseServerClient();
const articles = isEditor
  ? await listReviewQueue(supabase)     // ALL in_review (articles_editor_read_all)
  : await listQueueArticles(supabase);  // own draft + in_review (contributor own-read)
```

Queue-item link target is role-aware: an **editor**'s `queue-item-title` links to
**`/admin/review/${id}`** (the review desk); a **contributor**'s links to `/admin/articles/${id}`
(their own editor, unchanged). Same `queue-list` / `queue-item` / `queue-item-title` /
`queue-item-status` / `queue-empty` testids serve both roles (one route). The editor's queue shows
only `in_review` items (published ones have left the queue).

### 4.3 The review/edit/publish view — a **dedicated editor route** (recommended)

**Decision: new route `app/admin/(protected)/review/[id]/page.tsx`**, NOT extending the contributor
`app/admin/(protected)/articles/[id]/page.tsx`. Justification:
- **Authorization clarity.** The review page can `requireRole('editor')` at the top — a real page-level
  gate (a contributor hitting `/admin/review/[id]` is redirected to `/admin`). The shared `[id]` route
  serves contributors and therefore **cannot** `requireRole('editor')`; grafting editor affordances onto
  it means per-affordance role branching in one file. Two routes = two clean mental models: `[id]` = the
  author's own editor, `review/[id]` = the editor's review desk.
- **testid isolation.** The review view owns `review-view` / `editor-body` / `publish-article` /
  `publish-article-error` / `review-status-badge` without colliding with the `[id]` route's
  `draft-editor` / `submit-for-review` / `draft-error` on the same DOM (the task's explicit warning).
- **sole-`<main>` preserved.** `review/[id]` is its own route segment rendering inside the shared
  `admin-main` `<main>` from the protected layout — no second `<main>`.

Page shape (`export const dynamic = "force-dynamic"` — mutable row read via the session client):

```tsx
export default async function ReviewPage({ params }: PageProps<"/admin/review/[id]">) {
  await requireRole("editor");                    // page-level editor gate (redirects a non-editor)
  const { id } = await params;                    // params is async (Next 16)
  const supabase = await createSupabaseServerClient();
  const article = await getArticleById(id, supabase); // editor SELECT-any makes ANY row visible
  if (!article) notFound();                        // missing id (or, defensively, not visible)
  // <section data-testid="review-view">: status chip (review-status-badge) + source marker +
  //   title + category + hero (read-only) + PublishArticleForm island (editable body + Publish).
  //   When status === 'published', also render a live link → /news/[slug] (review-live-link).
}
```

- **`getArticleById(id, session)`** (existing, slice-05) works unchanged for the editor: the
  `articles_editor_read_all` policy makes any article visible through the session client.
- **`components/client/publish-article-form.tsx`** (`'use client'`): `useActionState(publishArticle.bind(null,id))`;
  a `<textarea data-testid="editor-body">` **prefilled** with `article.body` (`defaultValue`), a
  **Publish** submit button (`publish-article`), pending state, and an error slot
  (`publish-article-error`). Navy-on-white primary button (no gold CTA in the admin — DESIGN.md). Body
  stays a plain `<textarea>`; **`dangerouslySetInnerHTML` on DB-sourced body stays banned** (stored-XSS).

### 4.4 DESIGN.md — the `published` status chip (define it; gold stays scarce)

Extend `components/ui/article-status-badge.tsx` from its `in_review ? gold : surface` binary to a full
`Record<ArticleStatus, tone>`:

| status | tone (Tailwind) | text-on-fill | ratio | rationale |
|---|---|---|---|---|
| `draft` | `bg-surface text-brand border border-border` | navy on `#f5f7fa` | 11.87:1 | quiet (existing) |
| `in_review` | `bg-accent text-accent-foreground` | **navy on gold** | 8.13:1 | the scarce gold "needs action" signal (existing) |
| `published` | `bg-brand text-header-foreground` | **white on navy** | **12.74:1** | **NEW** — solid/"live"; NOT gold (published is a settled state, not an "act now" signal — DESIGN.md rule 4: gold means act-now/wayfinding, it "never decorates") |
| `unpublished` | `bg-surface text-muted border border-border` | slate on `#f5f7fa` | 7.06:1 | **NEW (forward, slice 08)** — muted/retired |

White-on-navy `#ffffff` on `#1a315f` = **12.74:1** (DESIGN.md measured table, `header-foreground` on
`header`). **Gold is deliberately NOT reused for `published`** — keeping gold scarce (≈4 appearances/screen)
is what makes `in_review`'s gold chip read as "this one needs a decision." **Gold never carries white
text** (DESIGN.md rule 1) — not at issue here since `published` uses navy fill / white text.

---

## 5. `data-testid` contract (hard — the e2e targets exactly these)

| `data-testid` | Element | New/Reused | Where |
|---|---|---|---|
| `admin-nav` | dashboard nav wrapper (now also shown for `editor`) | Reused | `app/admin/(protected)/page.tsx` |
| `admin-queue-link` | link → `/admin/queue` (now rendered for `editor` too) | Reused | dashboard nav |
| `queue-list` / `queue-item` / `queue-item-title` / `queue-item-status` / `queue-empty` | role-aware editorial queue (editor: all `in_review`) | Reused | `queue/page.tsx` |
| `review-view` | `<section>` root of the editor review route | **NEW** | `review/[id]/page.tsx` |
| `review-status-badge` | status chip on the review view (`in_review` → `published`) | **NEW** | `review/[id]/page.tsx` (via `ArticleStatusBadge testId=`) |
| `review-source` | source marker (asserts `human`) | **NEW** | `review/[id]/page.tsx` |
| `editor-body` | editable body `<textarea>` (prefilled) | **NEW** | `publish-article-form.tsx` |
| `publish-article` | **Publish** submit `<button>` | **NEW** | `publish-article-form.tsx` |
| `publish-article-error` | publish error (present only on failure) | **NEW** | `publish-article-form.tsx` |
| `review-live-link` | link → `/news/[slug]`, shown once `status==='published'` | **NEW** | `review/[id]/page.tsx` |
| `article-card` (+ `data-slug`) / `article-card-headline` | the now-published article on `/news` | Reused | `article-card.tsx` (asserted, not added) |
| `article-headline` / `article-body` | the published article page (asserts the **edited** body) | Reused | `news/[slug]/page.tsx` + `article-body.tsx` |

**Absence/presence** assertions use the auto-retrying `expect(...).toHaveCount(n)` / `.toBeVisible()`
(never a bare `locator.count()` — the recorded false-defect gotcha). Any new testid added during
implementation MUST be added to this table (DESIGN.md §Component authoring).

---

## 6. Data lifecycle for the shared-DB test (critical — the suite is `workers:1` on ONE Supabase DB)

`init-web-001` asserts **exactly 2** published cards (`toHaveCount(2)`). Publishing a **3rd** article
that survives past this spec would break it. Design the `init-e2e-005` spec to leave the feed at **2**:

**Recommendation — a throwaway `in_review` article, admin-seeded + targeted-deleted (do NOT touch the
`playoff-brackets-in-review` fixture).**
- **`beforeAll`:** (a) delete-by-marker (clean any leftover from a prior aborted run), then (b) seed ONE
  throwaway `in_review` row via the **BYPASSRLS admin client** using `createArticle({ …, status:'in_review',
  source:'human', authorId:null }, adminClient)` with a per-run **unique marker title**
  `[e2e-005] editor publish {randomUUID()}` and a unique slug. This is **setup/precondition** (the
  scenario's *Given*), so the admin client is sanctioned — exactly as `init-web-001` seeds via
  `createArticle` and `init-e2e-003` tears down via the admin client. The **assertion path** (the editor
  publishing) still runs through the **real editor UI + session client → `articles_editor_update`**, so
  RLS is genuinely exercised.
- **`afterAll` (fail-closed):** delete every article whose title starts with the marker prefix
  (`.like('title', '${MARKER_PREFIX}%')` via the admin client) — a **targeted** teardown, **never**
  `deleteAllArticles()` (which would nuke the seeded published rows the feed specs depend on). This
  restores the feed to exactly **2** published and makes the suite re-runnable.
- **Why NOT reuse `playoff-brackets-in-review`:** that seeded fixture is a **shared** `in_review` row that
  `init-web-002` relies on as a 404 fixture; publishing then reverting it couples specs and risks a
  fragile `published_at`-null revert. A uniquely-marked throwaway is isolated and cleanly deletable.
- **Ordering safety:** `fullyParallel:false` + `workers:1` runs files serially; `afterAll` deletes the
  throwaway **before** the `init-web-001` file runs, so the "exactly 2" assertion never sees the 3rd
  card. The throwaway is `published` only for the window between `init-e2e-005`'s publish step and its
  own teardown.
- Gate the spec to the **desktop** project only (via `beforeEach` `test.skip`, the working pattern) — a
  real sign-in mutates a shared session and the assertions are not viewport-specific (mirrors
  `init-e2e-003` / `init-e2e-003a` / `init-e2e-008`).

---

## 7. Verification plan for `init-e2e-005` (observe, never infer; real Supabase, never mock)

Precondition: migration `0004` applied out of band; `npm run seed` (baseline articles) + `npm run
seed:admin` (the admin, assigned `roles=['editor']`) have run. Drive the **real** Supabase sign-in — no
forged/minted session.

**Happy path (the scenario):**
1. `beforeAll` seeds the throwaway `in_review` row (marker title, §6).
2. Sign in as the **editor** (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`) via `/admin/login` → lands `/admin`.
3. `expect(admin-nav)` visible; click `admin-queue-link` → `/admin/queue`. `expect` a `queue-item`
   `filter({ hasText: markerTitle })` present with `queue-item-status` `/in.?review/i` (the editor-wide
   read surfaced a row the editor did not author — proving `articles_editor_read_all`).
4. Click the queue item → `/admin/review/[id]`; `review-view` visible; `review-status-badge`
   `/in.?review/i`; `review-source` `/human/i`.
5. Fill `editor-body` with a UNIQUE edited body marker. Click `publish-article`.
6. `expect(review-status-badge).toHaveText(/published/i)` (auto-retrying — never a bare `count()`).
   Optionally `expect(review-live-link)` visible.
7. **Appears on `/news`:** navigate `/news` (the editor's context, or a fresh context — the row is now
   published so anon sees it too). `expect` an `article-card` whose headline/`data-slug` matches the
   throwaway → present. (During this window there are 3 published; the assertion is presence, not count.)
8. **Renders on its page with the EDITED body:** `/news/[slug]` → `expect(article-headline)` = marker
   title; `expect(article-body)` **contains the edited body marker** (proves the body edit persisted +
   rendered, React-escaped).
9. `afterAll` targeted-deletes the throwaway → feed back to exactly **2** published.

**Out-of-band empirical checks (the slice-05 way, §1.4):**
- **dcon-style row read** (admin client): the throwaway row is `status='published'`, **`published_at` is
  NOT NULL**, and `body` equals the **edited** marker string — confirming the *right data* was written,
  not merely that a chip rendered.
- **Editor publish works** (probe 1) and **anon read composition intact** (probe 6): a fresh anon SELECT
  sees the newly-published row by slug, and still sees ONLY published rows overall.
- **Contributor still CANNOT publish** (probe 5, re-run with a real contributor JWT): UPDATE own
  `in_review → published` → `42501`, status unchanged — proving `0004` did not weaken the barrier
  (`init-e2e-004`, slice 07, remains a genuine negative).

Respect the auto-retry-`expect` gotcha; real Supabase (never mock); targeted cleanup only. `tsc --noEmit`
+ `eslint` clean; run the full suite yourself from a clean `.next`; drive a real browser end-to-end;
screenshot the "Published" chip + the live `/news` card.

---

## 8. Smallest-slice check — **this is one slice; ship it whole (do not split)**

Weigh against slice 05, which *was* split (05a foundation / 05b CRUD) because it introduced the entire
RBAC substrate (new table + trigger + `SECURITY DEFINER` fn + 4 policies + 2 seed paths) — a large,
high-risk, mostly-invisible increment. Slice 06 is **materially smaller and lands on that proven
foundation**: 2 additive RLS policies, 2 typed mutators + 1 read, 1 Server Action, 1 new route + 1 client
island, and a role-aware branch on two existing pages. The observable behavior maps to a **single**
scenario's When/Then (edit body → publish → live on `/news`), and the highest-risk part (the editor RLS
+ its non-weakening of the contributor barrier) is **provable out of band before the UI is built**
(§1.4) — the same de-risking 05a did, but small enough not to warrant a separate shippable increment.
**Recommendation: build slice 06 as one slice**, proving `0004` empirically (probes 1–6, especially the
anti-tautology probe 5) **before** wiring the review UI. The orchestrator decides; if it prefers a gate,
the natural cut is "apply + prove `0004` (probes green)" **before** "build the review view" — a checkpoint,
not a separate slice.

---

## 9. Prototype debt (recorded for `/actualize`)

- **Real image upload (MediaAsset)** still deferred — hero remains a `public/seed/*.png` path/URL; the
  editor does not touch the hero this slice.
- **Unpublish UI is slice 08.** `articles_editor_update`'s WITH CHECK already **permits**
  `published → unpublished` (proven by probe 2), but no unpublish control/action is built now.
- **Editor edit is body-only.** `publishArticle`/`saveArticleAsEditor` touch `body` only; editing an
  article's `title` / `category` / `slug` / `hero` as an editor is deferred (slug edits also reopen the
  unresolved slug-collision strategy). The scenario edits only the body.
- **Editor Save-without-publish** (`saveArticleAsEditor`) is sketched but the UI wire-up is optional this
  slice (§2.2) — the review view ships Publish only, to keep one submit island / one error testid.
- **Role hierarchy still flat.** `editor` is explicit `role = any(roles)` membership; `super_admin` is
  not a superset. A hierarchy is a separate, separately-verified concept.
- **The editor review queue shows only `in_review`.** A full editorial dashboard (all statuses, filters,
  authorship columns, published/unpublished management) is later.
- **Editor UPDATE `WITH CHECK` pins only the editor role** — it does NOT pin `source` / `author_id`
  unchanged, so provenance/authorship are **editor-mutable at the DB** (an editor's session client could
  set `source='ai'` or reassign `author_id` on any row). This does not weaken the contributor barrier and
  is within §Authz "edit any Article," but it is unpinned. Pinning "unchanged" is impossible in an RLS
  `WITH CHECK` (it cannot reference the OLD row) — it needs a `BEFORE UPDATE` trigger; **deferred to
  `/actualize`**. **Mitigation today:** the app's `publishArticle` / `saveArticleAsEditor` patch only
  `body` / `status` / `published_at`, never `source` / `author_id` (verified by §1.4 probe 7).
- **`publishArticle` sets `published_at = now()` unconditionally** — it is **not idempotent on
  `published_at`**. Re-publishing an already-`published` row rewrites the timestamp and reorders the feed.
  Out of scope this slice (the path is `in_review → published`); flagged for `/actualize` (a re-publish
  guard, e.g. only set `published_at` when it is currently NULL).
- **No optimistic-concurrency / version guard** on `publishArticle` — two editors racing the same row,
  last-write-wins; acceptable for the prototype, flagged for `/actualize`.
- **Nothing shippable from Conceptualize** — slice 06 still owes `/actualize` (debt audit, backfilled
  tests, dcon on the `Then` data, red-team of the new editor RLS + Server Action, CI) before ship.

---

## 10. Entities check (`docs/entities.md`)

The **Article lifecycle now reaches `published`** (with a non-null `published_at`) via **editor**
authorization enforced at the database; the §Authz **Editor** capability ("transition any Article to
`published`/`unpublished`; edit any Article") is realized in `0004`'s `articles_editor_update` /
`articles_editor_read_all` policies. A dated, *proposed* changelog line is warranted and has been added
to `docs/entities.md` Appendix A (entity bodies unchanged; ratify in `/plan`):

```
- 2026-07-30 — Editor publish realized (slice 06 conceptualize; ratify in /plan). §Authz "Editor" is
  enforced at the DATABASE: migration 0004 adds two permissive RLS policies on public.articles for
  authenticated, each gated by has_role(auth.uid(),'editor') — SELECT-any (the editor-wide review queue
  sees every row; anon stays published-only, contributor own-read unchanged) and UPDATE-any (edit the
  body + transition status). The Article lifecycle now reaches published with published_at set (the
  Server Action writes published_at=now(); the 0001 CHECK published ⇒ published_at is the backstop), and
  the policy also permits published → unpublished (forward-correct for slice 08). Permissive OR-
  composition leaves the contributor "cannot publish" barrier intact (a contributor passes NEITHER
  UPDATE WITH CHECK when targeting published), so init-e2e-004 stays a genuine negative. No entity was
  added or renamed. Proposed — softball/init conceptualize; ratify in /plan.
```
