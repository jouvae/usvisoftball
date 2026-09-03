-- 0021_highlight_editor_only.sql
-- SECURITY FIX (red-team-code, MVP slice 4): is_highlight is an EDITOR-ONLY curation
-- flag, but 0020 alone did not enforce that. The 0003 articles_contributor_update policy
-- lets a contributor UPDATE their OWN draft/in_review row, and its WITH CHECK pins only
-- author_id / status / source — NOT is_highlight — while the `authenticated` UPDATE grant
-- is table-wide (not column-restricted). So a contributor could set is_highlight=true on
-- their own draft; an editor later publishing it (publishArticle never resets the flag, and
-- the review UI shows the toggle only AFTER publish) would unwittingly push it into the
-- public home highlights carousel — a curation flag flipped without any editor's act.
--
-- Fix at the DATABASE (repo ethos: make it impossible by construction, not by prompt). A
-- permissive RLS WITH CHECK cannot express this — it sees only the RESULTING row, never
-- OLD — so it cannot say "is_highlight may not CHANGE unless editor". A BEFORE UPDATE
-- trigger comparing OLD vs NEW is the right tool:
--   * editor  (setHighlight runs under the editor's JWT) → has_role editor → allowed
--   * contributor / any non-editor authenticated caller  → REJECTED (23514)
--   * publish / unpublish / draft-save                   → never CHANGE is_highlight → pass
--   * service_role / admin backend (auth.uid() IS NULL, RLS-bypassing seed) → trusted → allowed
--
-- ADDITIVE + REPLAYABLE (create-or-replace fn + drop-then-create trigger). Applied
-- out-of-band by a human:
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0021_highlight_editor_only.sql

-- security definer + a pinned search_path: the function's has_role lookup must read
-- public.profiles regardless of the calling role, and the fixed search_path forecloses a
-- search-path hijack. auth.uid() is schema-qualified so it resolves independently of the path.
create or replace function public.enforce_highlight_editor_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  -- What counts as a non-editor-forbidden write differs by op:
  --   UPDATE — a CHANGE to the flag (publish/unpublish/body edits leave it untouched
  --            → old = new → no guard, so those common writes pass with no role check).
  --   INSERT — setting the flag TRUE at creation. The UPDATE-only guard would miss this:
  --            a contributor could INSERT a draft with is_highlight=true, which an editor
  --            publishing it (publishArticle never resets the flag) would push into the
  --            public carousel — the SAME gap through a different door. INSERT of the
  --            default FALSE must stay allowed, or contributor draft creation + the seed
  --            break, so only TRUE-at-insert is guarded.
  if tg_op = 'INSERT' then
    changed := coalesce(new.is_highlight, false);
  else -- UPDATE
    changed := new.is_highlight is distinct from old.is_highlight;
  end if;

  if changed then
    -- auth.uid() IS NULL ⇒ trusted backend (service_role seed / admin client): allow.
    -- Any authenticated caller setting/changing the flag MUST be an editor.
    if auth.uid() is not null and not public.has_role(auth.uid(), 'editor') then
      raise exception 'only an editor may set is_highlight'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists articles_highlight_editor_only on public.articles;
create trigger articles_highlight_editor_only
  before insert or update on public.articles
  for each row
  execute function public.enforce_highlight_editor_only();
