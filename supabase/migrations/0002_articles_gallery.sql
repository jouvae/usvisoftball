-- 0002_articles_gallery.sql
-- Slice 03 (scenario init-web-002): public article page /news/[slug].
--
-- Adds a `gallery` column to public.articles: an ordered list of images rendered
-- beneath the article body on the public article page. Element shape is
--   [{ "url": string, "alt": string }]
--
-- This migration adds exactly ONE column and ONE CHECK constraint. It deliberately
-- makes NO grant and NO RLS/policy change — see the closing note for why the gallery
-- rides the existing SELECT-only grant + published-only row policy from 0001.
--
-- Applied out-of-band by a human; NEVER from application code:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_articles_gallery.sql
--
-- Replayable: safe to run more than once (add-column-if-not-exists + drop-then-add
-- the constraint), matching 0001's idempotent style.

-- The gallery column. Modeled as jsonb (not a normalized child table) on purpose:
-- the gallery is a small, ordered, read-mostly list that is always rendered wholesale
-- with its article and is NEVER queried across articles, so a media table would add
-- joins for a query we never run this slice. (A real MediaAsset upload pipeline —
-- docs/entities.md § MediaAsset — is explicitly out of scope; see the slice contract.)
--
-- NOT NULL DEFAULT '[]' so every existing row, and every INSERT that omits gallery,
-- carries a well-formed empty array. The renderer can then always `.map()` the value
-- with no null guard, and an "empty gallery" is a first-class state (a published
-- article with gallery = [] renders fine, with no gallery section) rather than null.
-- `add column if not exists` keeps the migration replayable.
alter table public.articles
    add column if not exists gallery jsonb not null default '[]'::jsonb;

-- Shape guard: gallery MUST be a JSON array. This is the ONE invariant the article
-- page depends on — it iterates the value, so an object or a scalar here would break
-- rendering. The guard stops at "is an array" and does NOT validate each element
-- ({ url, alt }) at the database, on purpose:
--   * The ONLY write path is createArticle() through the BYPASSRLS admin client
--     (anon/authenticated have no INSERT/UPDATE — default-deny from 0001), and its
--     typed CreateArticleInput already constrains elements to { url, alt } at the
--     application boundary. There is no untrusted writer to defend against here.
--   * A per-element CHECK would need a plpgsql / jsonpath expression that is harder
--     to keep replayable and readable, and would be redundant with the typed path.
--   * array-vs-non-array is the only distinction that actually crashes the page; a
--     missing/extra element key degrades to a broken <img>, not a 500.
-- Replayable: drop-if-exists then add. (ADD CONSTRAINT ... IF NOT EXISTS is not
-- supported for CHECK constraints, so we guard by dropping first — exactly as 0001
-- does for articles_published_requires_published_at.)
alter table public.articles
    drop constraint if exists articles_gallery_is_array;
alter table public.articles
    add constraint articles_gallery_is_array
    check (jsonb_typeof(gallery) = 'array');

-- ── No grant / RLS / policy change is required — and here is precisely why ─────
-- 1. GRANTS: 0001 granted WHOLE-TABLE select (`grant select on public.articles to
--    anon, authenticated`), not a column-list grant. A whole-table SELECT privilege
--    automatically extends to columns added later, so `gallery` is readable under the
--    exact same grant with no new statement. (Had 0001 used a column-level grant like
--    `grant select (title, slug, ...)`, a new column would NOT be auto-covered — it
--    did not, so we are fine.)
-- 2. RLS: the `articles_public_read_published` policy gates ROWS, not columns
--    (`using (status = 'published')`). A draft / in_review / unpublished row's gallery
--    is invisible to the public role for exactly the same reason its title is — the
--    entire row is filtered out before any column is returned. Adding a column creates
--    no new row-visibility surface, so no policy change is warranted.
-- Net: the "drafts never leak" guarantee of init-web-002 already covers the gallery
-- the moment it is a column on this table. Nothing else to do.
