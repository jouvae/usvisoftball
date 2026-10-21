-- 0024_team_kind.sql
-- Feature softball/home-layout, Slice 5: national teams (design guide §4.2).
--
-- `teams` modelled island CLUBS only. The home page features the federation's NATIONAL
-- teams (Women's, U18 Girls'), which belong to no single island. Adds:
--   kind            'club' | 'national' (default 'club' — every existing row stays a club)
--   short_name      for the home card button ("Meet the U18s"); '' → the full name is used
--   cover_image_url team photo for the home card + detail page; '' → the no-photo variant
-- and relaxes `island` to NULLABLE, with a CHECK that a CLUB still requires an island.
-- cover_image_url follows the logo_url shape (local /public path or board-photos Storage URL;
-- the app enforces the allowlist on write and at render).
--
-- Additive + replayable:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0024_team_kind.sql

alter table public.teams
  add column if not exists kind            text not null default 'club',
  add column if not exists short_name      text not null default '',
  add column if not exists cover_image_url text not null default '';

alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams
  add constraint teams_kind_check check (kind in ('club', 'national'));

alter table public.teams alter column island drop not null;

alter table public.teams drop constraint if exists teams_island_check;
alter table public.teams
  add constraint teams_island_check
    check (island is null or island in ('st_thomas', 'st_john', 'st_croix'));

alter table public.teams drop constraint if exists teams_club_island_required;
alter table public.teams
  add constraint teams_club_island_required check (kind <> 'club' or island is not null);

create index if not exists idx_teams_kind on public.teams (kind);
