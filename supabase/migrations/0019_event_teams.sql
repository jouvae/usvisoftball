-- 0019_event_teams.sql
-- Feature softball/events, Slice 4 (events-web-004): participating teams per event.
--
-- A many-to-many join between events and teams. Read-only public boundary (SELECT-only
-- grants + public read RLS); editor WRITE (attach/detach) lands with a later slice. Composite
-- PK (event_id, team_id) prevents a team being listed twice on one event. Both FKs cascade,
-- so deleting an event or a team drops the link (never orphans a join row). `sort_order`
-- orders the participants on the event detail page.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0019_event_teams.sql

create table if not exists public.event_teams (
  event_id   uuid not null references public.events(id) on delete cascade,
  team_id    uuid not null references public.teams(id)  on delete cascade,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (event_id, team_id)
);

create index if not exists idx_event_teams_event on public.event_teams (event_id);

-- RLS: PUBLIC READ ONLY this slice.
alter table public.event_teams enable row level security;
revoke all on public.event_teams from anon, authenticated;
grant select on public.event_teams to anon, authenticated;

drop policy if exists event_teams_public_read on public.event_teams;
create policy event_teams_public_read on public.event_teams
  for select using (true);

-- Seed participation links, resolving both ids by slug (idempotent on the composite PK).
insert into public.event_teams (event_id, team_id, sort_order)
select e.id, t.id, x.sort
from (values
  ('sample-territorial-championship', 'frenchtown-sluggers',    10),
  ('sample-territorial-championship', 'charlotte-amalie-storm', 20),
  ('sample-territorial-championship', 'christiansted-crushers', 30),
  ('sample-inter-island-cup',         'frenchtown-sluggers',    10),
  ('sample-inter-island-cup',         'cruz-bay-waves',         20),
  ('sample-inter-island-cup',         'christiansted-crushers', 30),
  ('sample-inter-island-cup',         'frederiksted-fire',      40),
  ('sample-youth-classic',            'frederiksted-fire',      10),
  ('sample-youth-classic',            'cruz-bay-waves',         20)
) as x(event_slug, team_slug, sort)
join public.events e on e.slug = x.event_slug
join public.teams  t on t.slug = x.team_slug
on conflict (event_id, team_id) do nothing;
