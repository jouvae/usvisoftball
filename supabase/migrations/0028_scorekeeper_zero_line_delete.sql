-- 0028_scorekeeper_zero_line_delete.sql
-- Feature softball/schedule, polish (status.md "Polish backlog" — lineup removal trap).
--
-- The trap: a scorekeeper checks the whole roster on the Lineup tab (one all-zero stat line per
-- player), then realises someone did not play. 0026 made DELETE on game_player_stats
-- editor-only, so the scorekeeper could never take that player off again — the zero line stayed
-- and the player showed in the public box score as having played.
--
-- Fix: a second PERMISSIVE delete policy for `scorekeeper`, allowed ONLY for a line that records
-- nothing — every batting stat 0 AND every pitching column NULL (did not pitch) or 0. A line
-- with any stat stays editor-only to remove (stats are cleared first, which is an audited UPDATE
-- path). Postgres ORs permissive policies, so editors keep `game_player_stats_editor_delete`
-- unchanged. The USING clause is evaluated against the CURRENT row, so a concurrent update that
-- adds a stat makes the row invisible to this policy and the delete affects 0 rows (the app
-- reports that as a refusal — lib/scoring.ts LineupRemovalRefused).
--
-- The `authenticated` DELETE grant already exists (0026); this only widens RLS.
--
-- ADDITIVE + REPLAYABLE (drop-if-exists, then create):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/0028_scorekeeper_zero_line_delete.sql

drop policy if exists game_player_stats_scorekeeper_zero_delete on public.game_player_stats;
create policy game_player_stats_scorekeeper_zero_delete on public.game_player_stats
  for delete to authenticated
  using (
    public.has_role(auth.uid(), 'scorekeeper')
    and ab = 0 and r = 0 and h = 0 and doubles = 0 and triples = 0 and hr = 0
    and rbi = 0 and bb = 0 and so = 0 and sb = 0
    and coalesce(outs_pitched, 0) = 0
    and coalesce(p_h, 0) = 0
    and coalesce(p_r, 0) = 0
    and coalesce(p_er, 0) = 0
    and coalesce(p_bb, 0) = 0
    and coalesce(p_so, 0) = 0
  );
