-- 0005_ai_provenance.sql
-- Slice 09 (scenario init-e2e-007): AI draft, generated for review and NEVER auto-published.
--
-- Realizes Article.ai_provenance (docs/entities.md §Content/Editorial) as a nullable
-- jsonb on public.articles, a table CHECK making provenance MANDATORY for AI rows, and a
-- SEPARATE permissive INSERT policy articles_ai_draft_insert. The new policy COEXISTS
-- with the slice-05 articles_contributor_insert (each pins its own source; permissive
-- policies OR-combine) — so the "never auto-published" safety property is enforced AT THE
-- DATABASE: an AI row cannot be INSERTed at any status other than 'draft'.
--
-- ADDITIVE and REPLAYABLE (add-column-if-not-exists, drop-then-add for the CHECK/policy),
-- matching 0001/0002/0003/0004. Applied out-of-band by a human; NEVER from application
-- code (API keys reach PostgREST, DDL is not exposed over HTTP):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0005_ai_provenance.sql
--
-- No grant change: `authenticated` already holds SELECT (0001) + INSERT, UPDATE (0003);
-- the AI path is INSERT + the existing own-read/editor-read SELECT for the RETURNING
-- re-read. anon stays SELECT-only, so the 0001 anon published-only read is UNTOUCHED
-- (init-web-001/002 cannot regress). No DELETE. The slice-05 articles_contributor_insert
-- (source='human') is NOT touched — its source pin must stay so init-e2e-004 stays a
-- genuine negative.

-- ── Article.ai_provenance — nullable jsonb ─────────────────────────────────────────
-- Nullable because EVERY existing row (and every human draft) has source='human' and
-- carries no provenance. Shape written by the app: { "source": <selected>, "model": "stub" }.
alter table public.articles
    add column if not exists ai_provenance jsonb;

-- ── table CHECK — an AI article MUST carry provenance ──────────────────────────────
-- The scenario's own invariant ("with stored ai_provenance"). A table-wide backstop that
-- holds for EVERY writer (session client, admin/seed, a future write path) — strictly
-- stronger than the RLS WITH CHECK alone (RLS is bypassed by the service role; the table
-- CHECK is not). drop-then-add (ADD CONSTRAINT ... IF NOT EXISTS is unsupported for CHECK,
-- the idiom 0001 uses for articles_published_requires_published_at). Safe on existing
-- data: every current row is source='human', so `source <> 'ai'` is TRUE and the row
-- passes regardless of provenance — nothing in slices 01-08 regresses.
alter table public.articles
    drop constraint if exists articles_ai_requires_provenance;
alter table public.articles
    add constraint articles_ai_requires_provenance
    check (source <> 'ai' or ai_provenance is not null);

-- ── articles_ai_draft_insert — a SEPARATE permissive INSERT policy ─────────────────
-- ADDITIVE to (and NOT a loosening of) the slice-05 articles_contributor_insert.
-- Permissive policies are OR-combined, so an INSERT succeeds iff it satisfies AT LEAST
-- ONE policy's WITH CHECK:
--   * articles_contributor_insert (0003): author_id=self AND contributor AND
--       status in (draft,in_review) AND source='human'
--   * articles_ai_draft_insert   (this): author_id=self AND status='draft' AND
--       source='ai' AND ai_provenance IS NOT NULL AND (contributor OR editor)
-- The two are DISJOINT on `source`: each pins its own provenance. An AI insert takes THIS
-- policy; a human insert takes the contributor policy. Neither can reach the other's shape.
--
-- status='draft' in THIS WITH CHECK is what guarantees "never auto-published": an AI
-- insert cannot name status='published'/'in_review'/'unpublished' and still pass any
-- policy (this one needs 'draft'; the contributor policy needs source='human'; the 0004
-- editor policy is UPDATE-only). The DB itself makes it IMPOSSIBLE to INSERT an ai row at
-- any status other than 'draft'.
drop policy if exists articles_ai_draft_insert on public.articles;
create policy articles_ai_draft_insert
  on public.articles
  for insert
  to authenticated
  with check (
        author_id = auth.uid()
    and status = 'draft'
    and source = 'ai'
    and ai_provenance is not null
    and (
          public.has_role(auth.uid(), 'contributor')
       or public.has_role(auth.uid(), 'editor')
    )
  );
