-- 0027_scorekeeper_columns.sql
-- Feature softball/schedule, Slice S4 (overview.md §6.1): narrow what a SCOREKEEPER may change.
--
-- 0026 lets editor OR scorekeeper UPDATE games / game_player_stats, and the `authenticated`
-- UPDATE grant is table-wide. A permissive RLS WITH CHECK only sees the resulting row, never
-- OLD, so it cannot say "this column may not CHANGE unless editor". A BEFORE UPDATE trigger
-- comparing OLD vs NEW is the right tool (same posture as 0021):
--
--   games — a non-editor may change ONLY: state, current_inning, away_hits, away_errors,
--           home_hits, home_errors, updated_at. Everything else (event_id, away_team_id,
--           home_team_id, created_at, id, and ANY column added later) is editor-only. The
--           check is DENY-BY-DEFAULT: it diffs the whole row minus the allowlist, so a future
--           column is protected without touching this function.
--   game_player_stats — a non-editor may not change game_id, player_id, team_id (or id /
--           created_at). The stat columns themselves stay scorekeeper-writable.
--
-- Who is "trusted":
--   * editor (has_role(auth.uid(),'editor'))                   → allowed, full update
--   * auth.uid() IS NULL — service_role / admin client / psql   → allowed. These run with no
--     end-user JWT `sub` (the seed script uses the service-role key; migrations use the DB
--     owner). They are already RLS-bypassing, so the trigger adds nothing there; refusing
--     them would only break scripts/seed-panam.ts.
--   * any other authenticated caller (scorekeeper)              → restricted as above.
--   anon has no UPDATE grant at all (0026), so it never reaches here.
--
-- Trigger name order: Postgres fires same-timing triggers alphabetically, so
-- `games_scorekeeper_columns` runs before `games_set_updated_at`; updated_at is allowlisted
-- anyway, so order does not matter for correctness.
--
-- ADDITIVE + REPLAYABLE (create-or-replace fn + drop-then-create trigger):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/0027_scorekeeper_columns.sql

-- security definer + pinned search_path: has_role reads public.profiles regardless of the
-- caller; the fixed path forecloses a search-path hijack. auth.uid() is schema-qualified.
create or replace function public.enforce_games_scorekeeper_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed constant text[] := array[
    'state', 'current_inning',
    'away_hits', 'away_errors', 'home_hits', 'home_errors',
    'updated_at'
  ];
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'editor') then
    return new;
  end if;

  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'only an editor may change the teams or event of a game'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists games_scorekeeper_columns on public.games;
create trigger games_scorekeeper_columns
  before update on public.games
  for each row
  execute function public.enforce_games_scorekeeper_columns();

create or replace function public.enforce_stat_line_keys_editor_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'editor') then
    return new;
  end if;

  if new.id         is distinct from old.id
  or new.game_id    is distinct from old.game_id
  or new.player_id  is distinct from old.player_id
  or new.team_id    is distinct from old.team_id
  or new.created_at is distinct from old.created_at then
    raise exception 'only an editor may move a stat line to another game, player or team'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists game_player_stats_keys_editor_only on public.game_player_stats;
create trigger game_player_stats_keys_editor_only
  before update on public.game_player_stats
  for each row
  execute function public.enforce_stat_line_keys_editor_only();
