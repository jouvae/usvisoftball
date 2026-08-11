-- 0006_about_board.sql
-- Feature softball/about, Slice 1 (about-web-001..003): the public /about page —
-- mission statement + the current board roster, plus a read-only prior-term archive.
--
-- Creates THREE tables under the SAME two-layer database boundary proven in 0001:
--   1. GRANTs bound which verbs are reachable at all — anon/authenticated hold
--      SELECT only (all other verbs revoked). /about is a PUBLIC RENDER: the page
--      needs only the publishable/anon key + read RLS. No service_role at read time.
--   2. RLS bounds which rows a reachable verb sees — here every row is public, so
--      the SELECT policies are `using (true)`; the boundary that matters is that
--      there is NO insert/update/delete policy for anon/authenticated (default-deny).
-- Writes (the seed, and a DEFERRED admin CRUD slice) go only through a BYPASSRLS
-- role (the secret-key admin client). Admin CRUD is intentionally NOT built here.
--
-- H1 (mission storage): a small SINGLETON `site_content` row keyed slug='about_mission'
--   rather than a bespoke `mission` table. Rationale: the mission is one editable
--   block of prose; a generic keyed-content table lets a later editor slice change the
--   copy WITHOUT a schema migration, and gives future singletons (e.g. a /about intro,
--   a footer blurb) a home without a table each. Cost is trivial (one shape, RLS once).
-- H2 (term rollover ARCHIVES, never overwrites): a per-term aggregate `board_terms`
--   with an `is_current` flag guarded by a PARTIAL UNIQUE index (at most one current
--   term). Rollover = flip the old term's is_current to false and INSERT a new current
--   term; the prior term's rows are never mutated. Prior-term rows are read-only in
--   practice because anon has no write verb at all; the future admin CRUD slice must
--   additionally refuse UPDATE/DELETE on a non-current term to make permanence a DB
--   guarantee (see the write-guard TODO below — deferred with the CRUD slice).
-- H4 (seat taxonomy): `seat` is TEXT + CHECK over the three USVI constituencies
--   (mirrors the VI Olympic Committee: St. Thomas/St. John · St. Croix · at-large),
--   NOT a Postgres enum and NOT a lookup table. Same rationale as 0001's status CHECK:
--   the seat set may still gain members (e.g. Water Island), and a CHECK is edited with
--   a plain idempotent ALTER TABLE, keeping the migration replayable and mapping cleanly
--   to supabase-js string filters. `role` (President, Secretary, …) is FREE TEXT — an
--   honorific/office that varies per person and is not a constrained taxonomy.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0006_about_board.sql

-- gen_random_uuid() lives in pgcrypto (present on Supabase; be explicit, as 0001 is).
create extension if not exists pgcrypto;

-- Shared updated_at trigger fn. Defined in 0001; re-declared here (create or replace is
-- idempotent + identical) so 0006 is self-contained and order-independent when replayed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── site_content (H1: singleton keyed prose) ─────────────────────────────────
-- One row per `slug`. Slice 1 uses exactly slug='about_mission'. `body` is plain
-- text, React-escaped at render (dangerouslySetInnerHTML on DB content is banned —
-- DESIGN.md / entities.md §Article body). `title` is optional (the mission renders
-- under the page's own heading; kept for future keyed blocks that want their own).
create table if not exists public.site_content (
    slug        text        primary key,
    title       text,
    body        text        not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row
  execute function public.set_updated_at();

-- ── board_terms (H2: the per-term aggregate) ─────────────────────────────────
-- `slug` gives the archive a clean, URL-safe key ('2025-2027') independent of the
-- display `label` ('2025–2027', which carries an en-dash unfit for a URL). Added
-- beyond the planner's field list precisely so /about/[term] can route by slug the
-- way /news/[slug] does — an additive, house-style choice.
create table if not exists public.board_terms (
    id          uuid        primary key default gen_random_uuid(),
    slug        text        not null unique,
    label       text        not null,
    is_current  boolean     not null default false,
    sort_order  integer     not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- At most ONE current term. A partial unique index over is_current filtered to true
-- rows lets any number of archived (false) terms coexist while making a second
-- is_current=true INSERT fail loudly. This is the DB half of H2's "rollover archives":
-- you cannot have two current boards.
create unique index if not exists board_terms_single_current_idx
    on public.board_terms (is_current)
    where is_current;

-- Archive listing is ordered newest-first; sort_order is the explicit control (a
-- higher number = more recent term), label as a stable tiebreak in app code.
create index if not exists board_terms_sort_idx
    on public.board_terms (sort_order desc);

drop trigger if exists board_terms_set_updated_at on public.board_terms;
create trigger board_terms_set_updated_at
  before update on public.board_terms
  for each row
  execute function public.set_updated_at();

-- ── board_members (a roster row, child of a term) ────────────────────────────
create table if not exists public.board_members (
    id          uuid        primary key default gen_random_uuid(),
    term_id     uuid        not null references public.board_terms(id) on delete cascade,
    name        text        not null,
    -- H4: geographic constituency (island seat). CHECK, not enum — see header.
    seat        text        not null
                    check (seat in ('st_thomas_st_john', 'st_croix', 'at_large')),
    role        text        not null,             -- free-text office (President, …)
    photo_url   text,                             -- nullable → exercises the missing-photo state
    bio         text        not null default '',
    sort_order  integer     not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    -- A person appears once per term. Doubles as the seed's idempotency key (a re-run's
    -- duplicate INSERT raises 23505, which the seed treats as "already present"),
    -- mirroring how `articles.slug` makes seed-articles idempotent.
    constraint board_members_term_name_unique unique (term_id, name)
);

-- Roster read is exactly: WHERE term_id = $1 ORDER BY sort_order, name. Index the
-- FK + ordering so the per-term roster query stays sharp as terms accumulate.
create index if not exists board_members_term_order_idx
    on public.board_members (term_id, sort_order);

drop trigger if exists board_members_set_updated_at on public.board_members;
create trigger board_members_set_updated_at
  before update on public.board_members
  for each row
  execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- ENABLE turns RLS on; FORCE also subjects the table OWNER to policies (defense in
-- depth). Neither affects service_role (BYPASSRLS) — the secret-key admin client
-- (seed / future CRUD) still writes freely. The publishable-key client runs as
-- anon/authenticated and is fully policy-bound. Identical posture to 0001.
alter table public.site_content  enable row level security;
alter table public.site_content  force  row level security;
alter table public.board_terms   enable row level security;
alter table public.board_terms   force  row level security;
alter table public.board_members enable row level security;
alter table public.board_members force  row level security;

-- GRANT bounds reachable verbs; RLS bounds visible rows — layered, not redundant.
-- Supabase's defaults grant ALL on new public tables to anon/authenticated, and RLS
-- default-deny does NOT cover TRUNCATE (a table privilege, not row security). anon is
-- the publishable key shipped in the browser bundle. Revoke everything, then grant
-- back exactly the SELECT the public /about render needs. service_role is omitted on
-- purpose (BYPASSRLS + Supabase defaults already cover it).
revoke all on public.site_content  from anon, authenticated;
revoke all on public.board_terms   from anon, authenticated;
revoke all on public.board_members from anon, authenticated;
grant select on public.site_content  to anon, authenticated;
grant select on public.board_terms   to anon, authenticated;
grant select on public.board_members to anon, authenticated;

-- All About content is public by design, so the row predicate is simply `true`.
-- The security boundary here is the ABSENCE of any write policy below (default-deny),
-- not a row filter. (Contrast 0001, whose value lay in hiding non-published rows.)
drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read
  on public.site_content
  for select
  to anon, authenticated
  using (true);

drop policy if exists board_terms_public_read on public.board_terms;
create policy board_terms_public_read
  on public.board_terms
  for select
  to anon, authenticated
  using (true);

drop policy if exists board_members_public_read on public.board_members;
create policy board_members_public_read
  on public.board_members
  for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated => default-deny. Writes are
-- only possible through a BYPASSRLS role (the secret-key admin client: the seed, and
-- the DEFERRED admin CRUD slice). Editing the board is deliberately NOT a public
-- capability.
--
-- TODO (admin CRUD slice — H2 permanence hardening): when write policies are added
-- for an authenticated admin role, the board_members UPDATE/DELETE and the
-- board_terms UPDATE policies MUST forbid mutating a row whose term is not current
-- (e.g. WITH CHECK against a `board_terms.is_current` lookup), so a prior term is a
-- true immutable archive at the DB and not merely by absence of a write path.
