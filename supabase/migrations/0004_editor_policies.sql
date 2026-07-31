-- 0004_editor_policies.sql
-- Slice 06 (scenario init-e2e-005): editor reviews, edits, and publishes.
--
-- Adds two NEW permissive RLS policies on public.articles, both `to authenticated`
-- and both gated by public.has_role(auth.uid(),'editor'):
--   * articles_editor_read_all — SELECT any row (the editor-wide review queue)
--   * articles_editor_update    — UPDATE any row (edit the body + transition status)
--
-- ADDITIVE and REPLAYABLE (drop-then-create), matching 0001/0002/0003. Applied
-- out-of-band by a human; NEVER from application code (API keys reach PostgREST,
-- DDL is not exposed over HTTP):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0004_editor_policies.sql
--
-- No grant change: `authenticated` already holds SELECT (0001) + INSERT, UPDATE
-- (0003); the editor path is UPDATE + SELECT only. anon stays SELECT-only, so the
-- 0001 anon published-only read is UNTOUCHED (init-web-001/002 cannot regress).
-- No editor INSERT/DELETE policy — default-deny stands; editors transition existing
-- rows, they do not create or hard-delete articles here.

-- ── Editor SELECT-any ───────────────────────────────────────────────────────────
-- A THIRD permissive SELECT policy (after 0001 anon/auth published-read and 0003
-- contributor own-read). Permissive policies are OR-combined, so for an
-- authenticated caller the effective SELECT predicate becomes:
--     status = 'published'                       (0001, to anon+authenticated)
--  OR author_id = auth.uid()                     (0003, to authenticated)
--  OR public.has_role(auth.uid(), 'editor')      (this, to authenticated)
-- An EDITOR therefore sees EVERY article (draft/in_review/published/unpublished).
-- anon is UNTOUCHED (this policy is `to authenticated`), and the contributor
-- own-read is unchanged.
drop policy if exists articles_editor_read_all on public.articles;
create policy articles_editor_read_all
  on public.articles
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'editor'));

-- ── Editor UPDATE-any ───────────────────────────────────────────────────────────
-- USING gates WHICH rows an editor may update: ANY row (no author_id / no status
-- restriction). WITH CHECK gates the RESULT row: it need only re-assert the editor
-- role. The set of legal statuses and the `published => published_at is not null`
-- invariant are already enforced by the 0001 TABLE CHECKs for EVERY writer, so they
-- are not duplicated here. This policy therefore PERMITS published AND unpublished
-- (forward-correct for slice 08) with zero extra predicates. Permissive OR-
-- composition leaves the contributor "cannot publish" barrier intact: a contributor
-- targeting status='published' passes NEITHER UPDATE WITH CHECK (their own requires
-- status in draft/in_review; this one requires the editor role they lack).
drop policy if exists articles_editor_update on public.articles;
create policy articles_editor_update
  on public.articles
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));
