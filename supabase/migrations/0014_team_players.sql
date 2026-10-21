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
-- Sample seed rows REMOVED (home-layout slice 5b, 2026-10-21): the clearly-sample roster players
-- were purged from the shared DB, and this insert was dropped so a replay can't restore them.
-- e2e specs seed their own fixtures (tests/support/sports-fixtures.ts).
