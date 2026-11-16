-- 0026_schedule.sql
-- Feature softball/schedule, Slice S1 (schedule-db-001): tournaments, calendar events, games,
-- line scores, box scores (docs/features/softball/schedule/overview.md §2).
--
-- Model (D1): a TOURNAMENT groups calendar EVENTS; an event is one thing on the calendar
-- (type game | ceremony | other); a GAME is the sports data for exactly one event (1:1) —
-- two teams, a line score (game_innings) and a USVI box score (game_player_stats).
-- Run totals and tournament dates are DERIVED in lib/schedule-view.ts, never stored.
--
-- ⚠️ ADDITIVE ONLY. The shared DB is production and prod still reads the legacy `events`
-- (= tournaments) and `event_teams` tables — nothing here renames, alters or drops them. The
-- new calendar table is therefore `calendar_events` (permanent name). The legacy tables are
-- dropped by a later CONTRACT migration run only after this branch is deployed (which also
-- drops editor DELETE on team_players and moves team_players.team_id to on delete restrict).
--
-- Boundary: public SELECT on every new table. tournaments / calendar_events: editor writes.
-- games / game_innings / game_player_stats: editor OR scorekeeper insert/update; DELETE is
-- editor-only on games and game_player_stats (a scorekeeper may delete an inning row, which
-- the scoreboard's undo can need). Same has_role() pattern as 0018/0023. The `scorekeeper`
-- role needs no schema change: profiles.roles is a free text[] with no allowlist (0003).
--
-- NO Pan Am games/ceremony/guest teams here — scripts/seed-panam.ts loads those. This file
-- only copies the legacy Pan Am tournament row (same id + slug) and tags the USVI national
-- teams with country_code 'VI'.
--
-- Additive + replayable (create-if-not-exists, drop-then-create policies/constraints/
-- triggers, on conflict do nothing):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0026_schedule.sql

create extension if not exists pgcrypto;

-- ── teams: country + guest kind ─────────────────────────────────────────────────
-- country_code is ISO 3166-1 alpha-2, uppercase. 'guest' = a lightweight opponent (name,
-- country, flag, division; no roster, no island). A guest REQUIRES a country.
alter table public.teams
  add column if not exists country_code char(2);

alter table public.teams drop constraint if exists teams_country_code_check;
alter table public.teams
  add constraint teams_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.teams drop constraint if exists teams_kind_check;
alter table public.teams
  add constraint teams_kind_check check (kind in ('club', 'national', 'guest'));

alter table public.teams drop constraint if exists teams_guest_country_required;
alter table public.teams
  add constraint teams_guest_country_required
    check (kind <> 'guest' or country_code is not null);

create index if not exists idx_teams_country_code on public.teams (country_code);

update public.teams
   set country_code = 'VI'
 where slug in ('u18-girls-national-team', 'womens-national-team')
   and country_code is distinct from 'VI';

-- ── team_players: deactivate, never delete (D4) ─────────────────────────────────
alter table public.team_players
  add column if not exists active boolean not null default true;

-- (id, team_id) is unique so game_player_stats can carry a COMPOSITE FK proving the stat
-- line's team_id is the player's own team.
create unique index if not exists uq_team_players_id_team
  on public.team_players (id, team_id);

-- ── tournaments ─────────────────────────────────────────────────────────────────
-- Start/end are DERIVED from the events (D2); announced_start/announced_end are used ONLY
-- while the tournament has no events. timezone is IANA, venue-local.
create table if not exists public.tournaments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_es         text not null default '',
  slug            text not null unique,
  description     text not null default '',
  description_es  text not null default '',
  city            text not null default '',
  country_code    char(2),
  timezone        text not null default 'America/St_Thomas',
  logo_url        text not null default '',
  cover_image_url text not null default '',
  stream_url      text,
  announced_start date,
  announced_end   date,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tournaments_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint tournaments_stream_https
    check (stream_url is null or stream_url like 'https://%'),
  constraint tournaments_announced_order
    check (announced_start is null or announced_end is null or announced_end >= announced_start)
);

drop trigger if exists tournaments_set_updated_at on public.tournaments;
create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- Copy the legacy Pan Am row (same id + slug) so existing links keep resolving. Legacy
-- start/end dates are NOT copied: the seed's events define the window (D2). The seed script
-- fills name_es / city / country / timezone.
insert into public.tournaments
  (id, name, slug, description, logo_url, cover_image_url, sort_order, created_at)
select id, name, slug, description, logo_url, cover_image_url, sort_order, created_at
  from public.events
 where slug = '2026-pan-american-u18-womens-softball-championship'
on conflict do nothing;

-- ── calendar_events ─────────────────────────────────────────────────────────────
-- One thing on the calendar. Games carry no game columns here (D1) and are titled from
-- their teams; title/title_es are for ceremonies/other. `round` is a dictionary KEY.
create table if not exists public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete restrict,
  type          text not null,
  slug          text not null unique,
  title         text not null default '',
  title_es      text not null default '',
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  venue         text not null default '',
  round         text not null default '',
  status        text not null default 'scheduled',
  stream_url    text,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint calendar_events_type_check
    check (type in ('game', 'ceremony', 'other')),
  constraint calendar_events_status_check
    check (status in ('scheduled', 'postponed', 'cancelled')),
  constraint calendar_events_stream_https
    check (stream_url is null or stream_url like 'https://%'),
  constraint calendar_events_ends_after_start
    check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_calendar_events_tournament_starts
  on public.calendar_events (tournament_id, starts_at);
create index if not exists idx_calendar_events_starts
  on public.calendar_events (starts_at);

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ── games ───────────────────────────────────────────────────────────────────────
-- Exactly one game per event (unique event_id). "A vs B" on the flyer = A away, B home.
-- H/E are stored; R is derived from game_innings.
create table if not exists public.games (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null unique references public.calendar_events(id) on delete restrict,
  away_team_id   uuid not null references public.teams(id) on delete restrict,
  home_team_id   uuid not null references public.teams(id) on delete restrict,
  state          text not null default 'pregame',
  current_inning int,
  away_hits      int  not null default 0,
  away_errors    int  not null default 0,
  home_hits      int  not null default 0,
  home_errors    int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint games_distinct_teams check (away_team_id <> home_team_id),
  constraint games_state_check check (state in ('pregame', 'live', 'final')),
  constraint games_current_inning_check check (current_inning is null or current_inning >= 1),
  constraint games_he_nonneg check (
    away_hits >= 0 and away_errors >= 0 and home_hits >= 0 and home_errors >= 0
  )
);

create index if not exists idx_games_away_team on public.games (away_team_id);
create index if not exists idx_games_home_team on public.games (home_team_id);

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- ── game_innings — the line score ───────────────────────────────────────────────
create table if not exists public.game_innings (
  game_id    uuid not null references public.games(id) on delete restrict,
  inning     int  not null,
  side       text not null,
  runs       int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, inning, side),
  constraint game_innings_inning_check check (inning >= 1),
  constraint game_innings_side_check check (side in ('away', 'home')),
  constraint game_innings_runs_check check (runs >= 0)
);

drop trigger if exists game_innings_set_updated_at on public.game_innings;
create trigger game_innings_set_updated_at
  before update on public.game_innings
  for each row execute function public.set_updated_at();

-- ── game_player_stats — the box score (USVI players, D6) ────────────────────────
-- A player "played" iff they have a line (D3). Pitching columns are NULL when the player did
-- not pitch; innings pitched is stored as OUTS (14 outs = "4⅔ IP"). The composite FK
-- (player_id, team_id) → team_players(id, team_id) proves team_id is the player's team.
create table if not exists public.game_player_stats (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete restrict,
  player_id    uuid not null references public.team_players(id) on delete restrict,
  team_id      uuid not null references public.teams(id) on delete restrict,
  ab           int  not null default 0,
  r            int  not null default 0,
  h            int  not null default 0,
  doubles      int  not null default 0,
  triples      int  not null default 0,
  hr           int  not null default 0,
  rbi          int  not null default 0,
  bb           int  not null default 0,
  so           int  not null default 0,
  sb           int  not null default 0,
  outs_pitched int,
  p_h          int,
  p_r          int,
  p_er         int,
  p_bb         int,
  p_so         int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (game_id, player_id),
  constraint game_player_stats_player_team_fk
    foreign key (player_id, team_id)
    references public.team_players (id, team_id) on delete restrict,
  constraint game_player_stats_batting_nonneg check (
    ab >= 0 and r >= 0 and h >= 0 and doubles >= 0 and triples >= 0 and hr >= 0
    and rbi >= 0 and bb >= 0 and so >= 0 and sb >= 0
  ),
  constraint game_player_stats_h_le_ab check (h <= ab),
  constraint game_player_stats_xbh_le_h check (doubles + triples + hr <= h),
  constraint game_player_stats_pitching_nonneg check (
        (outs_pitched is null or outs_pitched >= 0)
    and (p_h  is null or p_h  >= 0)
    and (p_r  is null or p_r  >= 0)
    and (p_er is null or p_er >= 0)
    and (p_bb is null or p_bb >= 0)
    and (p_so is null or p_so >= 0)
  ),
  constraint game_player_stats_er_le_r check (p_er is null or p_r is null or p_er <= p_r)
);

create index if not exists idx_game_player_stats_player on public.game_player_stats (player_id);
create index if not exists idx_game_player_stats_team on public.game_player_stats (team_id);

drop trigger if exists game_player_stats_set_updated_at on public.game_player_stats;
create trigger game_player_stats_set_updated_at
  before update on public.game_player_stats
  for each row execute function public.set_updated_at();

-- ── RLS + grants ────────────────────────────────────────────────────────────────
alter table public.tournaments       enable row level security;
alter table public.calendar_events   enable row level security;
alter table public.games             enable row level security;
alter table public.game_innings      enable row level security;
alter table public.game_player_stats enable row level security;

revoke all on public.tournaments, public.calendar_events, public.games,
              public.game_innings, public.game_player_stats
  from anon, authenticated;
grant select on public.tournaments, public.calendar_events, public.games,
                public.game_innings, public.game_player_stats
  to anon, authenticated;
grant insert, update, delete on public.tournaments, public.calendar_events, public.games,
                                public.game_innings, public.game_player_stats
  to authenticated;

-- tournaments: public read, editor writes.
drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read on public.tournaments
  for select using (true);

drop policy if exists tournaments_editor_insert on public.tournaments;
create policy tournaments_editor_insert on public.tournaments
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists tournaments_editor_update on public.tournaments;
create policy tournaments_editor_update on public.tournaments
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists tournaments_editor_delete on public.tournaments;
create policy tournaments_editor_delete on public.tournaments
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- calendar_events: public read, editor writes.
drop policy if exists calendar_events_public_read on public.calendar_events;
create policy calendar_events_public_read on public.calendar_events
  for select using (true);

drop policy if exists calendar_events_editor_insert on public.calendar_events;
create policy calendar_events_editor_insert on public.calendar_events
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists calendar_events_editor_update on public.calendar_events;
create policy calendar_events_editor_update on public.calendar_events
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists calendar_events_editor_delete on public.calendar_events;
create policy calendar_events_editor_delete on public.calendar_events
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- games: public read; editor OR scorekeeper insert/update; editor-only delete.
drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games
  for select using (true);

drop policy if exists games_scoring_insert on public.games;
create policy games_scoring_insert on public.games
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists games_scoring_update on public.games;
create policy games_scoring_update on public.games
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'))
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists games_editor_delete on public.games;
create policy games_editor_delete on public.games
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- game_innings: public read; editor OR scorekeeper insert/update/delete.
drop policy if exists game_innings_public_read on public.game_innings;
create policy game_innings_public_read on public.game_innings
  for select using (true);

drop policy if exists game_innings_scoring_insert on public.game_innings;
create policy game_innings_scoring_insert on public.game_innings
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_innings_scoring_update on public.game_innings;
create policy game_innings_scoring_update on public.game_innings
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'))
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_innings_scoring_delete on public.game_innings;
create policy game_innings_scoring_delete on public.game_innings
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

-- game_player_stats: public read; editor OR scorekeeper insert/update; editor-only delete.
drop policy if exists game_player_stats_public_read on public.game_player_stats;
create policy game_player_stats_public_read on public.game_player_stats
  for select using (true);

drop policy if exists game_player_stats_scoring_insert on public.game_player_stats;
create policy game_player_stats_scoring_insert on public.game_player_stats
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_player_stats_scoring_update on public.game_player_stats;
create policy game_player_stats_scoring_update on public.game_player_stats
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'))
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_player_stats_editor_delete on public.game_player_stats;
create policy game_player_stats_editor_delete on public.game_player_stats
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
