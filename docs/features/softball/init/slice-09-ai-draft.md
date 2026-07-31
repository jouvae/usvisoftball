# Slice 09 — AI draft, generated for review and never auto-published (`init-e2e-007`)

> **Phase:** Conceptualize (Phase 2). **Type:** contract/sketch — **no implementation or test code here.**
> **This is the LAST scenario of `softball/init`.**
>
> **Scenario (sole scope):**
> > **Given** a signed-in `contributor`/`editor` on the AI draft panel with an owned/licensed source selected
> > **When** they request an AI draft and then accept the generated result
> > **Then** an article is created with `source=ai` and `status=draft` (**never** `published`), with stored
> > `ai_provenance` (source + model); it enters the normal review workflow and appears only in the editorial
> > queue, **not** the public feed.
>
> **The testable heart is the SAFETY PROPERTY:** AI content NEVER auto-publishes; provenance is stored;
> human review is mandatory. That property must be true **at the database**, not merely in the UI.
>
> **Read-first (binding):** `DESIGN.md` (root) · `slice-05-contributor-draft.md` (the contributor RLS +
> injectable-write-path foundation this extends) · `supabase/migrations/{0001,0003,0004}_*.sql` (the live
> `articles` schema, grants, CHECKs, and the contributor + editor RLS this composes with) · `docs/entities.md`
> §Content/Editorial (Article `ai_provenance`, **AiDraftJob**) · `information-architecture.md` (⭐ the AI draft
> panel) · `scenarios.md` (`init-e2e-007`) · `status.md` (shared-DB `workers:1`; the recorded gotchas).
>
> **L-init-01:** standalone **Next.js 16.2.10** + React 19 + Tailwind v4 (CSS-first) + Supabase. **NO** Go,
> gRPC, proto, Dorothy, `gormClient`, `useApis`/`serverApiClient`, shadcn, or `src/`. `app/` is at repo root.
> Read the bundled `node_modules/next/dist/docs/` before any API.

---

## 0. Human decisions (LOCKED for this slice)

1. **Generation = a DETERMINISTIC STUB drafter, not a live model.** Build the whole workflow with an in-app
   deterministic generator standing in for the model call. The real Claude call is a **clean swap-in behind
   ONE interface** — the single piece of prototype debt this slice deliberately incurs. Provenance
   `model = 'stub'`; provenance `source` = the selected source. **No API key. No `@anthropic-ai` SDK. No
   network.** (Confirmed absent from `package.json` — do not add either.)
2. **Owned/licensed sources = a labelled PLACEHOLDER list.** The Federation still owes the real
   owned/licensed source list (`status.md` Open loops; `information-architecture.md` §TBD). A small fixed set
   of placeholder options is fine for the prototype — recorded as debt.

---

## 1. Grounding (every framework / Supabase / Postgres claim cited to an installed source)

| Claim | Source (installed) |
|---|---|
| A Server Action is a `'use server'` function invoked via `<form action>`; it "runs as a POST request … reachable to anyone who can send the same POST. Treat every action as an untrusted entry point." Authenticate + authorize + validate inputs **inside** each action. | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (§Security) |
| Send a **reference (id) + the change**; a well-formed object "can still refer to a row the caller does not own" — re-verify from a trusted source using the session. | `.../server-actions.md` (§Security, "passing data") |
| `revalidatePath` before `redirect`; `redirect` **throws** `NEXT_REDIRECT` (303 from an action) so code after it does not run — call it **outside** any try/catch. | `.../server-actions.md`; `.../03-api-reference/04-functions/redirect.md`; `.../revalidatePath.md` |
| **Verify auth inside each Server Action** — a layout guard is not sufficient because "Next.js applications have multiple entry points, which will not prevent nested route segments and **Server Actions** from being accessed." | `node_modules/next/dist/docs/01-app/02-guides/authentication.md` |
| `params` is async in dynamic routes (`const { id } = await params`); sole-`<main>` rule; `data-testid` mandatory; `PageProps<'/route'>` ambient helper. | `DESIGN.md` §"Next.js 16 breaking changes", §"Component authoring conventions" |
| The cookie-backed, RLS-enforced **session** client (anon/publishable key, runs AS the end user) is the assertion-path client; the admin client is service-role/RLS-bypassing (seed only). | `lib/supabase/server.ts`; `lib/supabase/admin.ts` |
| `createArticle()` is the ONE typed write path, **client-injectable** (defaults to admin; the contributor path passes the SESSION client so RLS enforces). Maps camelCase→snake_case; `.select('*').single()` re-read. | `lib/articles.ts` L185-211 |
| `has_role(uid, role)` is the `SECURITY DEFINER` helper the policies gate on; `authenticated` already holds `INSERT, UPDATE` on `articles` (0003); permissive policies are **OR-combined**. | `supabase/migrations/0003_profiles_and_authorship.sql` L55-70, L139; `0004_editor_policies.sql` (§comments) |
| The slice-05 `articles_contributor_insert` WITH CHECK **pins `source = 'human'`** — an `source='ai'` insert is REJECTED by it (confirmed by reading the live policy, below). | `supabase/migrations/0003_profiles_and_authorship.sql` L144-154 |
| Determinism is a repo discipline: `lib/format.ts` is "deterministic by construction … CI and local agree exactly"; a bare `count()` races render (auto-retry `expect`); shared DB ⇒ `workers:1`. | `lib/format.ts` L1-8, L32-41; `status.md` (Gotchas) |

> **The load-bearing fact, read from the live policy** (`0003` L144-154): `articles_contributor_insert`'s
> WITH CHECK is `author_id = auth.uid() AND has_role(auth.uid(),'contributor') AND status in
> ('draft','in_review') AND source = 'human'`. Because it pins `source = 'human'`, a `source = 'ai'` INSERT
> **does not pass it**. So AI drafts need a **SEPARATE, additive** INSERT policy — they cannot ride the
> contributor policy, and the contributor policy is **not loosened** (that would silently weaken
> `init-e2e-004`). This separation is the whole reason `0005` adds a new policy rather than editing `0003`.

> **⚠️ Grounding gap surfaced honestly (verify-by-observing).** As in slices 02/03/05, there is **no
> Supabase RLS guidance bundled in `node_modules/@supabase/*`**. The RLS-composition and never-autopublish
> claims below are grounded in **Postgres semantics** (multiple *permissive* policies for a command are
> **OR-combined**; a row must satisfy **≥1** permissive WITH CHECK to be inserted) and in the **empirical
> probes** slices 02/03/05/06 established. Structural existence of a policy proves nothing — the implementer
> MUST prove §1.7 / §6 probes out of band before trusting it.

---

## 2. Migration `0005_ai_provenance.sql` (the contract)

Additive and replayable — the 0001/0003/0004 discipline (`add column if not exists`, drop-then-add for the
CHECK/policy, applied out of band with `psql "$SUPABASE_DB_URL" -f …`, **never** from app code: API keys
reach PostgREST, DDL is not exposed over HTTP — `status.md`). The SQL below is the **contract**; the actual
file is written/applied during build, not in this sketch.

### 2.1 The column — realizes Article `ai_provenance`

```sql
-- Article.ai_provenance (docs/entities.md §Content/Editorial): "sources + model, when source=ai",
-- and the AiDraftJob "ai_provenance (sources + model), stored as an audit trail". Realized as a
-- NULLABLE jsonb — nullable because EVERY existing row (and every human draft) has source='human'
-- and carries no provenance. Shape written by the app: { "source": <selected source>, "model": "stub" }.
alter table public.articles
    add column if not exists ai_provenance jsonb;
```

### 2.2 The CHECK — an AI article MUST carry provenance (decided: **YES, add it**)

```sql
-- "AI article ⇒ has provenance" is the scenario's own invariant ("with stored ai_provenance"). Enforce
-- it at the DB so the property cannot drift no matter which write path runs. Replayable: drop-then-add
-- (ADD CONSTRAINT ... IF NOT EXISTS is unsupported for CHECK — the exact idiom 0001 uses for
-- articles_published_requires_published_at). Safe on existing data: every current row is source='human',
-- so `source <> 'ai'` is TRUE and the row passes regardless of provenance.
alter table public.articles
    drop constraint if exists articles_ai_requires_provenance;
alter table public.articles
    add constraint articles_ai_requires_provenance
    check (source <> 'ai' or ai_provenance is not null);
```

**Justification (and why it stays replayable):** the CHECK is a *table-wide* backstop that holds for **every**
writer (session client, admin/seed client, a future second write path) — strictly stronger than relying on
the RLS WITH CHECK alone (RLS is bypassed by the service role; the table CHECK is not). It is additive and
idempotent, so a second `psql` run does not error. It does **not** constrain human rows at all (the
`source <> 'ai'` short-circuit), so nothing in slices 01–08 regresses.

### 2.3 The load-bearing RLS piece — a NEW, SEPARATE INSERT policy

```sql
-- articles_ai_draft_insert — a FOURTH permissive INSERT-relevant policy, ADDITIVE to (and NOT a
-- loosening of) the slice-05 articles_contributor_insert. Permissive policies are OR-combined, so an
-- INSERT succeeds iff it satisfies AT LEAST ONE policy's WITH CHECK:
--   * articles_contributor_insert (0003): author_id=self AND contributor AND status in
--       (draft,in_review) AND source='human'
--   * articles_ai_draft_insert   (this): author_id=self AND status='draft' AND source='ai'
--       AND ai_provenance IS NOT NULL AND (contributor OR editor)
-- The two are DISJOINT on `source`: each pins its own provenance. An AI insert takes THIS policy; a
-- human insert takes the contributor policy. Neither can reach the other's shape.
--
-- ⭐ status='draft' in THIS WITH CHECK is what guarantees "never auto-published". An AI insert cannot
--    name status='published' (or 'in_review'/'unpublished') and still pass any policy:
--      - articles_ai_draft_insert requires status='draft'  → published/in_review/unpublished FAIL here
--      - articles_contributor_insert requires source='human' → an ai row FAILS there
--      - articles_editor_update (0004) is UPDATE-only → irrelevant to INSERT
--    ⇒ the DB itself makes it IMPOSSIBLE to INSERT an ai row at any status other than 'draft'.
drop policy if exists articles_ai_draft_insert on public.articles;
create policy articles_ai_draft_insert
  on public.articles
  for insert
  to authenticated
  with check (
        author_id = auth.uid()
    and status = 'draft'
    and source = 'ai'
    and ai_provenance is not null
    and (
          public.has_role(auth.uid(), 'contributor')
       or public.has_role(auth.uid(), 'editor')
    )
  );
```

**Grants — confirm NO change.** `authenticated` already holds `INSERT, UPDATE` on `public.articles` (0003
L139) and `SELECT` (0001). The AI path is INSERT (+ the existing own-read/editor-read SELECT for the
returning re-read). So **no grant statement is added**. `anon` stays SELECT-only (published-read unchanged →
slices 02/03 cannot regress). No DELETE. State this explicitly in the migration header, as 0004 does.

**Read/queue reuse — no new SELECT policy.** The created AI draft is read back and listed via the EXISTING
policies: `articles_contributor_read_own` (0003, `author_id = auth.uid()`) covers the creator's own-read and
their `/admin/queue`; `articles_editor_read_all` (0004) covers an editor. The `.select('*').single()`
re-read after the insert passes own-read (author_id = self). Nothing new is required here.

### 2.4 Composition check (must hold; the whole point)

- **A contributor/editor CAN INSERT** an `ai` / `draft` / `ai_provenance` row where `author_id = self` →
  passes `articles_ai_draft_insert`. ✅
- **NOBODY can INSERT** an `ai` / `published` row → fails `articles_ai_draft_insert` (needs `draft`) **and**
  `articles_contributor_insert` (needs `human`). ✅ *(the safety property, at the DB)*
- **A contributor STILL cannot publish** a human row (`init-e2e-004` stays a genuine negative — `0005` adds
  only an AI-`draft` INSERT capability, touches no UPDATE policy). ✅
- **`anon` is unaffected** (policy is `to authenticated`; anon has no INSERT grant). ✅
- **A role-less authenticated user cannot INSERT** an AI draft (neither `has_role` is true). ✅

### 2.5 Empirical probes (out of band — the slice-02/03/05/06 way; structural existence proves nothing)

Run against the live REST API with **real session JWTs** (`signInWithPassword`), never a minted/forged token:

1. **contributor** (or editor) session INSERT `{ source:'ai', status:'draft', ai_provenance:{…}, author_id:self }` → **succeeds**; row visible to that user, **invisible to anon** by slug.
2. same session INSERT `{ source:'ai', status:'published', ai_provenance:{…}, author_id:self }` → **rejected** (`42501` RLS). *(the never-autopublish probe — this is the safety property, empirically)*
3. INSERT `{ source:'ai', status:'draft', ai_provenance: NULL }` → **rejected** (RLS WITH CHECK **and** the `articles_ai_requires_provenance` table CHECK — two independent barriers).
4. INSERT `{ source:'ai', status:'draft', author_id:<other> }` → **rejected** (author_id ≠ self).
5. **role-less** authenticated INSERT `{ source:'ai', status:'draft', … }` → **rejected**.
6. **anon** INSERT `{ source:'ai', status:'draft', … }` → **rejected** (401 / no grant).
7. contributor INSERT own `{ source:'human', status:'draft' }` (the slice-05 path) → **still succeeds** (unregressed).
8. **anon** SELECT the new ai/draft row by slug → **`[]`** (still published-only).

Probe 2 is the empirical proof of the whole slice: the DB **refuses** to store an AI row at `published`.

---

## 3. The deterministic stub drafter — `lib/ai-draft.ts` (server-only)

The ONE swap-in seam for the real model call. A pure, deterministic module.

```ts
import "server-only"; // never reaches a Client Component
import type { AiProvenance } from "@/lib/articles";

export interface GenerateDraftInput { source: string; prompt: string; }
export interface GeneratedDraft { title: string; body: string; aiProvenance: AiProvenance; }

// generateDraft — the deterministic STUB drafter (slice-09 §3). Same (source, prompt) ⇒ byte-for-byte
// the same { title, body, aiProvenance }. Title/body are DERIVED from source+prompt (string composition),
// with ZERO randomness. This is deliberate: Math.random / Date.now / new Date() are fine in ordinary app
// code, but they make an e2e non-deterministic (status.md: "CI and local agree exactly" is the bar), and
// determinism is ALSO the property that lets the Accept action RE-DERIVE the persisted content
// server-side (§5) rather than trust client-submitted body — a well-formed POST is untrusted
// (server-actions.md §Security).
//
// model:'stub' is the provenance marker. ⭐ THE SWAP-IN SEAM: the real version keeps this exact
// signature, calls `claude-*`, and sets `model` to the real model id (e.g. 'claude-sonnet-4-…'). No other
// call site changes. No network, no API key, no @anthropic-ai SDK in the prototype.
export function generateDraft({ source, prompt }: GenerateDraftInput): GeneratedDraft { /* pure */ }
```

**Determinism note (do NOT regress):** the body/title must be a **pure function of the inputs** — e.g.
compose the title from the prompt and a fixed template, the body from source+prompt with fixed connective
prose. No timestamps, no counters, no randomness. This is what makes the e2e assertion on the reviewed draft
and the persisted row stable across runs and CI.

**⭐ MINOR-1 — the generated `title` MUST embed the caller's `prompt` VERBATIM.** The e2e sets the prompt to
a unique `[e2e-007] …` marker, then (a) filters `/admin/queue` by `hasText: marker` and (b) tears down via a
title contains-match. So `generateDraft` must splice the **exact prompt string into the generated `title`**
(e.g. `` `Federation report: ${prompt}` ``), not only into the `body` — otherwise the queue-item filter and
the `draft-editor` title never see the marker and the teardown cannot find the row. The marker lands
**mid-title**, so every consumer uses a **contains-match**, never a prefix match (see §6, §7).

---

## 4. Types + the write path — `lib/articles.ts` (extend; do not fork)

The single typed write path is reused verbatim — only the shape widens.

```ts
// New provenance type (jsonb shape). Small + fixed for the prototype (source + model). If the real
// AiDraftJob later carries multiple sources, widen `source` to `sources: string[]` then (debt §7).
export interface AiProvenance { source: string; model: string; }

// Article gains (mapped from ai_provenance):
//   aiProvenance: AiProvenance | null;   // null for every human/pre-AI row
// CreateArticleInput gains:
//   aiProvenance?: AiProvenance | null;  // → ai_provenance; omitted defaults to null at the DB
// ArticleRow gains:   ai_provenance: AiProvenance | null;
// ARTICLE_COLUMNS gains ", ai_provenance"  (the FULL-row column set — used by getArticleById /
//   getPublishedArticleBySlug / the queue reads). LIST_COLUMNS (the feed) is UNCHANGED — the feed
//   payload stays minimal and never ships provenance.
// toArticle(): aiProvenance: row.ai_provenance ?? null
// createArticle() insert object gains:  ai_provenance: input.aiProvenance ?? null
```

`createArticle` stays **client-injectable** (default admin for the seed; the **session** client on the AI
Accept path so RLS `articles_ai_draft_insert` enforces). **No new mutator is needed** — an AI draft is a
plain `createArticle({ …, source:'ai', status:'draft', aiProvenance }, sessionClient)`.

> **NIT-1 — always send an OBJECT, never JSON `null`.** Both the RLS WITH CHECK (`ai_provenance is not
> null`) and the table CHECK treat a jsonb **JSON-`null`** (`'null'::jsonb`) as **non-null** — a JSON-null
> value would *pass* the `IS NOT NULL` guards yet carry no provenance. So the AI write path must always send
> a real object `{ source, model }`, never SQL `NULL` and never JSON `null`. (Human rows send SQL `NULL`,
> which the `source <> 'ai'` short-circuit exempts.)

> **Note on ARTICLE_COLUMNS + the public read:** adding `ai_provenance` to `ARTICLE_COLUMNS` means the public
> by-slug read (`getPublishedArticleBySlug`, anon client) *selects* it — anon holds whole-table SELECT
> (0001), so this is grant-safe and RLS still gates rows. The **public article page does NOT render it**
> this slice. Whether a published AI article should carry a public "AI-assisted" disclosure is a product
> decision, deferred (§7).

---

## 5. The AI draft panel + Server Actions

### 5.1 Route + files

| Path | New/Mod | Server/Client | Responsibility |
|---|---|---|---|
| `app/admin/(protected)/news/ai/page.tsx` | NEW | Server | renders `<section data-testid="ai-draft-panel">` wrapping the client island; no data read (the panel starts idle). Roots at `<section>` inside the layout's sole `<main>`. |
| `app/admin/(protected)/news/ai/actions.ts` | NEW | Server (`'use server'`) | `generateAiDraft` (returns a draft to review; **does NOT persist**) + `acceptAiDraft` (persists via §4 → redirect) |
| `components/client/ai-draft-panel.tsx` | NEW | Client (`'use client'`) | the state machine: idle → generating → generated → (accept \| discard) |
| `app/admin/(protected)/articles/[id]/page.tsx` | MOD | Server | render a NEW `draft-provenance` block when `article.aiProvenance != null` (source + model). Preserves existing `draft-source` / `draft-editor` / `draft-status-badge` testids. |
| `app/admin/(protected)/page.tsx` | MOD | Server | add an **AI draft** nav link (`admin-ai-draft-link` → `/admin/news/ai`) for contributor **or** editor. Preserves all existing dashboard/nav testids. |
| `lib/roles.ts` | MOD | Server-only | add `requireEditorialRole()` (contributor **or** editor; else `redirect('/admin')`) — the panel is for both roles. |

> **Route-family note (observed, honest):** the built admin routes are `/admin/articles/*`, `/admin/queue`,
> `/admin/review/*`, whereas **`information-architecture.md` line 34** names the panel `/admin/news/ai`
> (this slice implements **`init-e2e-007`**, `scenarios.md` L61-67). This slice follows the IA name
> (`/admin/news/ai`), which is covered by the `proxy.ts` `/admin/:path*`
> matcher and the `(protected)` layout guard exactly like every other admin route. There is no
> `/admin/news` index page — a segment is only a route once it has a `page.tsx`
> (`DESIGN.md` §Directory structure), so `/admin/news/ai` stands alone. The `/admin/news` vs
> `/admin/articles` family inconsistency is pre-existing and out of scope; noted for `/actualize`.

### 5.2 `requireEditorialRole()` (lib/roles.ts)

```ts
// The panel is for contributor OR editor. Mirrors requireRole (requireUser() → redirect anon; read the
// profile through the RLS session client; confirm ACTIVE membership), but accepts EITHER editorial role.
// A missing/disabled/role-less profile redirects to /admin — render-time gating is never the only
// boundary (RLS re-enforces at the row), but the action must not proceed without an editorial role.
export async function requireEditorialRole(): Promise<{ user: User; profile: Profile }> { /* … */ }
```

### 5.3 `generateAiDraft` (Server Action — review only, NO persistence)

```ts
export type GenerateAiDraftState =
  | { ok: true; source: string; prompt: string; title: string; body: string; aiProvenance: AiProvenance }
  | { ok: false; error: string }
  | undefined;
```

1. `await requireEditorialRole()` — a Server Action is its own untrusted entry point (auth.md); authorize
   **inside** it, do not lean on the layout/nav gate.
2. Read + validate `source`, `prompt` from `FormData` (untrusted). `source` MUST be one of the placeholder
   allow-list (reject anything else → `{ ok:false, error }`); `prompt` non-empty.
3. `const draft = generateDraft({ source, prompt })` (§3) — pure, in-process, no persistence.
4. Return `{ ok:true, source, prompt, title: draft.title, body: draft.body, aiProvenance: draft.aiProvenance }`.
   The island renders this for human review. **Nothing is written to the DB in this action.**

### 5.4 `acceptAiDraft` (Server Action — persists via the session/RLS client, then redirects)

```ts
export type AcceptAiDraftState = { error: string } | undefined;
```

1. `const { user } = await requireEditorialRole()`.
2. Read `source`, `prompt` from `FormData` (re-submitted as hidden fields by the island — the reviewed
   `title`/`body` are shown to the human but are **NOT trusted from the client**).
3. **Re-derive** `const draft = generateDraft({ source, prompt })` server-side. Because `generateDraft` is
   deterministic, this reproduces exactly what the human reviewed — and guarantees the persisted content is
   **server-derived, not client-forgeable** (server-actions.md §Security: a well-formed POST can carry
   anything). Validate `source` against the allow-list again.
4. `const slug = slugify(draft.title)` (`lib/format.ts`).
5. `const supabase = await createSupabaseServerClient()`; then through the **SESSION** client (RLS
   `articles_ai_draft_insert` enforces — never the admin client on the assertion path):
   ```ts
   const created = await createArticle({
     title: draft.title, slug, body: draft.body,
     excerpt: null, coverImageUrl: null, coverImageAlt: null,
     authorName: user email/name byline,           // author_name is NOT NULL (0001) — same byline chain as slice-05
     authorId: user.id,
     category: <from prompt/source or a fixed placeholder>,
     status: "draft", source: "ai",
     aiProvenance: draft.aiProvenance,              // { source, model:'stub' }
   }, supabase);
   ```
   Wrap in try/catch: a duplicate slug (`23505`) or an RLS denial returns `{ error: 'Could not save this
   draft…' }` (never an unhandled throw) — the slug-collision debt from slice-05 §8 applies.
6. `revalidatePath('/admin/queue')` — **before** the redirect. **NOT** `/news` (a draft publishes nothing).
7. `redirect('/admin/articles/' + created.id)` — **outside** any try/catch (throws `NEXT_REDIRECT`; 303 ⇒
   the browser GETs the draft editor, where `draft-source` shows `ai` and the new `draft-provenance` shows
   source + model). The AI draft now enters the **normal review workflow** exactly like a human draft.

> **Byline chain:** `author_name` is NOT NULL (0001). Derive it from the profile name / account email as
> `createDraft` does (slice-05 §2.2 step 3) so the AI draft carries a real byline.

### 5.5 The client island — `ai-draft-panel.tsx` (state machine)

`idle → generating → generated → (accept | discard)`. Concrete wiring:

- Two `<form>`s / one island. Generate uses `useActionState(generateAiDraft)` → `pending` is the
  **generating** state; a returned `{ ok:true, … }` is the **generated** state; `{ ok:false, error }`
  renders `ai-error`.
- **idle:** a `source` `<select>` (the placeholder allow-list options), a `prompt` field, and a **Generate**
  submit. No review area, no accept/discard.
- **generating:** Generate button shows a pending label (`disabled`).
- **generated:** render the **review area** (`ai-generated-draft`) showing the generated **title**
  (`ai-generated-title`), **body** (`ai-generated-body`, plain React-escaped — see below), and the
  **provenance** (`ai-provenance`, "Source: X · Model: stub"). Plus **Accept** and **Discard**.
- **Accept:** a `<form action={acceptAiDraft}>` carrying the `source` + `prompt` as **hidden inputs** (so
  the server re-derives; §5.4). On success the action redirects — no client success branch.
- **Discard:** a client-only reset (a `useState` "discarded" flag gating the review area, reset on the next
  Generate) — returns the panel to **idle** without touching the DB. No Server Action needed.
- **`dangerouslySetInnerHTML` is BANNED** on the generated body — it is untrusted (AI-authored) input; render
  as React-escaped text (the slice-03/05 rule; `docs/entities.md` 2026-07-10). Gold is NOT used (no CTA in
  the admin — navy-on-white primary buttons per `DESIGN.md`).

### 5.6 Provenance on the draft editor (the MOD)

`app/admin/(protected)/articles/[id]/page.tsx` currently renders `draft-source` ("Source: {source}"). **Add**
a sibling block rendered only when `article.aiProvenance != null`:

```
<div data-testid="draft-provenance">AI provenance — source: {aiProvenance.source} · model: {aiProvenance.model}</div>
```

This is what the scenario's Then ("stored `ai_provenance` (source + model)") asserts is **visible on the
article editor**. A human draft (`aiProvenance == null`) renders nothing extra — the existing testids are
untouched.

---

## 6. `data-testid` contract (hard — the e2e targets exactly these)

| `data-testid` | Element | Where |
|---|---|---|
| `admin-ai-draft-link` | dashboard nav link → `/admin/news/ai` (contributor **or** editor) | `app/admin/(protected)/page.tsx` |
| `ai-draft-panel` | `<section>` on the AI panel route | `news/ai/page.tsx` |
| `ai-source-select` | source `<select>` (placeholder options) | ai-draft-panel |
| `ai-prompt` | prompt `<input>`/`<textarea>` | ai-draft-panel |
| `ai-generate` | Generate submit `<button>` (calls `generateAiDraft`) | ai-draft-panel |
| `ai-error` | generate error (present only on failure) | ai-draft-panel |
| `ai-generated-draft` | review area (present only in the generated state) | ai-draft-panel |
| `ai-generated-title` | generated title display | ai-draft-panel |
| `ai-generated-body` | generated body display (React-escaped) | ai-draft-panel |
| `ai-provenance` | provenance display (source + model) in the review area | ai-draft-panel |
| `ai-accept` | Accept submit `<button>` (calls `acceptAiDraft`) | ai-draft-panel |
| `ai-discard` | Discard `<button>` (client reset → idle) | ai-draft-panel |
| `draft-provenance` | provenance block on the draft editor (present when `source=ai`) | `articles/[id]/page.tsx` (MOD) |

**Reused / asserted-against (NOT new):** `draft-editor`, `draft-source` (asserts `ai`), `draft-status-badge`
(asserts `draft`) on the editor; `queue-list` / `queue-item` / `queue-item-title` / `queue-item-status` on
`/admin/queue`; the feed's `news-feed` / `article-card` / `article-card-headline` on `/news` (the AI title
must be **absent**). Any new testid added during build MUST be added to this table (`DESIGN.md` §Component
authoring).

> **MINOR-1 (assertion contract):** because `generateDraft` splices the prompt into the `title`
> **mid-string** (§3), the queue-item assertion filters by a **contains-match** — `getByTestId('queue-item')
> .filter({ hasText: marker })` (Playwright `hasText` is already a substring match) — and the `draft-editor`
> title / `queue-item-title` are asserted with `toContainText(marker)`, never an exact/prefix match.

---

## 7. Verification plan for `init-e2e-007` (observe, never infer; real Supabase, never mock)

Precondition: `npm run seed`, `npm run seed:admin`, `npm run seed:contributor` have run; migration `0005`
applied + replayable. Playwright serial / `workers:1` (shared DB — do not "optimize" back, `status.md`).
Drive the **real** Supabase sign-in — Conceptualize forbids forged/minted sessions.

**Canonical actor = the seeded CONTRIBUTOR** (`roles=['contributor']`). The scenario says
"contributor/editor"; the contributor is the clean canonical actor because after Accept the draft editor
`/admin/articles/[id]` is the contributor's own surface (own-read RLS) and its Submit-for-review control is
contributor-gated. *(An editor may also use the panel; the created row is identical. But an editor landing on
`/admin/articles/[id]` sees a Submit-for-review control that is contributor-gated — the same pre-existing
semi-dead-control an editor gets opening any draft editor; out of scope, §8. Drive the e2e as a contributor.)*

**Happy path (the scenario):**
1. Sign in as `process.env.SEED_CONTRIBUTOR_EMAIL` / `…_PASSWORD` → `/admin`.
2. Click `admin-ai-draft-link` → `/admin/news/ai` (`ai-draft-panel` visible).
3. Select an owned/licensed **source** in `ai-source-select`; type a unique-marker **prompt** in `ai-prompt`;
   click `ai-generate`.
4. `expect(ai-generated-draft)` visible; `expect(ai-generated-title)`/`ai-generated-body` show derived
   content; `expect(ai-provenance)` shows the source + `stub` (auto-retrying `expect`, never a bare
   `count()` — the slice-02/03 gotcha).
5. Click `ai-accept` → lands on `/admin/articles/[id]` (`draft-editor`); `expect(draft-status-badge)`
   reads `draft`; `expect(draft-source)` contains `ai`; `expect(draft-provenance)` shows source + `stub`.
6. `page.goto('/admin/queue')`; `expect(getByTestId('queue-item').filter({ hasText: marker }))` present, its
   `queue-item-status` reads `draft`.
7. **Absent from the public feed:** in a **fresh anon context** (no `storageState`), `/news` →
   `expect(page.getByText(marker)).toHaveCount(0)`; and the draft's `/news/[slug]` → **HTTP 404** (RLS keeps
   non-published invisible to anon — the property slices 02/03 proved).

**Out of band (dcon-style — the RIGHT data, not just a green badge):** service-role read of the created row
asserts `source='ai'`, `status='draft'`, `ai_provenance` jsonb `= { "source": <selected>, "model": "stub" }`,
`author_id = <contributor's auth uid>`, `published_at IS NULL`.

**Never-autopublish probe (the safety property, out of band):** §2.5 probe 2 — a contributor/editor session
INSERT of an `ai` + `published` row is **rejected** by the WITH CHECK. This proves the property is real **at
the DB**, independent of any UI. Also run §2.5 probes 1, 3, 7, 8 (the AI insert succeeds; provenance-null is
rejected by BOTH barriers; the human path is unregressed; anon by-slug sees `[]`).

**Data lifecycle:** the created row is a `draft` (not published), so `/news` stays at exactly **2**
automatically — no feed cleanup needed. But drafts would accumulate in the queue across runs, so add a
targeted **`[e2e-007]`-marker teardown** so the queue/DB return to the seeded baseline. Because the marker is
spliced **mid-title** (§3, MINOR-1), the teardown is a **contains-match**, not a prefix match — a
marker-scoped delete via the sanctioned admin path, e.g. `admin.from('articles').delete().like('title',
'%[e2e-007]%')` (or `%<the run's unique marker>%`). Auto-retry `expect`; real Supabase; **never mock**.

---

## 8. Prototype debt (recorded for `/actualize`)

- **The stub drafter is the real-Claude swap-in seam** (§3). `lib/ai-draft.ts` `generateDraft` is
  deterministic and in-process; the real version keeps the signature, calls `claude-*`, sets `model` to the
  real id. No key / no `@anthropic-ai` SDK in the prototype. **This is the single deliberate piece of slice
  debt.**
- **Placeholder source list** (§0.2). The Federation still owes the real owned/licensed sources
  (`status.md` Open loops; `information-architecture.md` §TBD). The allow-list is a small fixed set.
- **No real MediaAsset.** The AI draft carries no hero image (`coverImageUrl:null`) — the upload pipeline is
  still unbuilt (slice 02/03/05 MediaAsset deferral).
- **AiDraftJob is realized MINIMALLY.** Provenance lives on the **Article** (`ai_provenance`) and mandatory
  human review = the `status=draft` + the normal review workflow. A full separate **`AiDraftJob` audit row**
  (`prompt/params`, `status`, `requested_by`, `result`→Article) is **deferred** — `docs/entities.md` models
  AiDraftJob as its own entity, so a future slice may add an `ai_draft_jobs` table; the Article-embedded
  provenance is the prototype's realization. **Decision for `/plan`:** whether AiDraftJob becomes its own
  table or stays folded into `Article.ai_provenance`.
- **Provenance shape is `{ source, model }`** (single source). The entity says "sources[]" (plural). Widen to
  `sources: string[]` when the real multi-source drafter lands.
- **No public AI disclosure.** `ai_provenance` is selected on the public read but not rendered; whether a
  published AI article should surface an "AI-assisted" disclosure is a product decision.
- **Editor-actor gaps** (§7) — two, both making the **contributor** the clean canonical e2e actor:
  (a) an editor accepting an AI draft lands on the contributor-gated `/admin/articles/[id]`, whose
  Submit-for-review is contributor-gated (pre-existing semi-dead control); and (b) **`listEditorialQueue`
  excludes `draft`**, so an editor accepting an AI draft would **not** see it in their own `/admin/queue`
  (only the contributor path, `listQueueArticles`, surfaces drafts). The scenario holds because the e2e is
  contributor-driven. Revisit if editors need a drafts view. Out of scope this slice.
- **Rich-text body still React-escaped**; `dangerouslySetInnerHTML` on DB-/AI-sourced content **stays
  banned**. **Slug collision** debt (23505 → form error) carries over from slice-05.
- **Editor UPDATE WITH CHECK still does not pin `source`/`author_id`** (slice-06 debt) — an editor *could*
  relabel an AI row's provenance via a raw UPDATE; the app path never does. A trigger-based OLD-row pin is
  the `/actualize` fix.
- **Nothing shippable from Conceptualize** — slice 09 still owes `/actualize` (debt audit, backfilled tests,
  dcon on the Then data, red-team of the new RLS + Server Actions, CI) before ship.

---

## 9. Entities check (`docs/entities.md`)

- **Article `ai_provenance` is REALIZED** — a nullable `jsonb` on `public.articles` (`{ source, model }`),
  with a table CHECK `source <> 'ai' OR ai_provenance IS NOT NULL` making it mandatory for AI rows.
- **AiDraftJob is PARTIALLY realized** — provenance is stored on the Article; **mandatory human review** =
  the `status=draft` insert (RLS-guaranteed never-autopublish) + the normal review workflow. A standalone
  `AiDraftJob` audit table is deferred (§8).

Add a dated, *proposed* changelog line to `docs/entities.md` Appendix A (entity bodies unchanged; ratify in
`/plan`):

```
- 2026-07-31 — AI draft realized (slice 09 conceptualize; ratify in /plan). Article.ai_provenance is
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
```

---

## 10. Smallest-slice check — **ORCHESTRATOR DECISION: build as ONE slice**

> **DECIDED (orchestrator, 2026-07-31): build slice 09 as a SINGLE slice, not 09a/09b.** The
> never-autopublish safety gate is the **§2.5 probe 2** set (a contributor/editor session cannot INSERT an
> `ai`+`published` row), which is **UI-independent** and runs during verification (§7) regardless of build
> ordering — so a separate 09a "prove-RLS-first" increment buys no additional safety here, and the pieces
> are smaller than slice 05. The `nextjs-qa-reviewer` **APPROVED WITH FIXES (no MAJORs)** and confirmed the
> never-autopublish property holds at the DB. The split analysis below is retained as rationale only.

This slice's highest-risk, least-visible part is the **never-autopublish RLS property** — exactly the kind of
thing slices 02 and 05a landed and *empirically proved out of band first*, before building UI on top. The
split framing (retained for the record):

- **09a — the safety property + write path, proven out of band (no new visible UI).** Migration `0005`
  (column + CHECK + `articles_ai_draft_insert`), the `lib/ai-draft.ts` stub, and the `lib/articles.ts`
  type/`createArticle`/`ARTICLE_COLUMNS` extension. **Exit gate:** §2.5 probes **1–8** green out of band —
  especially **probe 2** (a contributor/editor session CANNOT insert an `ai`+`published` row) and probe 3
  (provenance-null rejected by both barriers). This is the whole point of the scenario, nailed empirically
  before any panel exists. *(09a is not browser-visible on its own — that is acceptable here because the
  safety property is a DB property; the slice-02 precedent is "prove RLS out of band before building UI on
  it".)*
- **09b — the panel + accept flow on the proven foundation.** `requireEditorialRole`, the `/admin/news/ai`
  page + island + `generateAiDraft`/`acceptAiDraft` actions, the `draft-provenance` editor MOD, the nav
  link, and the full `init-e2e-007` e2e (§7) driven as a contributor.

**Resolution:** the orchestrator chose the **single slice** (see the decision banner above). The safety
probes (§2.5, especially probe 2) still run as the hard gate during §7 verification — they just do not need
their own increment, being UI-independent.
