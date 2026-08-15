-- 0012_committees_admin.sql
-- Feature softball/about, Slice 6 (about-e2e-012/013): committees admin CRUD.
--
-- Adds editor WRITE to the committees tables (0011 shipped read-only), exactly like 0007
-- did for the board: grant insert/update/delete to `authenticated`, and gate each with
-- public.has_role(auth.uid(),'editor'). Committees are standing (not term-scoped), so there
-- is NO permanence guard here — a committee and its members are fully editor-mutable, and
-- deleting a committee cascades its members (FK on delete cascade, 0011). Member photos
-- reuse the existing board-photos bucket (0009, already editor-only write) — no new bucket.
--
-- Additive + replayable (drop-then-create policies; grants idempotent).
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0012_committees_admin.sql

grant insert, update, delete on public.committees        to authenticated;
grant insert, update, delete on public.committee_members to authenticated;

-- ── committees: editor insert / update / delete ──────────────────────────────
drop policy if exists committees_editor_insert on public.committees;
create policy committees_editor_insert on public.committees
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists committees_editor_update on public.committees;
create policy committees_editor_update on public.committees
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists committees_editor_delete on public.committees;
create policy committees_editor_delete on public.committees
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- ── committee_members: editor insert / update / delete ───────────────────────
drop policy if exists committee_members_editor_insert on public.committee_members;
create policy committee_members_editor_insert on public.committee_members
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists committee_members_editor_update on public.committee_members;
create policy committee_members_editor_update on public.committee_members
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists committee_members_editor_delete on public.committee_members;
create policy committee_members_editor_delete on public.committee_members
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
