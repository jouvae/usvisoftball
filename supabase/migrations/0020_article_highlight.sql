-- 0020_article_highlight.sql
-- MVP slice 4 (home rebuild): editor-curated highlights on the home page.
--
-- Adds `is_highlight boolean not null default false` to public.articles. An editor
-- toggles it from the review desk; the public home page lists published + highlighted
-- rows in its highlights carousel. Highlight is ORTHOGONAL to status: only PUBLISHED
-- highlighted rows surface publicly (the app filters status='published' AND
-- is_highlight), so marking a draft as highlight is harmless — it simply does not show
-- until the article is published.
--
-- The 0004 articles_editor_update policy is ROW-level (has_role editor, no column
-- restriction), so an editor may write this new column with no new policy; anon already
-- holds table-level SELECT (0001), so the public highlights read can filter on it.
-- BUT editor-write-permitted is NOT the same as editor-write-ONLY: the 0003 contributor
-- UPDATE policy + the un-column-restricted `authenticated` UPDATE grant would let a
-- contributor set is_highlight on their own draft (red-team-code, slice 4). The
-- editor-ONLY guarantee is enforced by the BEFORE UPDATE trigger in
-- 0021_highlight_editor_only.sql — apply BOTH. ADDITIVE + REPLAYABLE. Applied out-of-band:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0020_article_highlight.sql

alter table public.articles
    add column if not exists is_highlight boolean not null default false;

-- Partial index for the public highlights read (status='published' AND is_highlight,
-- newest first). Tiny + write-cheap: only the curated highlight rows are indexed.
create index if not exists articles_highlight_published_idx
    on public.articles (published_at desc)
    where status = 'published' and is_highlight;
