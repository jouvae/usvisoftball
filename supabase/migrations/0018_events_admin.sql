-- 0018_events_admin.sql
-- Feature softball/events, Slice 3 (events-e2e-003): events admin CRUD.
--
-- Adds editor WRITE to the events table (0017 shipped read-only), mirroring 0015 for teams:
-- grant insert/update/delete to `authenticated`, gate each with
-- public.has_role(auth.uid(),'editor'). Event logos reuse the board-photos bucket (0009,
-- editor-only write). No child table yet, so nothing cascades.
--
-- Additive + replayable (drop-then-create policies; grants idempotent).
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0018_events_admin.sql

grant insert, update, delete on public.events to authenticated;

drop policy if exists events_editor_insert on public.events;
create policy events_editor_insert on public.events
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists events_editor_update on public.events;
create policy events_editor_update on public.events
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists events_editor_delete on public.events;
create policy events_editor_delete on public.events
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
