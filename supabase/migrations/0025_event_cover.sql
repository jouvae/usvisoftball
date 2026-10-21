-- 0025_event_cover.sql
-- Feature softball/home-layout, Slice 5: a cover photo for the home "Upcoming Event" band
-- (design guide §2.4, §4.3). '' → the band's no-photo variant. Same shape/allowlist as
-- events.logo_url (local /public path or board-photos Storage URL, enforced by the app).
--
-- Additive + replayable:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0025_event_cover.sql

alter table public.events
  add column if not exists cover_image_url text not null default '';
