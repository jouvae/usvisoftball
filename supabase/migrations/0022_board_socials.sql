-- 0022_board_socials.sql
-- MVP slice 5 (home board grid + profile modal): per-member social links.
--
-- Adds four NULLABLE social-URL columns to public.board_members: facebook_url,
-- instagram_url, linkedin_url, x_url. EMAIL is intentionally NOT added (product decision:
-- the board profile modal shows social links, not an email address). The public /about and
-- home board reads gain these columns; the admin board CRUD (0007 editor RLS) writes them
-- under the same editor boundary — no new policy needed (0007 is row-level editor, no
-- column restriction; anon holds table-level SELECT from 0006). The app validates each URL
-- (https + per-platform host allowlist) BEFORE write AND at render (defense-in-depth against
-- javascript:/data:/open-redirect in the rendered <a href>). ADDITIVE + REPLAYABLE.
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0022_board_socials.sql

alter table public.board_members
    add column if not exists facebook_url  text,
    add column if not exists instagram_url text,
    add column if not exists linkedin_url  text,
    add column if not exists x_url         text;
