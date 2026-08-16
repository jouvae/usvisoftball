-- 0017_events.sql
-- Feature softball/events, Slice 1 (events-web-001): the public events directory.
--
-- One `events` table under the same read-only public boundary (SELECT-only grants + public
-- read RLS). Editor WRITE (events admin CRUD) lands with a later slice. `island` is nullable
-- (a territory-wide event has no single island) TEXT + CHECK over the three islands. Dates
-- are `date` (start/end); the /events page derives Upcoming vs Past from end_date relative
-- to the current date at render time. `logo_url` mirrors the photo_url shape for the future
-- CRUD photo-upload reuse.
--
-- ⚠️ SEED DATA IS CLEARLY-SAMPLE. The research (docs/research/domain-and-comparables.md)
-- flags that the real flagship-event name/date is UNVERIFIED and must be confirmed with the
-- federation before publishing. These rows use generic "Sample" naming + placeholder venues
-- so nothing is asserted as a real tournament result. An editor replaces them via the CRUD
-- slice. Dates are wide (2020 / 2099) so the Upcoming/Past split stays stable for testing.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0017_events.sql

create extension if not exists pgcrypto;

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text not null default '',
  venue        text not null default '',
  island       text,
  start_date   date,
  end_date     date,
  logo_url     text not null default '',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint events_island_check
    check (island is null or island in ('st_thomas', 'st_john', 'st_croix'))
);

create index if not exists idx_events_end_date on public.events (end_date);

-- RLS: PUBLIC READ ONLY this slice.
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (true);

-- Seed clearly-sample events (idempotent on slug). Wide dates keep the upcoming/past split
-- deterministic. NOT real tournament data — placeholder for the federation to replace.
insert into public.events (name, slug, description, venue, island, start_date, end_date, sort_order) values
  ('Sample Territorial Championship (Upcoming)', 'sample-territorial-championship',
   'Placeholder for the Federation''s flagship territorial championship — replace with the confirmed event and dates.',
   'Lionel Roberts Stadium', 'st_thomas', date '2099-06-01', date '2099-06-07', 10),
  ('Sample Inter-Island Cup (Upcoming)', 'sample-inter-island-cup',
   'Placeholder inter-island tournament across St. Thomas, St. John, and St. Croix.',
   'Multiple venues', null, date '2099-08-15', date '2099-08-18', 20),
  ('Sample Youth Classic (Past)', 'sample-youth-classic',
   'Placeholder past youth development tournament — replace with a real edition.',
   'Canegata Ballpark', 'st_croix', date '2020-04-10', date '2020-04-12', 30)
on conflict (slug) do nothing;
