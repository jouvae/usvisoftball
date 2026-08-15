-- 0007_about_admin.sql
-- Feature softball/about, Slice 2 (about-e2e-004..006): the ADMIN WRITE side —
-- an editor edits the mission, edits the CURRENT board roster, and rolls the board
-- to a new term. This is the CRUD half deliberately deferred by 0006 (see that
-- file's "TODO (admin CRUD slice — H2 permanence hardening)").
--
-- Same two-layer boundary proven in 0001/0003/0004:
--   1. GRANTs bound which verbs are reachable at all. 0006 left anon/authenticated
--      SELECT-only on all three tables; this migration grants `authenticated` EXACTLY
--      the write verbs each policy needs (and NOTHING on anon — the shipped public
--      read must not regress). service_role is untouched (BYPASSRLS + Supabase
--      defaults already cover the seed).
--   2. RLS bounds which rows a reachable verb sees/writes. Every write policy is
--      gated by public.has_role(auth.uid(),'editor') (0003), so a contributor or an
--      anon caller passes NONE of them (default-deny stands for them).
--
-- The three security guards the red-team flagged, resolved here:
--   * H2 PERMANENCE (board_members): editor INSERT/UPDATE/DELETE is allowed ONLY when
--     the member's term_id references a board_terms row with is_current = true. A
--     prior (archived) term's roster is therefore IMMUTABLE at the DB — permanence is
--     a guarantee, not merely the absence of a write path. Enforced in WITH CHECK
--     (INSERT) and BOTH USING + WITH CHECK (UPDATE) and USING (DELETE). The EXISTS
--     subquery reads board_terms, which is world-readable to authenticated
--     (board_terms_public_read `using(true)`, 0006), so NO security-definer helper is
--     needed — unlike has_role(), which must bypass the self-only profiles RLS.
--   * board_terms rollover: editor INSERT (create the new current term) + editor
--     UPDATE (flip the old term's is_current to false). NO editor DELETE policy — a
--     term is permanent; rollover archives, it never removes a term. The 0006 partial
--     unique index `board_terms_single_current_idx` still enforces at most one current
--     term, so a second is_current=true INSERT fails loudly.
--   * site_content mission: editor UPDATE only (the mission row is seeded; editing,
--     not creating). READ-POLICY SCOPING ADVISORY (forward guard, NOT built now): the
--     0006 SELECT policy is `using(true)`, which is correct while the ONLY key is the
--     public 'about_mission'. If a PRIVATE site_content key is ever added, that blanket
--     read leaks it to anon — at THAT point scope the SELECT policy (e.g. a public-key
--     allowlist or an is_public column). Do not over-build it today.
--
-- ADDITIVE and REPLAYABLE (drop-then-create for policies; grants are idempotent),
-- matching 0001/0003/0004/0006. Applied out-of-band by a human; NEVER from
-- application code (API keys reach PostgREST, DDL is not exposed over HTTP):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0007_about_admin.sql

-- ── Grants: reachable write verbs for `authenticated` (anon UNTOUCHED) ───────────
-- 0006 already granted SELECT to anon, authenticated on all three tables (needed for
-- the RETURNING re-read after each write, and unchanged for the public render). Here
-- we add ONLY the write verbs each editor policy needs. anon receives nothing — the
-- shipped public read stays SELECT-only and cannot regress.
grant update                 on public.site_content  to authenticated;  -- edit mission
grant insert, update         on public.board_terms   to authenticated;  -- create + flip term
grant insert, update, delete on public.board_members to authenticated;  -- roster CRUD

-- ── site_content: editor edits the mission ──────────────────────────────────────
-- UPDATE-any gated by the editor role. USING gates WHICH rows are updatable (any keyed
-- block, for an editor); WITH CHECK re-asserts the role on the result. No INSERT/DELETE
-- policy — keyed blocks are seeded, and the mission is edited in place. Permissive
-- OR-composition leaves the 0006 public SELECT intact; a non-editor passes neither
-- clause, so default-deny stands for them.
drop policy if exists site_content_editor_update on public.site_content;
create policy site_content_editor_update
  on public.site_content
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

-- ── board_terms: editor creates a term + flips is_current (rollover) ─────────────
-- INSERT: an editor may create a term (the new current term of a rollover). The 0006
-- partial unique index still caps is_current=true rows at one, so creating a second
-- current term fails at the index.
drop policy if exists board_terms_editor_insert on public.board_terms;
create policy board_terms_editor_insert
  on public.board_terms
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'editor'));

-- UPDATE: an editor may update ANY term — specifically to flip the outgoing current
-- term's is_current to false during a rollover. USING gates which rows are updatable;
-- WITH CHECK re-asserts the role on the result. (Rollover ordering — archive the old
-- current BEFORE inserting the new one — lives in lib/board.rollBoardTerm so the
-- immediate partial-unique index never sees two current terms.)
drop policy if exists board_terms_editor_update on public.board_terms;
create policy board_terms_editor_update
  on public.board_terms
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'editor'))
  with check (public.has_role(auth.uid(), 'editor'));

-- NO board_terms DELETE policy for authenticated — a term is a permanent archive key.
-- Rollover ARCHIVES (is_current=false); it never deletes a term. default-deny stands.

-- ── board_members: editor roster CRUD, CURRENT TERM ONLY (H2 permanence) ─────────
-- The predicate `member's term is current` is the H2 permanence guard: an archived
-- term's roster cannot be inserted into, updated, or deleted. board_terms is
-- world-readable to authenticated (0006), so this EXISTS subquery — evaluated as the
-- calling role — sees the target term row and needs no security-definer helper.

-- INSERT: WITH CHECK only (there is no pre-existing row). The NEW row's term must be
-- the current term, and the caller must be an editor. Adding a member to an archived
-- term is impossible by construction (about-e2e-005 adds to the CURRENT term).
drop policy if exists board_members_editor_insert on public.board_members;
create policy board_members_editor_insert
  on public.board_members
  for insert
  to authenticated
  with check (
        public.has_role(auth.uid(), 'editor')
    and exists (
      select 1
      from public.board_terms t
      where t.id = board_members.term_id
        and t.is_current
    )
  );

-- UPDATE: USING gates the EXISTING row (its term must be current → an archived-term
-- member is not updatable at all, the core permanence guarantee); WITH CHECK gates the
-- RESULT row (its term must still be current → an editor cannot move a member INTO an
-- archived term either). Both clauses also require the editor role.
drop policy if exists board_members_editor_update on public.board_members;
create policy board_members_editor_update
  on public.board_members
  for update
  to authenticated
  using (
        public.has_role(auth.uid(), 'editor')
    and exists (
      select 1
      from public.board_terms t
      where t.id = board_members.term_id
        and t.is_current
    )
  )
  with check (
        public.has_role(auth.uid(), 'editor')
    and exists (
      select 1
      from public.board_terms t
      where t.id = board_members.term_id
        and t.is_current
    )
  );

-- DELETE: USING only. The row's term must be current (an archived-term member cannot
-- be deleted → permanence), and the caller must be an editor.
drop policy if exists board_members_editor_delete on public.board_members;
create policy board_members_editor_delete
  on public.board_members
  for delete
  to authenticated
  using (
        public.has_role(auth.uid(), 'editor')
    and exists (
      select 1
      from public.board_terms t
      where t.id = board_members.term_id
        and t.is_current
    )
  );

-- ── Empirical verification (out-of-band probes, run against the deployed policies) ─
-- Deliver/red-team confirm, using the PUBLISHABLE key + a real JWT (never service_role):
--   1. editor CAN: update site_content 'about_mission'; insert/update/delete a member
--      of the CURRENT term; insert a new current term + flip the old to archived.
--   2. editor CANNOT: update or delete a member whose term is archived (0 rows / RLS
--      denial) — the H2 permanence guarantee.
--   3. contributor / anon CANNOT: write any of the three tables (default-deny; no
--      grant for anon, no editor role for a contributor).
--   4. anon READ is unchanged: /about still renders mission + current roster + archive
--      (0006 SELECT policies untouched).
