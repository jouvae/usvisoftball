-- 0003_profiles_and_authorship.sql
-- Slice 05a (scenario init-e2e-003a): role foundation + authorship.
--
-- Realizes the User entity as `public.profiles` (1:1 with auth.users), a SECURITY
-- DEFINER `has_role()` helper, an auth.users AFTER INSERT trigger that auto-creates
-- an empty-roles profile, and the `articles.author_id` FK + the four contributor
-- RLS policies. It is ADDITIVE and REPLAYABLE — nothing here regresses the 0001
-- anon published-only read (slices 02/03 stay green).
--
-- Applied out-of-band by a human; NEVER from application code (API keys reach
-- PostgREST, DDL is not exposed over HTTP):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_profiles_and_authorship.sql
--
-- Replayable: safe to run more than once (create-if-not-exists, add-column-if-not-
-- exists, drop-then-create for triggers/policies/functions), matching 0001/0002.

-- ── public.profiles — realizes docs/entities.md §Identity/Access "User" ─────────
-- Keyed 1:1 to Supabase Auth's auth.users. Role assignment is EXPLICIT (empty by
-- default) — there is no public self-signup, so a fresh account has no powers.
-- `roles text[]` (the locked decision), not a join table: the role set is tiny,
-- read on every authorization check, and always fetched wholesale for a user.
create table if not exists public.profiles (
    id          uuid        primary key references auth.users(id) on delete cascade,
    name        text,
    roles       text[]      not null default '{}',
    status      text        not null default 'active'
                    check (status in ('active', 'disabled')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Reuse the 0001 trigger fn to keep updated_at honest on UPDATE.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ── public.has_role() — SECURITY DEFINER helper (reads profiles under FORCE RLS) ─
-- Used by the articles policies below. It MUST be SECURITY DEFINER, but NOT for a
-- recursion reason: profiles_self_read (below) is `id = auth.uid()`, so the
-- articles->profiles path does NOT self-reference and does NOT raise 42P17.
--
-- The REAL dependency: profiles is ENABLE + FORCE row security. Under FORCE RLS the
-- table owner is ALSO subject to policies, so a plain `select ... from
-- public.profiles` inside a policy — running as the calling anon/authenticated role
-- — would return ONLY that caller's own profile row and answer has_role(<some OTHER
-- uid>, ...) as FALSE. SECURITY DEFINER runs the body as the function OWNER; this
-- migration is applied via `psql "$SUPABASE_DB_URL"`, so the owner is `postgres`,
-- which holds rolbypassrls. BYPASSRLS is EXACTLY what lets the inner SELECT see the
-- target user's row regardless of FORCE RLS — that is the whole mechanism.
--
-- STABLE = no writes, safe to call many times per statement; the pinned empty
-- search_path hardens against search-path hijack (objects are schema-qualified).
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

-- ── Trigger on auth.users — auto-create the profile row (empty roles) ───────────
-- Every new auth user gets exactly one profile with EMPTY roles. Role assignment is
-- a separate, explicit, service-role act (see scripts/seed-contributor.ts). SECURITY
-- DEFINER because the trigger fires in the auth schema and writes public.profiles.
-- `on conflict do nothing` keeps it replay/re-run safe and heals nothing it
-- shouldn't (the seed upsert completes any pre-existing row's roles/name).
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
  for each row
  execute function public.handle_new_user();

-- ── profiles RLS — self-read, no self-escalation ───────────────────────────────
-- ENABLE turns RLS on; FORCE also subjects the table OWNER to policies. Neither
-- affects service_role (BYPASSRLS), which seeds roles.
alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- Grants bound the reachable verbs; RLS bounds the rows. anon gets NOTHING (profiles
-- are not public). authenticated may SELECT, and may UPDATE ONLY the `name` column —
-- a COLUMN-level grant is what makes `roles`/`status` non-user-writable at the
-- privilege layer (a row policy's WITH CHECK sees only the NEW row and cannot cheaply
-- prove `roles` was unchanged; the column grant makes escalation impossible before
-- RLS is even consulted). service_role (BYPASSRLS) still writes roles for seeding.
revoke all             on public.profiles from anon, authenticated;
grant select           on public.profiles to authenticated;
grant update (name)    on public.profiles to authenticated;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── articles.author_id + the contributor write/update/read policies ────────────
-- Nullable FK so the existing seed rows and the admin seed path stay valid
-- (author_name remains the denormalized display byline from 0001). Backfill of
-- pre-auth rows is deferred.
alter table public.articles
    add column if not exists author_id uuid references auth.users(id);
create index if not exists articles_author_id_idx on public.articles (author_id);

-- authenticated needs INSERT + UPDATE now (0001 left it SELECT-only). Grant EXACTLY
-- those; anon stays SELECT-only (published-read unchanged -> slices 02/03 stay green).
grant insert, update on public.articles to authenticated;

-- INSERT: a contributor may create ONLY their own human draft/in_review row. status
-- in (draft,in_review) + source='human' makes reaching 'published' impossible by
-- construction — the forward-correctness requirement.
drop policy if exists articles_contributor_insert on public.articles;
create policy articles_contributor_insert
  on public.articles
  for insert
  to authenticated
  with check (
        author_id = auth.uid()
    and public.has_role(auth.uid(), 'contributor')
    and status in ('draft', 'in_review')
    and source = 'human'
  );

-- UPDATE: a contributor may edit their OWN row while it is draft/in_review. USING
-- gates which rows are updatable at all (own + not yet past review); WITH CHECK gates
-- the RESULT row — it may still only be draft/in_review, so this is what both PERMITS
-- draft->in_review and FORBIDS ->published/->unpublished. source is pinned to 'human'
-- so a contributor can't relabel provenance.
drop policy if exists articles_contributor_update on public.articles;
create policy articles_contributor_update
  on public.articles
  for update
  to authenticated
  using (
        author_id = auth.uid()
    and public.has_role(auth.uid(), 'contributor')
    and status in ('draft', 'in_review')
  )
  with check (
        author_id = auth.uid()
    and status in ('draft', 'in_review')
    and source = 'human'
  );

-- SELECT: contributor sees their OWN rows (for the editorial queue + the RETURNING
-- re-read after insert/update), IN ADDITION to the existing published-read. This is a
-- SECOND permissive policy — permissive policies are OR-combined — so authenticated
-- sees (published OR own) and anon still sees ONLY published (the 0001 policy is `to
-- anon, authenticated`; this one is `to authenticated`).
drop policy if exists articles_contributor_read_own on public.articles;
create policy articles_contributor_read_own
  on public.articles
  for select
  to authenticated
  using (author_id = auth.uid());

-- No DELETE grant/policy — a contributor cannot delete; default-deny stands. No
-- editor policies yet (slice 07 adds them as additional permissive policies). The
-- 0001 anon published-only read path is UNTOUCHED.
