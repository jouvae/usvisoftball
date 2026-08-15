-- 0008_board_term_permanence.sql
-- Feature softball/about, Slice 2 (admin CRUD) — CLOSE the last permanence hole (H2).
--
-- 0006 promised: "the future admin CRUD slice must additionally refuse UPDATE/DELETE on
-- a non-current term to make permanence a DB guarantee." 0007 delivered the ROW half:
-- board_members' editor UPDATE/DELETE policies are scoped to the CURRENT term via an
-- EXISTS(... board_terms.is_current) guard. But that guard keys off board_terms.is_current,
-- and 0007's `board_terms_editor_update` policy left `is_current` itself freely editable.
-- So an editor could REACTIVATE history in two steps (red-team-code, High):
--   1. UPDATE board_terms SET is_current=false  on the live current term, then
--   2. UPDATE board_terms SET is_current=true   on an ARCHIVED term
-- — the partial-unique index is now free, the archived term becomes "current," and its
-- historical roster's edit/delete guard unlocks. Permanence defeated.
--
-- FIX: forbid, at the DB, any UPDATE that moves an EXISTING term's is_current INTO true.
-- This is the exact and ONLY transition the attack needs; the legitimate rollover never
-- performs it — lib/board.rollBoardTerm archives the outgoing term (is_current true->false,
-- allowed) and INSERTs the new current term (is_current=true on INSERT — a trigger scoped
-- to UPDATE does not touch inserts). A brand-new term is still born current via INSERT.
--
-- Enforced for ALL writers (including the BYPASSRLS admin/seed role): permanence is a
-- property of the data, not of who is writing. Row-level triggers are NOT bypassed by
-- BYPASSRLS, which is what we want. The seed never flips an existing archived term to
-- current, so re-seeding is unaffected.
--
-- Replayable: safe to run more than once
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0008_board_term_permanence.sql

create or replace function public.forbid_board_term_reactivation()
returns trigger
language plpgsql
as $$
begin
  -- Block any transition of an existing row INTO current (false/null -> true). Archiving
  -- (true -> false) and no-op writes (true -> true, false -> false) are allowed. New
  -- current terms are created by INSERT, which this UPDATE trigger never sees.
  if NEW.is_current is true and OLD.is_current is distinct from true then
    raise exception
      'board_terms.is_current cannot be turned on for an existing term (archived terms are permanent — roll a new term instead)'
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

drop trigger if exists board_terms_no_reactivation on public.board_terms;
create trigger board_terms_no_reactivation
  before update on public.board_terms
  for each row
  execute function public.forbid_board_term_reactivation();
