-- 0009_board_photos_storage.sql
-- Feature softball/about, Slice 3 (about-e2e-007/008): real board-member photo uploads.
--
-- Stands up a Supabase STORAGE bucket for board headshots and the RLS on storage.objects
-- that mirrors the table-side editorial boundary (0007): anyone may READ (the bucket is
-- public — headshots are public info and /about renders them via next/image), but only an
-- 'editor' may WRITE (insert/update/delete). Contributors and anon cannot upload.
--
-- The app uploads through the editor SESSION client (createSupabaseServerClient), so these
-- policies are the real boundary — there is no service-key path on the upload flow. Object
-- keys are server-generated randoms (no client filename), and the Server Action validates
-- content-type (jpeg/png/webp only — SVG rejected), size (<= 2 MB), before the upload ever
-- reaches Storage. next.config images.remotePatterns is the paired render-side change.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0009_board_photos_storage.sql

-- The bucket. Public so the object's /storage/v1/object/public/board-photos/<key> URL is
-- served without a signed token (public read); still write-guarded by the policies below.
insert into storage.buckets (id, name, public)
values ('board-photos', 'board-photos', true)
on conflict (id) do update set public = excluded.public;

-- storage.objects already has RLS enabled by Supabase; add per-bucket policies.

-- READ: anyone (anon + authenticated) may select objects in this bucket. (Public buckets
-- also serve the /object/public/ path without RLS; this covers the authenticated API too.)
drop policy if exists "board_photos_public_read" on storage.objects;
create policy "board_photos_public_read" on storage.objects
  for select
  using (bucket_id = 'board-photos');

-- WRITE: editor only. INSERT/UPDATE/DELETE all require public.has_role(auth.uid(),'editor'),
-- exactly like the board_members table policies (0007) — a contributor/anon is default-deny.
drop policy if exists "board_photos_editor_insert" on storage.objects;
create policy "board_photos_editor_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'board-photos' and public.has_role(auth.uid(), 'editor'));

drop policy if exists "board_photos_editor_update" on storage.objects;
create policy "board_photos_editor_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'board-photos' and public.has_role(auth.uid(), 'editor'))
  with check (bucket_id = 'board-photos' and public.has_role(auth.uid(), 'editor'));

drop policy if exists "board_photos_editor_delete" on storage.objects;
create policy "board_photos_editor_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'board-photos' and public.has_role(auth.uid(), 'editor'));
