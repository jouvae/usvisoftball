-- 0011_committees.sql
-- Feature softball/about, Slice 5 (about-web-011): standing committees / sub-boards.
--
-- Two tables under the SAME two-layer boundary as 0006 — this slice is READ-ONLY (public
-- /about render from seed), so it grants anon/authenticated SELECT only and adds public
-- read RLS. Editor WRITE policies land with the committees admin-CRUD slice (a later
-- migration), exactly as 0006 (read) preceded 0007 (editor write) for the board.
--
-- Committees are NOT term-scoped (standing structures), unlike board_terms/board_members.
-- committee_members mirrors the board_members shape (name/role/bio/photo_url/sort_order) so
-- the CRUD slice can reuse the board photo-upload flow. unique(committee_id, name) makes the
-- seed idempotent and blocks duplicate members.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0011_committees.sql

create extension if not exists pgcrypto;

create table if not exists public.committees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.committee_members (
  id           uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  name         text not null,
  role         text not null default '',
  bio          text not null default '',
  photo_url    text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (committee_id, name)
);

create index if not exists idx_committee_members_committee
  on public.committee_members (committee_id);

-- RLS: PUBLIC READ ONLY this slice. Revoke Supabase's default ALL grant, then grant SELECT.
alter table public.committees        enable row level security;
alter table public.committee_members enable row level security;
revoke all on public.committees        from anon, authenticated;
revoke all on public.committee_members from anon, authenticated;
grant select on public.committees        to anon, authenticated;
grant select on public.committee_members to anon, authenticated;

drop policy if exists committees_public_read on public.committees;
create policy committees_public_read on public.committees
  for select using (true);

drop policy if exists committee_members_public_read on public.committee_members;
create policy committee_members_public_read on public.committee_members
  for select using (true);

-- Seed the standing committees (idempotent on slug).
insert into public.committees (name, slug, description, sort_order) values
  ('Competition Committee', 'competition',
   'Oversees league scheduling, playing rules, and tournament format across the territory.', 10),
  ('Officials & Umpires Committee', 'officials-umpires',
   'Recruits, trains, and assigns umpires and scorekeepers for sanctioned games.', 20),
  ('Youth Development Committee', 'youth-development',
   'Grows the youth game — clinics, school programs, and the junior national pipeline.', 30),
  ('Marketing & Communications Committee', 'marketing-communications',
   'Handles sponsorships, media, and the Federation''s public communications.', 40)
on conflict (slug) do nothing;

-- Seed members, resolving committee_id by slug (idempotent on (committee_id, name)).
insert into public.committee_members (committee_id, name, role, sort_order)
select c.id, m.name, m.role, m.sort_order
from public.committees c
join (values
  ('competition',                'Rupert James',    'Chair',  10),
  ('competition',                'Denise Hodge',    'Member', 20),
  ('officials-umpires',          'Carlos Mendez',   'Chair',  10),
  ('officials-umpires',          'Angela Bryan',    'Member', 20),
  ('youth-development',          'Marcia Todman',   'Chair',  10),
  ('youth-development',          'Kevin Liburd',    'Member', 20),
  ('marketing-communications',   'Simone Roberts',  'Chair',  10)
) as m(cslug, name, role, sort_order) on m.cslug = c.slug
on conflict (committee_id, name) do nothing;
