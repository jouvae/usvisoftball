-- 0013_teams.sql
-- Feature softball/teams, Slice 1 (teams-web-001): the public teams directory.
--
-- One `teams` table under the same two-layer read-only boundary as 0006/0011 — this slice
-- is a public /teams render from seed, so anon/authenticated get SELECT only + public read
-- RLS. Editor WRITE lands with the teams admin-CRUD slice (a later migration).
--
-- `island` is TEXT + CHECK over the three USVI islands (mirrors the board seat taxonomy
-- rationale: an editable set, not a Postgres enum/lookup table). `division` is FREE TEXT
-- (Men's / Women's / Coed / Youth vary and aren't a fixed taxonomy — same call as board
-- member `role`). `logo_url` mirrors the photo_url shape so the CRUD slice can reuse the
-- board photo-upload flow for team logos.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0013_teams.sql

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  island       text not null,
  division     text not null default '',
  description  text not null default '',
  logo_url     text not null default '',
  home_venue   text not null default '',
  founded_year int,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint teams_island_check
    check (island in ('st_thomas', 'st_john', 'st_croix'))
);

create index if not exists idx_teams_island on public.teams (island);

-- RLS: PUBLIC READ ONLY this slice.
alter table public.teams enable row level security;
revoke all on public.teams from anon, authenticated;
grant select on public.teams to anon, authenticated;

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams
  for select using (true);

-- Seed a handful of member clubs across the three islands (idempotent on slug).
insert into public.teams (name, slug, island, division, description, home_venue, founded_year, sort_order) values
  ('Frenchtown Sluggers',   'frenchtown-sluggers',   'st_thomas', 'Men''s',
   'A St. Thomas men''s club competing in the territorial fast-pitch league.', 'Lionel Roberts Stadium', 1998, 10),
  ('Charlotte Amalie Storm','charlotte-amalie-storm','st_thomas', 'Women''s',
   'St. Thomas women''s softball, three-time territorial finalists.', 'Lionel Roberts Stadium', 2005, 20),
  ('Cruz Bay Waves',        'cruz-bay-waves',        'st_john',   'Coed',
   'St. John''s community coed club, playing out of Cruz Bay.', 'Winston Wells Ballfield', 2012, 10),
  ('Christiansted Crushers','christiansted-crushers','st_croix',  'Men''s',
   'St. Croix men''s powerhouse on the east end.', 'Canegata Ballpark', 1991, 10),
  ('Frederiksted Fire',     'frederiksted-fire',     'st_croix',  'Coed',
   'West-end St. Croix coed club and youth development pipeline.', 'Paul E. Joseph Stadium', 2008, 20)
on conflict (slug) do nothing;
