-- 0001_articles.sql
-- Slice 02 (scenario init-web-001): public news feed.
--
-- Creates the `articles` table under a TWO-LAYER database boundary:
--   1. GRANTs bound what is reachable at all — the public role holds SELECT only
--      (all other verbs, including TRUNCATE, are revoked; see the grants section
--      for why TRUNCATE specifically must be revoked and not left to RLS).
--   2. RLS bounds which rows a reachable verb sees — anon/authenticated SELECT is
--      policy-narrowed to `status = 'published'`.
-- Together these make init-web-002 ("drafts never leak") true at the DATABASE level:
-- drafts / in_review / unpublished rows are invisible to the public role. A
-- `.eq('status','published')` filter in application code is a convenience, NOT the
-- security boundary; the grant + policy are.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_articles.sql

-- gen_random_uuid() lives in pgcrypto (already present on Supabase, but be explicit).
create extension if not exists pgcrypto;

create table if not exists public.articles (
    id              uuid        primary key default gen_random_uuid(),
    title           text        not null,
    slug            text        not null unique,
    body            text        not null default '',
    excerpt         text,
    cover_image_url text,
    cover_image_alt text,
    -- Denormalized byline for this slice. A real author FK (author_id -> public.users)
    -- arrives with Supabase Auth in a later slice (see init-e2e-003..005). We store the
    -- display string now so the public feed can render a byline WITHOUT a users table
    -- or a join existing yet. When auth lands, add author_id and backfill; author_name
    -- stays as the denormalized display value (editorial bylines are not always a 1:1
    -- map to an account anyway).
    author_name     text        not null,
    category        text        not null,
    -- CHECK constraint (not a Postgres ENUM) for status/source. Rationale: the article
    -- lifecycle is still being designed (draft->in_review->published->unpublished and
    -- future states). A CHECK is edited with a plain, idempotent ALTER TABLE; a Postgres
    -- enum requires ALTER TYPE ... ADD VALUE (cannot run in a transaction pre-PG12 nuance,
    -- values cannot be removed/reordered), which fights the "replayable migration" goal.
    -- Text + CHECK also maps cleanly to PostgREST/supabase-js string filters.
    status          text        not null default 'draft'
                        check (status in ('draft', 'in_review', 'published', 'unpublished')),
    source          text        not null default 'human'
                        check (source in ('human', 'ai')),
    published_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- A published row MUST have a published_at. Otherwise a published row with a NULL
-- published_at sorts NULLS FIRST under `order by published_at desc` and jumps to the
-- top of the feed. Enforce `status = 'published' => published_at is not null` at the DB.
-- Replayable: drop-if-exists then add, so a second run does not error on a duplicate
-- constraint. (ADD CONSTRAINT ... IF NOT EXISTS is not supported for CHECK constraints,
-- so we guard by dropping first.)
alter table public.articles
    drop constraint if exists articles_published_requires_published_at;
alter table public.articles
    add constraint articles_published_requires_published_at
    check (status <> 'published' or published_at is not null);

-- Feed query is exactly: WHERE status = 'published' ORDER BY published_at DESC.
-- A PARTIAL index on (published_at desc) filtered to published rows matches that
-- predicate and ordering precisely and stays small as drafts accumulate.
create index if not exists articles_published_feed_idx
    on public.articles (published_at desc)
    where status = 'published';

-- Keep updated_at honest on every UPDATE (created_at/updated_at both default now()
-- on insert; this trigger only maintains updates). Included rather than omitted
-- because slices 05-07 (admin editor) will UPDATE rows frequently.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row
  execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- ENABLE turns RLS on. FORCE also subjects the table OWNER to policies (defense in
-- depth). Neither affects `service_role`, which has BYPASSRLS — so the secret-key
-- admin client (createArticle / seed) still writes freely. The publishable-key
-- client runs as `anon`/`authenticated` and is fully policy-bound.
alter table public.articles enable row level security;
alter table public.articles force  row level security;

-- PostgREST needs a table-level grant IN ADDITION to a permissive policy; the two are
-- layered controls, not redundant: the GRANT bounds which verbs are reachable at all,
-- RLS bounds which rows a reachable verb sees.
--
-- Supabase's default privileges grant ALL on new public-schema tables to anon/authenticated.
-- RLS default-deny covers INSERT/UPDATE/DELETE, but NOT TRUNCATE: Postgres row security does
-- not apply to TRUNCATE, which is gated only by the table privilege. anon is the publishable
-- key and ships in the browser bundle. Revoke first, then grant back exactly what the public
-- read path needs, so the table's privileges match this migration's stated security model.
-- (revoke all is idempotent, keeping the migration replayable. service_role is intentionally
-- omitted: it has BYPASSRLS and Supabase's defaults already cover it.)
revoke all on public.articles from anon, authenticated;
grant select on public.articles to anon, authenticated;

drop policy if exists articles_public_read_published on public.articles;
create policy articles_public_read_published
  on public.articles
  for select
  to anon, authenticated
  using (status = 'published');

-- No INSERT/UPDATE/DELETE policy for anon/authenticated => default-deny. Writes are
-- only possible through a BYPASSRLS role (the secret-key admin client). Inserting a
-- draft is deliberately NOT a public capability.
