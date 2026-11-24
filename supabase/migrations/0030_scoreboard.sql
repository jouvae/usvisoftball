-- 0030_scoreboard.sql
--
-- Feature softball/scoreboard — the data behind the article/event Scoreboard.
--
-- ADDITIVE ONLY (the database is shared with production): new nullable columns on games and
-- one new table. Replayable (`if not exists` / `drop … if exists`).
--
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0030_scoreboard.sql
--
-- 1. games.away_runs / home_runs — a FINAL SCORE WITHOUT AN INNING BREAKDOWN. Federation
--    results often arrive as "8–5" with no line score. When game_innings has cells for the
--    game, runs are still derived from them (the innings win); these columns are only read
--    when there are no innings (lib/schedule-view.ts gameRunTotals).
-- 2. games.away_walks / home_walks — walks DRAWN by that side's batters.
--    games.away_strikeouts / home_strikeouts — strikeouts recorded BY that side's pitchers.
--    Nullable: null = not recorded (hidden), unlike hits/errors which default to 0.
-- 3. game_standouts — editor-picked standouts for a game: Player of the Game, pitching
--    standout, other standouts. Player names are text (the U18 roster isn't in team_players
--    yet); team_id says which side. Public read; editor OR scorekeeper insert/update;
--    editor-only delete (mirrors game_player_stats, 0026).

-- ── 1 + 2. games: optional totals ──────────────────────────────────────────────
alter table public.games
  add column if not exists away_runs        int,
  add column if not exists home_runs        int,
  add column if not exists away_walks       int,
  add column if not exists home_walks       int,
  add column if not exists away_strikeouts  int,
  add column if not exists home_strikeouts  int;

alter table public.games drop constraint if exists games_scoreboard_totals_check;
alter table public.games
  add constraint games_scoreboard_totals_check check (
    coalesce(away_runs, 0) >= 0 and coalesce(home_runs, 0) >= 0
    and coalesce(away_walks, 0) >= 0 and coalesce(home_walks, 0) >= 0
    and coalesce(away_strikeouts, 0) >= 0 and coalesce(home_strikeouts, 0) >= 0
  );

-- ── 3. game_standouts ───────────────────────────────────────────────────────────
create table if not exists public.game_standouts (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete cascade,
  team_id      uuid references public.teams(id) on delete restrict,
  kind         text not null default 'standout',
  player_name  text not null,
  stat_line    text not null default '',
  note         text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint game_standouts_kind_check check (kind in ('player_of_game', 'pitching', 'standout')),
  constraint game_standouts_name_check check (length(btrim(player_name)) between 1 and 80),
  constraint game_standouts_line_check check (length(stat_line) <= 120),
  constraint game_standouts_note_check check (length(note) <= 240)
);

create index if not exists game_standouts_game_idx on public.game_standouts (game_id, sort_order);

-- One Player of the Game and one pitching standout per game.
create unique index if not exists game_standouts_one_award_idx
  on public.game_standouts (game_id, kind) where kind in ('player_of_game', 'pitching');

drop trigger if exists game_standouts_set_updated_at on public.game_standouts;
create trigger game_standouts_set_updated_at
  before update on public.game_standouts
  for each row execute function public.set_updated_at();

alter table public.game_standouts enable row level security;
revoke all on public.game_standouts from anon, authenticated;
grant select on public.game_standouts to anon, authenticated;
grant insert, update, delete on public.game_standouts to authenticated;

drop policy if exists game_standouts_public_read on public.game_standouts;
create policy game_standouts_public_read on public.game_standouts
  for select using (true);

drop policy if exists game_standouts_scoring_insert on public.game_standouts;
create policy game_standouts_scoring_insert on public.game_standouts
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_standouts_scoring_update on public.game_standouts;
create policy game_standouts_scoring_update on public.game_standouts
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'))
  with check (public.has_role(auth.uid(), 'editor') or public.has_role(auth.uid(), 'scorekeeper'));

drop policy if exists game_standouts_editor_delete on public.game_standouts;
create policy game_standouts_editor_delete on public.game_standouts
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
