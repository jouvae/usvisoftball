-- 0014_team_players.sql
-- Feature softball/teams, Slice 2 (teams-web-002): team detail page rosters.
--
-- One `team_players` table under the same read-only public boundary (SELECT-only grants +
-- public read RLS). Editor WRITE (player admin CRUD) lands with a later slice. Mirrors the
-- committee_members / board_members shape (name/photo_url/sort_order) so the CRUD slice can
-- reuse the photo-upload flow. `position` and `bats_throws` are FREE TEXT (softball
-- positions/handedness vary in notation — same call as team `division`).
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0014_team_players.sql

create extension if not exists pgcrypto;

create table if not exists public.team_players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  name          text not null,
  jersey_number int,
  position      text not null default '',
  bats_throws   text not null default '',
  hometown      text not null default '',
  photo_url     text not null default '',
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, name)
);

create index if not exists idx_team_players_team on public.team_players (team_id);

-- RLS: PUBLIC READ ONLY this slice.
alter table public.team_players enable row level security;
revoke all on public.team_players from anon, authenticated;
grant select on public.team_players to anon, authenticated;

drop policy if exists team_players_public_read on public.team_players;
create policy team_players_public_read on public.team_players
  for select using (true);

-- Seed a small roster per team, resolving team_id by slug (idempotent on (team_id, name)).
insert into public.team_players (team_id, name, jersey_number, position, bats_throws, sort_order)
select t.id, p.name, p.num, p.pos, p.bt, p.sort
from public.teams t
join (values
  ('frenchtown-sluggers',    'Malik Prince',       7,  'SS', 'R/R', 10),
  ('frenchtown-sluggers',    'Andre Petersen',     12, 'P',  'L/L', 20),
  ('frenchtown-sluggers',    'Tyrone Baptiste',    24, 'C',  'R/R', 30),
  ('frenchtown-sluggers',    'Jamal Herbert',      3,  'CF', 'L/R', 40),
  ('charlotte-amalie-storm', 'Keisha Williams',    9,  'P',  'R/R', 10),
  ('charlotte-amalie-storm', 'Tamara Joseph',      5,  'SS', 'R/R', 20),
  ('charlotte-amalie-storm', 'Nadia Charles',      21, '1B', 'L/L', 30),
  ('cruz-bay-waves',         'Devon Sewer',        10, 'OF', 'R/R', 10),
  ('cruz-bay-waves',         'Alicia George',      14, '2B', 'R/R', 20),
  ('cruz-bay-waves',         'Marcus Penn',        6,  '3B', 'R/R', 30),
  ('christiansted-crushers', 'Rueben Santos',      4,  'SS', 'R/R', 10),
  ('christiansted-crushers', 'Elias Gomez',        18, 'P',  'R/R', 20),
  ('christiansted-crushers', 'Josiah Bryan',       22, '1B', 'L/L', 30),
  ('christiansted-crushers', 'Nathaniel Frett',    8,  'C',  'R/R', 40),
  ('frederiksted-fire',      'Shanice Moorehead',  11, 'P',  'L/R', 10),
  ('frederiksted-fire',      'Kwame Richardson',   2,  '2B', 'R/R', 20),
  ('frederiksted-fire',      'Latoya Benjamin',    16, 'OF', 'R/R', 30)
) as p(tslug, name, num, pos, bt, sort) on p.tslug = t.slug
on conflict (team_id, name) do nothing;
