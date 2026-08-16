-- 0016_team_players_admin.sql
-- Feature softball/teams, Slice 4 (teams-e2e-004): team roster (player) admin CRUD.
--
-- Adds editor WRITE to team_players (0014 shipped read-only), mirroring 0012/0015:
-- grant insert/update/delete to `authenticated`, gate each with
-- public.has_role(auth.uid(),'editor'). Player photos reuse the board-photos bucket
-- (0009, editor-only write). Players belong to a team (FK on delete cascade, 0014) — no
-- permanence guard; an editor fully manages any team's roster.
--
-- Additive + replayable.
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0016_team_players_admin.sql

grant insert, update, delete on public.team_players to authenticated;

drop policy if exists team_players_editor_insert on public.team_players;
create policy team_players_editor_insert on public.team_players
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists team_players_editor_update on public.team_players;
create policy team_players_editor_update on public.team_players
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists team_players_editor_delete on public.team_players;
create policy team_players_editor_delete on public.team_players
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
