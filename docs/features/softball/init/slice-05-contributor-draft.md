# Slice 05 — Contributor creates + submits a draft (`init-e2e-003`)

> **Phase:** Conceptualize (Phase 2). **Type:** contract/sketch — no implementation or test code here.
> **Scenario (sole scope):** a signed-in user with the `contributor` role creates an article
> (title, body, category, hero image), **saves** it, and **submits it for review**; it is stored as
> `source=human`, transitions `draft → in_review`, **appears in the editorial queue**, and is **NOT
> visible on the public feed**.
>
> **Explicitly OUT of scope (later slices):** the contributor-cannot-publish *UI/permission test*
> (`init-e2e-004`, slice 06) and the editor review/publish flow (`init-e2e-005`, slice 07). The RLS
> here is nonetheless **forward-correct**: a contributor is unable to reach `status=published` **by
> construction**, and editor-publish policies drop in cleanly on top later.
>
> **Read-first (binding):** `DESIGN.md` (root) · `slice-04-admin-auth.md` (the auth foundation this
> builds on) · `supabase/migrations/0001_articles.sql` + `0002_articles_gallery.sql` (the live
> `articles` schema, grants, RLS, CHECKs) · `docs/entities.md` §Identity/Access + §Authz schema.
> **L-init-01:** standalone Next.js 16.2.10 + Supabase; NO Go, gRPC, proto, Dorothy, `gormClient`,
> `useApis`/`serverApiClient`, shadcn, or `src/`. `app/` is at repo root.

---

## 0. Grounding (every framework / Supabase / Postgres claim cited to an installed source)

| Claim | Source (installed) |
|---|---|
| A Server Action is created with `'use server'` and invoked via `<form action>`; it "runs as a POST request against the page … reachable to anyone who can send the same POST. Treat every action as an untrusted entry point." | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` L20-22, L78 |
| Inside **every** action: **authenticate and authorize** ("Render-time gating … is not a security boundary, because requests can be sent without going through the UI"); **validate inputs** (treat `FormData` as untrusted); **constrain return values** | `.../server-actions.md` L87-91 |
| Send a **reference (id) + the change**, and re-read/verify ownership "from a trusted source using the session"; a well-formed object "can still refer to a row the caller does not own" | `.../server-actions.md` L113-138 |
| `revalidatePath` / `redirect` in an action ⇒ the response re-renders the current route in the **same roundtrip**; `redirect` **throws** a control-flow exception so "any code after it does not run … Place revalidation calls before `redirect`" | `.../server-actions.md` L43-49, L72; L145-150 |
| `revalidatePath` "can be called in Server Functions and Route Handlers … **cannot** be called in Client Components or Proxy"; updates the UI immediately if viewing the affected path | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` L10-16 |
| `redirect` in a Server Action serves a **303**; elsewhere **307**; must be called **outside** any `try/catch` (it throws `NEXT_REDIRECT`) | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` L11, L50-52 |
| **Verify auth inside each Server Action** — a layout guard / `return null` is not sufficient because "Next.js applications have multiple entry points, which will not prevent nested route segments and **Server Actions** from being accessed"; the doc's Server-Action example does a **role check** (`userRole !== 'admin'`) before proceeding | `node_modules/next/dist/docs/01-app/02-guides/authentication.md` L1446-1447, L1449-1469 |
| Security checks belong "as close as possible to your data source" (Data Access Layer); Proxy "should not be your only line of defense" | `.../authentication.md` L1119, L1129-1131 |
| The cookie-backed, RLS-enforced **session** client already exists (anon/publishable key, `getUser()`), and is the client that runs **as the end user**; the admin client is service-role/RLS-bypassing | `lib/supabase/server.ts`, `lib/auth.ts` `requireUser()`; `lib/supabase/admin.ts` |
| `createArticle()` is the single typed write path; it currently uses the **admin** client and maps camelCase→snake_case, `.select("*").single()` after insert | `lib/articles.ts` L180-203 |
| `params` is async in dynamic routes (`const { id } = await params`); sole-`<main>` rule; `data-testid` mandatory | `DESIGN.md` §"Next.js 16 breaking changes", §"Component authoring conventions" |

> **⚠️ Grounding gap surfaced honestly (verify-by-observing):** there is **no Supabase RLS / "SECURITY
> DEFINER" guidance bundled in `node_modules/@supabase/*`** (only READMEs/CHANGELOGs; the `postgrest-js`
> "security definer" hits are unrelated error-code strings). So the **recursion concern and the
> SECURITY DEFINER remedy below are grounded in Postgres semantics** (RLS is evaluated for the
> *current user*; a `SECURITY DEFINER` function runs as its **owner**, and on Supabase public-schema
> functions are owned by a `BYPASSRLS` role, so a `SELECT` inside the function does **not** re-trigger
> the queried table's policies). The phrase "how Supabase recommends it" cannot be cited from an
> installed file — the implementer MUST confirm the exact pattern against **live** Supabase docs and,
> more importantly, **prove it empirically** (§1 RLS probes) before trusting it. Structural existence
> of a policy proves nothing; slices 02/03 established this.

---

## 1. Migration `0003_profiles_and_authorship.sql` (the contract)

Additive and replayable — the slice-01/02/03 discipline (`create … if not exists`, drop-then-add for
CHECK/policies, applied out of band with `psql "$SUPABASE_DB_URL" -f …`, **never** from app code:
API keys reach PostgREST, DDL is not exposed over HTTP — see `status.md`). The SQL below is the
**contract**; the actual file is written/applied during build, not in this Conceptualize sketch.

### 1.1 `public.profiles` — realizes the **User** entity

```sql
-- profiles realizes docs/entities.md §Identity/Access "User" (roles[], name, status),
-- keyed 1:1 to Supabase Auth's auth.users. Role assignment is EXPLICIT (empty by
-- default) — there is no public self-signup, so a fresh account has no powers.
create table if not exists public.profiles (
    id          uuid        primary key references auth.users(id) on delete cascade,
    name        text,
    roles       text[]      not null default '{}',
    status      text        not null default 'active'
                    check (status in ('active','disabled')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Reuse the 0001 trigger fn to keep updated_at honest on UPDATE.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

*Why `roles text[]` (the locked decision), not a join table:* the role set is tiny, read on every
authorization check, and always fetched wholesale for a user — a join table adds a query we never run
otherwise. `text` + membership (`role = any(roles)`) maps cleanly to the same "CHECK over ENUM"
rationale 0001 already chose for `status`/`source`.

### 1.2 `public.has_role()` — the SECURITY DEFINER helper (reads `profiles` under FORCE RLS)

```sql
-- Used by the articles policies below. It MUST be SECURITY DEFINER, but NOT for a
-- recursion reason: profiles_self_read (§1.4) is `id = auth.uid()`, so the
-- articles→profiles path does NOT self-reference and does NOT raise 42P17. (Any
-- "infinite recursion" framing here is wrong — dropped.)
--
-- The REAL dependency: profiles is ENABLE + FORCE row security (§1.4). Under FORCE
-- RLS the table owner is ALSO subject to policies, so a plain `select … from
-- public.profiles` inside a policy — running as the calling anon/authenticated
-- role — would return ONLY that caller's own profile row and answer has_role(<some
-- OTHER uid>, …) as FALSE. SECURITY DEFINER runs the body as the function OWNER;
-- this migration is applied via `psql "$SUPABASE_DB_URL"`, so the owner is
-- `postgres`, which holds `rolbypassrls` (confirmed for postgres/service_role in
-- slice-02's changelog). BYPASSRLS is EXACTLY what lets the inner SELECT see the
-- target user's row regardless of FORCE RLS — that is the whole mechanism.
--
-- ⚠️ This correctness hinges on the DEFINER owner having BYPASSRLS. If the function
-- were (re)created by a non-bypassing role, has_role would return FALSE for
-- everyone and every contributor INSERT/UPDATE would be silently denied. §1.6
-- probe 3 is the empirical gate that proves the owner really bypasses (see §7 05a
-- EXIT GATE). STABLE = no writes, safe to call many times per statement; the pinned
-- empty search_path hardens against search-path hijack (objects schema-qualified).
create or replace function public.has_role(uid uuid, role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and role = any(p.roles)
  );
$$;

grant execute on function public.has_role(uuid, text) to anon, authenticated;
```

### 1.3 Trigger on `auth.users` — auto-create the profile row (empty roles)

```sql
-- Every new auth user gets exactly one profile with EMPTY roles. Role assignment
-- is a separate, explicit, service-role act (§4). SECURITY DEFINER because the
-- trigger fires in the auth schema and writes public.profiles. on conflict do
-- nothing keeps it replay/re-run safe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> **Backfill note (debt):** the seed admin from slice 04 was created **before** this trigger existed,
> so it has **no** profile row. The seed step (§4) provisions idempotently and **upserts** the profile
> for any pre-existing user, so a re-run heals it. Recorded in §8.

### 1.4 `profiles` RLS — self-read, no self-escalation

```sql
alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- Grants bound the reachable verbs; RLS bounds the rows. anon gets NOTHING
-- (profiles are not public). authenticated may SELECT, and may UPDATE ONLY the
-- `name` column — a COLUMN-level grant is what makes `roles`/`status`
-- non-user-writable at the privilege layer (a row policy's WITH CHECK sees only
-- the NEW row and cannot cheaply prove `roles` was unchanged; the column grant
-- makes escalation impossible before RLS is even consulted). service_role
-- (BYPASSRLS) still writes roles for seeding (§4).
revoke all on public.profiles from anon, authenticated;
grant select            on public.profiles to authenticated;
grant update (name)     on public.profiles to authenticated;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
```

*Self-UPDATE is not exercised by `init-e2e-003`* (contributors never edit their own profile in this
slice) but is included per the locked decision and is forward-correct. The `roles` no-escalation
guarantee rests on the **column grant**, verified empirically below — not on the row policy alone.

### 1.5 `articles.author_id` + the contributor write/update/read policies

```sql
-- Nullable FK so the existing seed rows and the admin seed path stay valid
-- (author_name remains the denormalized display byline from 0001). Backfill of
-- pre-auth rows is deferred (§8).
alter table public.articles
    add column if not exists author_id uuid references auth.users(id);
create index if not exists articles_author_id_idx on public.articles (author_id);

-- authenticated needs INSERT + UPDATE now (0001 left it SELECT-only). Grant EXACTLY
-- those; anon stays SELECT-only (published-read unchanged → slices 02/03 stay green).
grant insert, update on public.articles to authenticated;

-- INSERT: a contributor may create ONLY their own human draft/in_review row.
-- status ∈ (draft,in_review) + source='human' makes reaching 'published'
-- impossible by construction — the forward-correctness requirement.
drop policy if exists articles_contributor_insert on public.articles;
create policy articles_contributor_insert
  on public.articles for insert
  to authenticated
  with check (
        author_id = auth.uid()
    and public.has_role(auth.uid(), 'contributor')
    and status in ('draft','in_review')
    and source = 'human'
  );

-- UPDATE: a contributor may edit their OWN row while it is draft/in_review. USING
-- gates which rows are updatable at all (own + not yet past review); WITH CHECK
-- gates the RESULT row — it may still only be draft/in_review, so this is what
-- both PERMITS draft→in_review and FORBIDS →published/→unpublished. source is
-- pinned to 'human' so a contributor can't relabel provenance.
drop policy if exists articles_contributor_update on public.articles;
create policy articles_contributor_update
  on public.articles for update
  to authenticated
  using (
        author_id = auth.uid()
    and public.has_role(auth.uid(), 'contributor')
    and status in ('draft','in_review')
  )
  with check (
        author_id = auth.uid()
    and status in ('draft','in_review')
    and source = 'human'
  );

-- SELECT: contributor sees their OWN rows (for the editorial queue + the RETURNING
-- re-read after insert/update), IN ADDITION to the existing published-read. This
-- is a SECOND permissive policy — permissive policies are OR-combined — so
-- authenticated sees (published OR own) and anon still sees ONLY published (the
-- 0001 policy is `to anon, authenticated`; this one is `to authenticated`).
drop policy if exists articles_contributor_read_own on public.articles;
create policy articles_contributor_read_own
  on public.articles for select
  to authenticated
  using (author_id = auth.uid());
```

**Why each shape:**
- **No DELETE grant/policy** — a contributor cannot delete; default-deny stands.
- **No editor policies yet** — slice 07 adds an editor-wide SELECT (`has_role(uid,'editor')`) and an
  editor UPDATE that *may* set `published`/`unpublished`. They compose as additional permissive
  policies; nothing here blocks them. The contributor UPDATE's WITH CHECK is what keeps publish out of
  contributor reach *without* a permissive-then-tighten migration later.
- **`anon` published-only read is untouched** — no grant or policy on the 0001 anon path changes, so
  `init-web-001`/`init-web-002` cannot regress. This is asserted, not assumed (§6).

### 1.6 Verifying RLS **empirically** (out-of-band probes — the slice-02/03 way)

Structural checks only prove a policy *exists*. Probe the live REST API / a raw session JWT out of
band and assert behavior (mirrors slice-02 §"RLS proven empirically"):

1. **contributor session** (real JWT from `signInWithPassword`) INSERT `status='published'` → **rejected** (`42501` / "new row violates row-level security").
2. contributor INSERT `source='ai'` → **rejected**.
3. contributor INSERT own `status='draft', source='human', author_id=<self>` → **succeeds**; row visible to that contributor, invisible to anon.
4. contributor UPDATE own `draft → in_review` → **succeeds**.
5. contributor UPDATE own `in_review → published` → **rejected** (WITH CHECK) — status unchanged. *(This is the forward-correctness probe for `init-e2e-004`; the full UI test is slice 06.)*
6. contributor UPDATE a **different** contributor's row → **0 rows** (USING filters it out).
7. **anon** SELECT the new `in_review` row by slug → **`[]`** (still published-only).
8. contributor self-UPDATE of `roles` (attempt to add `editor`) → **rejected/denied** by the column grant (no `update(roles)` privilege).

---

## 2. Write paths — reconciling "one typed write path" with RLS

The contributor create/submit MUST execute through the **cookie session client as the contributor**
(`lib/supabase/server.ts` → anon key + their JWT) so **RLS genuinely enforces** — **never** the
service/admin client (which bypasses RLS and would defeat the whole point). The existing
`createArticle()` uses the admin client for seeding. Keep the single typed logic and make the client
**injectable**:

### 2.1 `lib/articles.ts` — client-injectable typed writes

```ts
// createArticle gains an optional client arg; defaults to admin (seed path
// unchanged). The contributor Server Action passes the SESSION client, so the
// SAME typed insert runs RLS-enforced as the contributor. The RETURNING re-read
// (.select().single()) passes the contributor own-read policy (author_id=self).
export async function createArticle(
  input: CreateArticleInput,
  supabase: SupabaseClient = createAdminClient(),
): Promise<Article> { /* existing body, now using the passed client + author_id */ }

// CreateArticleInput gains:  authorId?: string | null;   (mapped to author_id)
// NOTE: authorName stays REQUIRED on CreateArticleInput. articles.author_name is
// NOT NULL (0001 L35), so createDraft MUST supply a byline (§2.2 step 3) — omitting
// it fails the INSERT. author_name (denormalized display byline) and author_id (FK)
// are BOTH written; they are not redundant (0001's byline rationale still holds).

// New typed transition — the ONE submit mutator. Injected client => RLS-enforced.
// The status guard (.eq('status','draft')) is a convenience; RLS is the boundary.
// .single() throws PostgrestError code 'PGRST116' when 0 rows match (foreign id, or
// the row is not a draft) — the caller (submitForReview action) MUST catch that and
// return { error }, never let it throw unhandled (MINOR-7).
export async function submitArticleForReview(
  id: string,
  supabase: SupabaseClient,
): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update({ status: "in_review" })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) throw error; // PGRST116 on 0 rows — caught in the Server Action
  return toArticle(data as ArticleRow);
}

// Optional field-save for the editor screen's "Save" (own draft/in_review only):
export async function saveDraftFields(
  id: string,
  fields: Pick<CreateArticleInput,"title"|"body"|"category"|"coverImageUrl"|"coverImageAlt">,
  supabase: SupabaseClient,
): Promise<Article> { /* .update(mapped).eq('id',id).select('*').single() */ }
```

This preserves the single-typed-write-path spirit: seed and contributor share `createArticle`; the
transition/save are the only new typed mutators; nothing hand-writes SQL or rows.

### 2.2 Server Actions (`'use server'`) — auth + role checked **inside each action**

Because Server Actions are independently reachable POST endpoints (server-actions.md L78; auth.md
L1446-1449), each action **re-verifies** the session and the `contributor` role itself — it does
**not** lean on the `(protected)` layout guard.

**`app/admin/(protected)/articles/new/actions.ts` → `createDraft(prevState, formData)`**
1. `const { user, profile } = await requireRole('contributor')` — the DAL choke point:
   `requireUser()` (redirects if unauthenticated) + reads the caller's `profiles` row through the
   session/RLS client and confirms `contributor` membership. If not a contributor → return
   `{ error: 'Not permitted.' }` (auth.md L1463-1466 pattern).
2. Read + minimally validate `title`, `body`, `category`, `coverImageUrl`, `coverImageAlt` from
   `formData` (untrusted — server-actions.md L90). Derive `slug` from `title` (see §8 collision debt).
3. **Derive the byline (MAJOR-1):** `authorName = profile.name ?? user.email` — `articles.author_name`
   is NOT NULL (0001 L35), so this MUST be supplied or the INSERT fails. `const supabase = await
   createSupabaseServerClient()`; `createArticle({ …, authorName, status:'draft', source:'human',
   authorId:user.id, slug, coverImageUrl, coverImageAlt }, supabase)` — RLS-enforced as the contributor.
4. `revalidatePath('/admin/queue')` (queue must reflect the new draft) — **before** the redirect
   (server-actions.md L72).
5. `redirect('/admin/articles/' + created.id)` — **outside** any try/catch (throws `NEXT_REDIRECT`;
   303 from an action → browser GETs the editor). The `NEXT_REDIRECT` rule from slice 04 holds.

**`app/admin/(protected)/articles/[id]/actions.ts` → `submitForReview(id, prevState, formData)`**
(bound via `submitForReview.bind(null, id)` so the id is a server-closure reference, not a forgeable
field — server-actions.md L113-138; RLS re-verifies ownership regardless).
1. `requireRole('contributor')`.
2. `submitArticleForReview(id, await createSupabaseServerClient())` **inside try/catch** — RLS enforces
   ownership + forbids any status other than in_review. A foreign/non-draft id matches 0 rows, so
   `.single()` throws `PGRST116` (MINOR-7): catch it and `return { error: 'Could not submit this
   draft.' }` — never an unhandled throw. Re-throw anything that is not `PGRST116`.
3. On success: `revalidatePath('/admin/queue')` and `revalidatePath('/admin/articles/' + id)`.
4. Stay on the editor (or `redirect` back to the queue) — either way revalidation ships the fresh
   status in the same response (server-actions.md L43-49).

**`saveDraftFields`-backed `saveDraft(id, …)`** — same auth/role gate; updates own draft fields;
`revalidatePath('/admin/articles/'+id)`. (Optional polish; the scenario's critical path is
`createDraft` → `submitForReview`.)

> **`/news` is deliberately NOT revalidated here** — submitting to review publishes nothing, so the
> public feed does not change. `/news` refreshes only on publish (slice 07). `revalidatePath` cannot
> run in Proxy/Client anyway (revalidatePath.md L12).

---

## 3. Admin editorial UI (Server Components + minimal Client islands)

All protected pages render **inside the existing `<main data-testid="admin-main">`** provided by
`app/admin/(protected)/layout.tsx` — pages render `<section>`s, never a second `<main>` (sole-`<main>`
rule). DESIGN.md tokens throughout; gold stays scarce (no gold CTA in the admin — navy-on-white
primary buttons, status chips are navy-on-gold only where a "signal" is warranted).

| Path | New/Mod | Server/Client | Slice | Responsibility |
|---|---|---|---|---|
| `app/admin/(protected)/page.tsx` | MOD | Server | 05a | render the caller's `roles` (read from `profiles` via the session/RLS client) in a `data-testid="admin-roles"` indicator — a **non-navigating** proof of the profiles/has_role chain. **05b** adds role-gated nav links (New article / Editorial queue) once those routes exist. **MUST preserve the existing `admin-dashboard` + `admin-authenticated` testids** (`init-e2e-008` asserts them) — the role indicator is additive (MINOR-4). |
| `app/admin/(protected)/articles/new/page.tsx` | NEW | Server | 05b | renders the new-article form island in a `<section data-testid="admin-new-article">` |
| `app/admin/(protected)/articles/new/actions.ts` | NEW | Server (`'use server'`) | 05b | `createDraft` (§2.2) |
| `components/client/article-draft-form.tsx` | NEW | Client (`'use client'`) | 05b | `useActionState(createDraft)`; fields title/body/category/hero/**hero-alt**; submit = "Save draft" |
| `app/admin/(protected)/articles/[id]/page.tsx` | NEW | Server | 05b | draft editor: `const {id}=await params`; read the row via the **session** client (own-read RLS); render current fields, a **status badge**, a **source marker**, **Save**, and **Submit for review** |
| `app/admin/(protected)/articles/[id]/actions.ts` | NEW | Server (`'use server'`) | 05b | `saveDraft`, `submitForReview` (§2.2) |
| `components/client/submit-for-review-button.tsx` | NEW | Client | 05b | thin `<form action={submitForReview.bind(null,id)}>` island with `useActionState` pending/error |
| `app/admin/(protected)/queue/page.tsx` | NEW | Server | 05b | editorial queue: read own `in_review` + `draft` via the session client, list with a status badge per item |
| `components/ui/article-status-badge.tsx` | NEW | Server | 05b | presentational status chip (`draft` / `in_review`) — navy-on-gold for `in_review` (8.13:1), navy-on-surface for `draft` |
| `lib/roles.ts` (or extend `lib/auth.ts`) | NEW | Server-only | 05a | `requireRole(role)` DAL helper: `requireUser()` + read `profiles.roles` via the session client; the choke point actions call. Also `assignRoles` for the seed (§4). |

**Hero image (prototype):** there is **no upload pipeline** (MediaAsset is unbuilt — slice 02/03
debt). The form accepts a **path/URL text input** (or a `<select>` over the existing
`public/seed/*.png`) stored on `cover_image_url`, **plus a `draft-hero-alt` text input captured into
`cover_image_alt`** (MINOR-6 — a required alt avoids shipping a null-alt a11y regression on the hero
`<img>`; NOT deferred as debt). Real Storage upload is deferred (§8).

**Body:** plain `<textarea>`; rendered React-escaped exactly as slice 03 does.
**`dangerouslySetInnerHTML` stays banned** on DB-sourced body (stored-XSS — editor/AI input is
untrusted). Rich text is a later slice (§8).

---

## 4. Seeding a contributor (and completing the admin's role) — sanctioned paths only

Extend the slice-04 seed pattern. **Never** hand-write an `auth.users` or `profiles` row via raw SQL.

- **`lib/roles.ts` → `assignRoles({ userId, name?, roles })`** (server-only): **UPSERTs** the
  `public.profiles` row via the **service client** (`createAdminClient()`) — e.g.
  `.upsert({ id: userId, name, roles }, { onConflict: 'id' })`. It **must upsert, not bare UPDATE**
  (MINOR-5): the slice-04 admin was created **before** the §1.3 trigger, so it has **no** `profiles`
  row — a bare UPDATE would heal 0 rows and silently assign nothing. `profiles` is *our* app table and
  this is a **defined write path**, not an RLS bypass of someone else's data (same posture as
  `createArticle`'s seed use of the admin client). Idempotent.
- **`lib/admin-user.ts` → `provisionUser({ email, password, name })`** — generalize the existing
  `provisionAdminUser` (or add a sibling) → `auth.admin.createUser({ email, password,
  email_confirm:true, user_metadata: { name } })`, idempotent (narrow "already registered" catch, as
  today). Passing `user_metadata.name` (MAJOR-1) means the §1.3 `handle_new_user` trigger writes a real
  `profiles.name`, which `createDraft` later reads as the byline. The trigger creates the empty-roles
  profile; then call `assignRoles`.
- **`scripts/seed-contributor.ts`** (analogue of `seed-admin.ts`): read
  `SEED_CONTRIBUTOR_EMAIL` / `SEED_CONTRIBUTOR_PASSWORD` (values in gitignored `.env.local`),
  `provisionUser({ …, name: 'Test Contributor' })`, then
  `assignRoles({ userId, name:'Test Contributor', roles:['contributor'] })`; fail loudly on any
  non-idempotent error. Wire `package.json` `"seed:contributor"` mirroring `"seed:admin"`. The display
  name is what surfaces as the article byline (`author_name`) and is asserted out of band in §6.
- **Complete the existing seed admin's role** so the model is coherent for slices 06/07: after
  provisioning, `assignRoles({ userId:<admin>, name:'Admin', roles:['editor'] })` — the **upsert**
  both heals the pre-trigger admin's missing `profiles` row **and** assigns the role. `editor` is the
  role slices 06/07 gate on.
  **Recommendation:** keep it `['editor']` now and defer `super_admin` + any **role hierarchy**
  (super_admin as a superset) to a later slice — every gate here checks **explicit membership**
  (`role = any(roles)`), so a hierarchy would be a new, separately-verified concept (§8). Orchestrator
  may instead choose `['editor','super_admin']`; both are membership-compatible with the has_role gates.
- **`.env.local` (out of band, gitignored):** add `SEED_CONTRIBUTOR_EMAIL`, `SEED_CONTRIBUTOR_PASSWORD`
  (names only). `playwright.config.ts`'s `loadEnvLocal()` already lifts `.env.local` into `process.env`
  before workers spawn (slice-04 §6), so the spec reads `process.env.SEED_CONTRIBUTOR_*`.

---

## 5. `data-testid` contract (hard — the e2e targets exactly these)

| `data-testid` | Element | Slice | Where |
|---|---|---|---|
| `admin-roles` | role indicator rendering the caller's `profiles.roles` (non-navigating) | 05a | `app/admin/(protected)/page.tsx` |
| `admin-nav` | admin dashboard nav wrapper | 05b | `app/admin/(protected)/page.tsx` |
| `admin-new-article-link` | link → `/admin/articles/new` (added only when the route exists) | 05b | dashboard nav |
| `admin-queue-link` | link → `/admin/queue` (added only when the route exists) | 05b | dashboard nav |
| `admin-new-article` | `<section>` on the new-article route | 05b | `articles/new/page.tsx` |
| `draft-form` | `<form>` | 05b | `article-draft-form.tsx` |
| `draft-title` | title `<input>` | 05b | draft form |
| `draft-body` | body `<textarea>` | 05b | draft form |
| `draft-category` | category `<input>`/`<select>` | 05b | draft form |
| `draft-hero` | hero image path/URL `<input>` (or `<select>`) | 05b | draft form |
| `draft-hero-alt` | hero alt-text `<input>` (→ `cover_image_alt`) | 05b | draft form |
| `draft-save` | "Save draft" submit `<button>` (createDraft) | 05b | draft form |
| `draft-error` | form error (present only on failure) | 05b | draft form |
| `draft-editor` | `<section>` on the `[id]` editor route | 05b | `articles/[id]/page.tsx` |
| `draft-status-badge` | status chip on the editor (`draft` / `in_review`) | 05b | editor page |
| `draft-source` | source marker rendering `source` (asserts `human`) | 05b | editor page |
| `submit-for-review` | "Submit for review" `<button>` (submitForReview) | 05b | `submit-for-review-button.tsx` |
| `submit-for-review-error` | submit error (present only on failure; distinct from the create form's `draft-error` to avoid a same-route testid collision on the editor) | 05b (added in build) | `submit-for-review-button.tsx` |
| `queue-list` | editorial queue list container | 05b | `queue/page.tsx` |
| `queue-item` | one queue row (repeated) | 05b | queue page |
| `queue-item-title` | the article title within a row | 05b | queue page |
| `queue-item-status` | status badge within a row | 05b | queue page |
| `queue-empty` | empty-state marker | 05b | queue page |

> **Preserved (MINOR-4):** the dashboard MOD keeps the existing `admin-dashboard` +
> `admin-authenticated` testids (`init-e2e-008.spec.ts` asserts them); `admin-roles` is additive.
> The `admin-new-article-link` / `admin-queue-link` links are **05b** — they must NOT appear in 05a
> (their routes do not exist yet; a dead link is the MAJOR-2 defect this avoids).

**"Not on the public feed"** is asserted on `/news` against the **existing** `article-feed` /
`article-card` / card-headline testids (slice 02/03) — the new title must be **absent**. No new
public testid.

Any new testid added during implementation MUST be added to this table (DESIGN.md §Component
authoring).

> **Build deviation (05b) — nav gated to `contributor`, not `contributor`/`editor`.** §3's
> dashboard-MOD row says the authoring nav is "shown for `contributor`/`editor`". In build it is
> gated to **`contributor` membership only**. Reason: the frozen 05a spec `init-e2e-003a` asserts
> the **editor/admin** dashboard ships **no** links to `/admin/articles/new` or `/admin/queue`
> (its "no dead links in 05a" guarantee), and that spec must stay green. Gating to contributor is
> also more correct: `createDraft`/`submitForReview` both `requireRole('contributor')`, so an
> editor following those links would be redirected (a semi-dead link). An editor-facing surface
> (the editor-wide queue) is already slice-07 scope. Editor nav can be reintroduced when its
> destinations exist and the 05a assertion is retired.
>
> **Editor Save (§3 editor row) not built.** The `[id]` editor renders status badge + source +
> the submit-for-review island and read-only field display, but **no in-place Save form** — the
> scenario's critical path is `createDraft → submitForReview` and §2.2 marks `saveDraft` optional.
> The typed `saveDraftFields` mutator (§2.1) IS implemented in `lib/articles.ts` for the forward
> write-path surface; wiring a Save UI + `saveDraft` action is deferred (avoids a second
> `draft-error`/form testid on the editor route and keeps the implementation minimal).

---

## 6. Verification plan for `init-e2e-003` (observe, never infer; real Supabase, never mock)

Precondition: `npm run seed`, `npm run seed:admin`, `npm run seed:contributor` have run; migration
`0003` applied. Playwright serial / `workers:1` (existing config). Drive the **real** Supabase sign-in
— Conceptualize forbids forged/minted sessions.

**Happy path (the scenario — 05b once split):**
1. `page.goto('/admin/login')`; fill `admin-login-email`/`-password` with
   `process.env.SEED_CONTRIBUTOR_EMAIL` / `…_PASSWORD`; click `admin-login-submit` → lands on `/admin`.
2. Click `admin-new-article-link` → `/admin/articles/new`. Fill `draft-title` (a unique marker title),
   `draft-body`, `draft-category`, `draft-hero` (a `public/seed/*.png` path), `draft-hero-alt`. Click
   `draft-save`.
3. Lands on `/admin/articles/[id]` (`draft-editor` visible); `expect(draft-status-badge).toHaveText(/draft/i)`
   and `expect(draft-source).toContainText(/human/i)`.
4. Click `submit-for-review`; `expect(draft-status-badge).toHaveText(/in.?review/i)` (auto-retrying
   `expect`, never a bare `count()` — the slice-02/03 gotcha).
5. `page.goto('/admin/queue')`; `expect(getByTestId('queue-item').filter({ hasText: markerTitle }))`
   is present and its `queue-item-status` reads `in_review`.
6. **Absent from the public feed:** in a **fresh anon context** (no `storageState`),
   `page.goto('/news')` → `expect(page.getByText(markerTitle)).toHaveCount(0)`; and the draft's slug
   `/news/[slug]` → **404** (RLS keeps non-published invisible to anon — same property slices 02/03
   proved).

**Observe `source=human` / the transition beyond the UI badge (out of band):** a service-role read of
the row asserts `source='human'`, `status='in_review'`, `author_id = <contributor's auth uid>`, and
**`author_name = 'Test Contributor'`** (the seeded `profiles.name`, proving the MAJOR-1 byline chain:
`user_metadata.name` → trigger `profiles.name` → `createDraft` byline → NOT-NULL `author_name`
satisfied) — dcon-style confirmation that the *right data* was written, not just that a badge rendered.

**Anti-tautology / forward-correctness (RLS probes, §1.6):** run probes 1–8 out of band. Probe 5
(contributor `in_review → published` rejected, status unchanged) proves the publish barrier is real
**now**, even though the full `init-e2e-004` UI test lands in slice 06 — so slice 05 does not ship a
permissive policy to be tightened later.

---

## 7. Smallest-slice check — **recommend a split (05a + 05b)**

This slice is large: a new table + trigger + SECURITY DEFINER function + four articles policies + a
grant change, a client-injectable refactor of the write path, three Server Actions, four routes/UI
components, and two seed paths. `status.md` already established the smallest-visible-slice discipline
(it decomposed the original nine-scenario "first slice"). **I recommend splitting; the orchestrator
decides.**

- **05a — role foundation (a real, browser-provable, dead-link-free increment).** Migration `0003`
  (§1.1–1.5: profiles + `has_role` + trigger + `articles.author_id` + grants + **all** RLS policies),
  the seed contributor + admin-role completion (§4), and a **non-navigating role indicator** on the
  admin dashboard (`admin-roles`, §5): the dashboard reads the signed-in user's `roles` **from
  `profiles` through the session/RLS client** and renders them — proving the profiles → trigger →
  `has_role` → RLS chain works in the browser. **No links to the unbuilt `/admin/articles/new` or
  `/admin/queue`** (those routes do not exist in 05a; a dead link is the MAJOR-2 defect this avoids —
  the nav links land in 05b with their routes). Proven in the browser: sign in as the seeded
  contributor → `admin-roles` shows `contributor`; sign in as a role-less account → it shows no roles.
  - **⚠️ 05a EXIT GATE (MAJOR-3): §1.6 probe 3 MUST pass before 05b starts.** A contributor INSERT of
    an own `draft`/`source=human` row succeeding is the empirical proof that `has_role` returns TRUE —
    i.e. that the `SECURITY DEFINER` owner really holds `BYPASSRLS` under `profiles` FORCE RLS. If the
    owner lacked BYPASSRLS, `has_role` would return FALSE for everyone and this probe would fail
    (silent deny). Do NOT build any 05b CRUD on top until probe 3 is green out of band.
- **05b — the draft create+submit CRUD** (§2–§3, §5): the role-gated nav links, the new-article form,
  the draft editor with Save + Submit-for-review, the queue list, and the Server Actions — i.e. the
  full `init-e2e-003` end-to-end (§6) on the proven 05a foundation.

Rationale: 05a's observable behavior maps to the scenario's **Given** (a signed-in contributor with
role), 05b to the **When/Then** (create → submit → queue, hidden from public). The RLS/`SECURITY
DEFINER`/trigger correctness is the highest-risk, least-visible part; landing and *empirically
proving* it as its own increment is exactly the slice-02 pattern ("prove RLS out of band before
building UI on it"). The `init-e2e-003` scenario is only fully green at the end of 05b — that is
expected and fine.

---

## 8. Prototype debt (recorded for `/actualize`)

- **Real image upload (MediaAsset).** Hero is a path/URL text input over `public/seed/*.png`; there is
  no Supabase Storage upload pipeline. Continues the slice 02/03 MediaAsset deferral.
- **`author_id` backfill.** Pre-auth seed rows and the slice-02 seed keep `author_id = NULL`
  (`author_name` remains the denormalized byline). The FK is nullable specifically to allow this; a
  real backfill (and deciding whether legacy rows get a synthetic author) is deferred. The
  insert-only idempotent seed **cannot** backfill a column onto existing rows (the exact silent-drift
  trap `status.md` records for `gallery`) — reset via `deleteAllArticles()` + re-seed if needed.
- **Rich-text body.** Still plain React-escaped text split on blank lines;
  `dangerouslySetInnerHTML` on DB-sourced content **stays banned**. A future slice picks a
  sanitizer/renderer.
- **No role hierarchy.** `super_admin` is not a superset; every gate checks explicit membership
  (`role = any(roles)`). If the seed admin is `['editor']`, only editor-gated actions pass. A real
  hierarchy (super_admin ⊇ editor ⊇ contributor) is a separate, separately-verified concept.
- **Admin gate remains authentication-only.** `requireUser()` in the `(protected)` layout still checks
  auth, not role; **editorial authorization is enforced inside each Server Action** (auth.md
  L1449-1469) and by RLS, not at the `/admin` boundary. Role-gating the admin *surface* itself (e.g.
  store/finance admins vs editors) is a later concern.
- **Editor-wide queue read not built.** The contributor queue shows only the user's **own** rows; an
  editor seeing **all** `in_review` is slice 07 (a new permissive SELECT policy on `has_role(uid,'editor')`).
- **Slug generation.** Derived from title with no collision strategy beyond the unique constraint;
  a duplicate raises `23505` surfaced as a form error. A slug-uniqueness/suffix scheme is deferred.
- **`profiles` self-UPDATE(name)** path is defined but unexercised this slice.
- **Legacy `SUPABASE_SERVICE_ROLE_KEY` JWT** retirement — still an open loop from slice 02.
- **Nothing shippable from Conceptualize** — slice 05 still owes `/actualize` (debt audit, backfilled
  tests, dcon on the `Then` data, red-team of the new RLS + Server Actions, CI) before ship.

---

## 9. Entities check (`docs/entities.md`)

`public.profiles` **realizes** the **User** entity (`roles[]`, `name`, `status`), keyed 1:1 to
Supabase Auth `auth.users`; **Article gains `author_id`** (→User). The **Authz schema** §Contributor
("create/edit *own* Articles up to `in_review`; cannot publish") is realized at the **database** via
the RLS policies in §1.5 (`status ∈ (draft,in_review)` by construction). A dated, *proposed* changelog
line is warranted and has been added to `docs/entities.md` Appendix A (entity bodies unchanged;
ratify in `/plan`):

```
- 2026-07-30 — Roles + authorship realized (slice 05 conceptualize; ratify in /plan). The User entity
  is realized as public.profiles (id → auth.users, roles text[] default '{}', name, status), created
  empty-roles by an auth.users AFTER INSERT trigger; roles assigned ONLY by the service role (no public
  signup, no self-escalation — a column-level GRANT makes profiles.roles non-user-writable). Article
  gains author_id (→auth.users, nullable; pre-auth seed rows stay NULL, backfill deferred). §Authz
  "Contributor" is enforced at the DATABASE: RLS lets a contributor INSERT/UPDATE only their own
  human draft/in_review rows and cannot reach published by construction, via a SECURITY DEFINER
  has_role() helper (avoids recursive-RLS on profiles). Proposed — softball/init conceptualize;
  ratify in /plan.
```
</content>
</invoke>
