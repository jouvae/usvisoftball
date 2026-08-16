-- 0015_teams_admin.sql
-- Feature softball/teams, Slice 3 (teams-e2e-003): teams admin CRUD.
--
-- Adds editor WRITE to the teams table (0013 shipped read-only), mirroring 0012 for
-- committees: grant insert/update/delete to `authenticated`, gate each with
-- public.has_role(auth.uid(),'editor'). Deleting a team cascades its team_players (FK
-- on delete cascade, 0014). Team logos reuse the existing board-photos bucket (0009,
-- already editor-only write). Player admin CRUD (team_players write) is a later slice.
--
-- Additive + replayable (drop-then-create policies; grants idempotent).
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0015_teams_admin.sql

grant insert, update, delete on public.teams to authenticated;

drop policy if exists teams_editor_insert on public.teams;
create policy teams_editor_insert on public.teams
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists teams_editor_update on public.teams;
create policy teams_editor_update on public.teams
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists teams_editor_delete on public.teams;
create policy teams_editor_delete on public.teams
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
