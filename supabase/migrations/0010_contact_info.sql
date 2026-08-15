-- 0010_contact_info.sql
-- Feature softball/about, Slice 4 (about-e2e-009/010): editable federation contact info.
--
-- A SINGLETON row of contact fields (email, phone, mailing address, Facebook, Instagram)
-- shown in a Contact section on /about and edited from an editor-gated /admin/contact.
-- Same two-layer boundary proven in 0006/0007:
--   GRANT: anon/authenticated get SELECT only; authenticated additionally gets UPDATE
--          (the editor policy gates WHICH authenticated user may actually write). No
--          INSERT/DELETE grant — the singleton row is created here and never added/removed
--          through the API.
--   RLS:   public read (using true); UPDATE requires public.has_role(auth.uid(),'editor').
-- Social URLs are additionally validated in lib/contact.ts (https + host allowlist) before
-- they reach the DB — a defense-in-depth guard against javascript:/data:/open-redirect in
-- the rendered <a href>.
--
-- Singleton enforced structurally: `id boolean primary key default true check (id)` — the
-- PK admits only the value true, so at most one row can ever exist.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0010_contact_info.sql

create table if not exists public.contact_info (
  id            boolean primary key default true,
  email         text not null default '',
  phone         text not null default '',
  address       text not null default '',
  facebook_url  text not null default '',
  instagram_url text not null default '',
  updated_at    timestamptz not null default now(),
  constraint contact_info_singleton check (id)
);

-- Seed the singleton with placeholder federation contact (editable via /admin/contact).
insert into public.contact_info (id, email, phone, address, facebook_url, instagram_url)
values (
  true,
  'info@usvisoftball.vi',
  '(340) 774-0100',
  'P.O. Box 6400, Charlotte Amalie, St. Thomas, VI 00804',
  'https://www.facebook.com/usvisoftball',
  'https://www.instagram.com/usvisoftball'
)
on conflict (id) do nothing;

alter table public.contact_info enable row level security;

-- Supabase grants ALL on new public tables to anon/authenticated by default; revoke, then
-- grant back exactly what the RLS-enforced publishable key should reach.
revoke all on public.contact_info from anon, authenticated;
grant select on public.contact_info to anon, authenticated;
grant update on public.contact_info to authenticated;

drop policy if exists contact_info_public_read on public.contact_info;
create policy contact_info_public_read on public.contact_info
  for select
  using (true);

drop policy if exists contact_info_editor_update on public.contact_info;
create policy contact_info_editor_update on public.contact_info
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));
