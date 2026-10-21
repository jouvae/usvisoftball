-- 0023_home_stats.sql
-- Feature softball/home-layout, Slice 4: the editor-managed home stats strip
-- (docs/features/softball/home-layout/design-guide.md §2.2, §4.1).
--
-- One `home_stats` table. Every stat has the same shape — label · short value · optional
-- detail · an "as of" date — so the strip never mixes a number with a sentence (assessment
-- C2). `as_of` is REQUIRED: a figure like a world ranking goes stale, and the strip always
-- prints its date. `source_url` (optional) lets the detail line link to the source; the app
-- validates it https-only on write AND at render. `is_published` defaults to FALSE: a new
-- figure stays off the public site until an editor has verified and published it.
--
-- Boundary: anon/authenticated may SELECT only published rows; editors (has_role 'editor')
-- may SELECT every row and INSERT/UPDATE/DELETE — same pattern as 0015/0018.
--
-- NO SEED ROWS — the strip stays hidden until real, verified figures are published.
--
-- Additive + replayable:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0023_home_stats.sql

create extension if not exists pgcrypto;

create table if not exists public.home_stats (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  value        text not null,
  detail       text not null default '',
  icon         text not null default 'trophy',
  as_of        date not null,
  source_url   text,
  sort_order   int  not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint home_stats_label_len  check (char_length(label) between 1 and 40),
  constraint home_stats_value_len  check (char_length(value) between 1 and 12),
  constraint home_stats_detail_len check (char_length(detail) <= 60),
  constraint home_stats_icon_check
    check (icon in ('trophy', 'medal', 'award', 'users', 'calendar', 'flag')),
  constraint home_stats_source_https
    check (source_url is null or source_url like 'https://%')
);

create index if not exists idx_home_stats_published_order
  on public.home_stats (is_published, sort_order);

alter table public.home_stats enable row level security;

revoke all on public.home_stats from anon, authenticated;
grant select on public.home_stats to anon, authenticated;
grant insert, update, delete on public.home_stats to authenticated;

drop policy if exists home_stats_public_read on public.home_stats;
create policy home_stats_public_read on public.home_stats
  for select
  using (is_published);

drop policy if exists home_stats_editor_read on public.home_stats;
create policy home_stats_editor_read on public.home_stats
  for select to authenticated
  using (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_stats_editor_insert on public.home_stats;
create policy home_stats_editor_insert on public.home_stats
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_stats_editor_update on public.home_stats;
create policy home_stats_editor_update on public.home_stats
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_stats_editor_delete on public.home_stats;
create policy home_stats_editor_delete on public.home_stats
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));
