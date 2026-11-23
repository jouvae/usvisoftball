-- 0029_home_feed.sql
-- Feature softball/home-feed (docs/features/softball/home-feed/overview.md §2): the ESPN-style
-- home feed's highlights rail + recap score bars.
--
--   1. articles.game_id — an editor links a recap to the game it covers (score bar on the card).
--   2. home_highlights — the text-only rail. `manual` rows are editor-written (en + es);
--      `game_final` rows are created by a trigger when a USVI game goes final and carry only the
--      game id: the line ("Puerto Rico 10, U.S. Virgin Islands 9") is rendered from the game at
--      read time, localized, so a later score correction never leaves stale text behind.
--
-- Boundary: anon/authenticated SELECT published highlights; editors (has_role 'editor') read all
-- and INSERT/UPDATE/DELETE — the 0023 home_stats pattern. The trigger is SECURITY DEFINER so a
-- scorekeeper's "Final" tap creates the row without the scorekeeper holding any highlight grant.
--
-- ADDITIVE + REPLAYABLE:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0029_home_feed.sql

create extension if not exists pgcrypto;

-- ── articles.game_id ────────────────────────────────────────────────────────────
alter table public.articles
  add column if not exists game_id uuid references public.games(id) on delete set null;

create index if not exists idx_articles_game on public.articles (game_id) where game_id is not null;

-- Keyset paging for the feed: published newest-first, id as the tiebreak.
create index if not exists idx_articles_published_feed
  on public.articles (published_at desc, id desc) where status = 'published';

-- ── home_highlights ─────────────────────────────────────────────────────────────
create table if not exists public.home_highlights (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'manual',
  text_en      text not null default '',
  text_es      text not null default '',
  link_url     text,
  game_id      uuid references public.games(id) on delete cascade,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint home_highlights_kind_check check (kind in ('manual', 'game_final')),
  constraint home_highlights_manual_text check (
    kind <> 'manual'
    or (char_length(text_en) between 1 and 200 and char_length(text_es) between 1 and 200)
  ),
  constraint home_highlights_final_game check (kind <> 'game_final' or game_id is not null),
  -- https:// or a site path ("/events/…"); never protocol-relative ("//host").
  constraint home_highlights_link check (
    link_url is null or link_url like 'https://%' or (link_url like '/%' and link_url not like '//%')
  )
);

create unique index if not exists uq_home_highlights_game_final
  on public.home_highlights (game_id) where kind = 'game_final';
create index if not exists idx_home_highlights_published
  on public.home_highlights (published_at desc) where is_published;

drop trigger if exists home_highlights_set_updated_at on public.home_highlights;
create trigger home_highlights_set_updated_at
  before update on public.home_highlights
  for each row execute function public.set_updated_at();

alter table public.home_highlights enable row level security;

revoke all on public.home_highlights from anon, authenticated;
grant select on public.home_highlights to anon, authenticated;
grant insert, update, delete on public.home_highlights to authenticated;

drop policy if exists home_highlights_public_read on public.home_highlights;
create policy home_highlights_public_read on public.home_highlights
  for select
  using (is_published);

drop policy if exists home_highlights_editor_read on public.home_highlights;
create policy home_highlights_editor_read on public.home_highlights
  for select to authenticated
  using (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_highlights_editor_insert on public.home_highlights;
create policy home_highlights_editor_insert on public.home_highlights
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_highlights_editor_update on public.home_highlights;
create policy home_highlights_editor_update on public.home_highlights
  for update to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

drop policy if exists home_highlights_editor_delete on public.home_highlights;
create policy home_highlights_editor_delete on public.home_highlights
  for delete to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- ── auto highlight when a USVI game goes final ──────────────────────────────────
-- Fires on insert too (a seed can load a game already final).
create or replace function public.games_final_highlight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.state = 'final' and exists (
      select 1 from public.teams t
      where t.id in (new.away_team_id, new.home_team_id) and t.country_code = 'VI'
    ) then
      insert into public.home_highlights (kind, game_id)
      values ('game_final', new.id)
      on conflict (game_id) where kind = 'game_final' do nothing;
    end if;
  elsif new.state = 'final' and old.state is distinct from 'final' then
    if exists (
      select 1 from public.teams t
      where t.id in (new.away_team_id, new.home_team_id) and t.country_code = 'VI'
    ) then
      insert into public.home_highlights (kind, game_id)
      values ('game_final', new.id)
      on conflict (game_id) where kind = 'game_final' do nothing;
    end if;
  elsif old.state = 'final' and new.state is distinct from 'final' then
    delete from public.home_highlights where kind = 'game_final' and game_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.games_final_highlight() from public, anon, authenticated;

drop trigger if exists games_final_highlight on public.games;
create trigger games_final_highlight
  after insert or update of state on public.games
  for each row execute function public.games_final_highlight();

-- Backfill: every USVI game already final, dated when it ended.
insert into public.home_highlights (kind, game_id, published_at)
select 'game_final', g.id, coalesce(e.ends_at, e.starts_at + interval '2 hours')
from public.games g
join public.calendar_events e on e.id = g.event_id
where g.state = 'final'
  and exists (
    select 1 from public.teams t
    where t.id in (g.away_team_id, g.home_team_id) and t.country_code = 'VI'
  )
on conflict (game_id) where kind = 'game_final' do nothing;
