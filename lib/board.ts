import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Feature softball/about — Model + data access (Node 1 contract).
//
// Read paths go through the RLS-ENFORCED publishable client (lib/supabase/public),
// exactly like lib/articles: /about is a public render and must genuinely exercise
// read RLS — a broken policy shows an empty page, never a masked leak. Write paths
// (seed only, for this slice; admin CRUD is DEFERRED) take an INJECTABLE client
// defaulting to the BYPASSRLS admin client, mirroring createArticle.
//
// DB columns are snake_case; this module maps rows to camelCase props. Timestamps
// cross the boundary as ISO strings, never `Date` (serialization + determinism).
// ---------------------------------------------------------------------------

// H4: the geographic constituency (island seat). Union mirrors the migration CHECK
// (`seat in ('st_thomas_st_john','st_croix','at_large')`) — keep the two in lockstep.
export type BoardSeat = "st_thomas_st_john" | "st_croix" | "at_large";

// Canonical, human-facing seat labels. about-web-002 asserts island COVERAGE (St.
// Thomas/St. John · St. Croix · at-large all render); this is the single source of
// truth for those strings so the roster component and the test never drift.
export const SEAT_LABELS: Record<BoardSeat, string> = {
  st_thomas_st_john: "St. Thomas / St. John",
  st_croix: "St. Croix",
  at_large: "At-Large",
};

// A per-term aggregate. `isCurrent` selects the live roster; archived terms
// (isCurrent=false) are the read-only prior-term archive (about-web-003).
export interface BoardTerm {
  id: string;
  slug: string; // URL-safe key ('2025-2027') for /about/[term]
  label: string; // display label ('2025–2027', en-dash)
  isCurrent: boolean;
  sortOrder: number;
  createdAt: string; // ISO 8601 (UTC)
  updatedAt: string; // ISO 8601 (UTC)
}

// A roster row, child of a BoardTerm.
export interface BoardMember {
  id: string;
  termId: string;
  name: string;
  seat: BoardSeat;
  role: string;
  photoUrl: string | null; // null → the missing-photo state (DESIGN.md empty states)
  bio: string;
  sortOrder: number;
  createdAt: string; // ISO 8601 (UTC)
  updatedAt: string; // ISO 8601 (UTC)
}

// The H1 singleton: one keyed block of site prose. Slice 1 reads slug='about_mission'.
export interface Mission {
  slug: string;
  title: string | null;
  body: string;
  updatedAt: string; // ISO 8601 (UTC)
}

// A term paired with its ordered roster — the shape both the current-board read and
// the archive-detail read return, so a screen always has term + members together.
export interface BoardRoster {
  term: BoardTerm;
  members: BoardMember[];
}

// The canonical slug for the mission singleton. The ONLY site_content key this slice
// reads or writes.
export const ABOUT_MISSION_SLUG = "about_mission";

// ---------------------------------------------------------------------------
// Write shapes (seed path; admin CRUD DEFERRED). One shape per write, matching the
// CreateArticleInput discipline.
// ---------------------------------------------------------------------------

export interface UpsertMissionInput {
  slug?: string; // defaults to ABOUT_MISSION_SLUG
  title?: string | null;
  body: string;
}

export interface UpsertBoardTermInput {
  slug: string;
  label: string;
  isCurrent?: boolean; // defaults to false at the DB
  sortOrder?: number; // defaults to 0 at the DB
}

export interface CreateBoardMemberInput {
  termId: string;
  name: string;
  seat: BoardSeat;
  role: string;
  photoUrl?: string | null;
  bio?: string;
  sortOrder?: number; // defaults to 0 at the DB
}

// ---------------------------------------------------------------------------
// Row shapes + mappers (snake_case DB ⇒ camelCase props).
// ---------------------------------------------------------------------------

interface SiteContentRow {
  slug: string;
  title: string | null;
  body: string;
  updated_at: string;
}

interface BoardTermRow {
  id: string;
  slug: string;
  label: string;
  is_current: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface BoardMemberRow {
  id: string;
  term_id: string;
  name: string;
  seat: BoardSeat;
  role: string;
  photo_url: string | null;
  bio: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const TERM_COLUMNS =
  "id, slug, label, is_current, sort_order, created_at, updated_at";
const MEMBER_COLUMNS =
  "id, term_id, name, seat, role, photo_url, bio, sort_order, created_at, updated_at";
const MISSION_COLUMNS = "slug, title, body, updated_at";

function toMission(row: SiteContentRow): Mission {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

function toTerm(row: BoardTermRow): BoardTerm {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    isCurrent: row.is_current,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMember(row: BoardMemberRow): BoardMember {
  return {
    id: row.id,
    termId: row.term_id,
    name: row.name,
    seat: row.seat,
    role: row.role,
    photoUrl: row.photo_url,
    bio: row.bio,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Public read paths (about-web-001..003). RLS-ENFORCED publishable client.
// ---------------------------------------------------------------------------

// The mission block. Returns `null` ONLY when data is null AND error is null (row not
// seeded yet — a real empty state, HTTP 200); any DB/transport error THROWS so a
// missing-mission state never hides an outage. Mirrors getPublishedArticleBySlug.
export async function getMission(): Promise<Mission | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("site_content")
    .select(MISSION_COLUMNS)
    .eq("slug", ABOUT_MISSION_SLUG)
    .maybeSingle();

  if (error) throw error;
  if (data == null) return null;
  return toMission(data as SiteContentRow);
}

// The current board roster (about-web-001/002). Reads the single is_current term,
// then its roster ordered (sort_order, name). Returns `null` when no current term is
// seeded (empty state, not an error). Two round-trips (term, then members) keeps each
// query index-covered; the roster is tiny so cost is negligible.
export async function listCurrentBoard(): Promise<BoardRoster | null> {
  const supabase = createPublicClient();
  const { data: termData, error: termErr } = await supabase
    .from("board_terms")
    .select(TERM_COLUMNS)
    .eq("is_current", true)
    .maybeSingle();

  if (termErr) throw termErr;
  if (termData == null) return null;

  const term = toTerm(termData as BoardTermRow);
  const members = await listBoardMembers(term.id, supabase);
  return { term, members };
}

// The prior-term archive index (about-web-003): every non-current term, newest first.
// Returns [] when there are none (not an error).
export async function listArchivedTerms(): Promise<BoardTerm[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("board_terms")
    .select(TERM_COLUMNS)
    .eq("is_current", false)
    .order("sort_order", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => toTerm(row as BoardTermRow));
}

// One term's read-only roster by term slug (about-web-003 archive detail). Returns
// `null` when the slug matches no term (→ a 404 at the page), any DB error THROWS.
export async function listBoardForTerm(
  termSlug: string,
): Promise<BoardRoster | null> {
  const supabase = createPublicClient();
  const { data: termData, error: termErr } = await supabase
    .from("board_terms")
    .select(TERM_COLUMNS)
    .eq("slug", termSlug)
    .maybeSingle();

  if (termErr) throw termErr;
  if (termData == null) return null;

  const term = toTerm(termData as BoardTermRow);
  const members = await listBoardMembers(term.id, supabase);
  return { term, members };
}

// Shared roster read (term_id → ordered members). Injectable client so it reuses the
// caller's already-constructed public client. Ordered (sort_order, name) to match the
// board_members_term_order_idx and give a stable roster.
async function listBoardMembers(
  termId: string,
  supabase: SupabaseClient,
): Promise<BoardMember[]> {
  const { data, error } = await supabase
    .from("board_members")
    .select(MEMBER_COLUMNS)
    .eq("term_id", termId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => toMember(row as BoardMemberRow));
}

// ---------------------------------------------------------------------------
// Write paths — SEED ONLY this slice (admin CRUD DEFERRED). Injectable client
// defaults to the BYPASSRLS admin client, like createArticle. Nothing else in the
// app hand-writes these tables.
// ---------------------------------------------------------------------------

// Upsert the mission (or any keyed site_content block). onConflict='slug' makes the
// seed idempotent WITHOUT a 23505 dance — a re-run overwrites the body in place.
export async function upsertMission(
  input: UpsertMissionInput,
  supabase: SupabaseClient = createAdminClient(),
): Promise<Mission> {
  const { data, error } = await supabase
    .from("site_content")
    .upsert(
      {
        slug: input.slug ?? ABOUT_MISSION_SLUG,
        title: input.title ?? null,
        body: input.body,
      },
      { onConflict: "slug" },
    )
    .select(MISSION_COLUMNS)
    .single();

  if (error) throw error;
  return toMission(data as SiteContentRow);
}

// Upsert a board term. Uses upsert (onConflict='slug') rather than a bare insert
// because the seed needs the term's id to attach members on a re-run too — a plain
// insert would 23505 and never return the existing row. Returns the row either way.
export async function upsertBoardTerm(
  input: UpsertBoardTermInput,
  supabase: SupabaseClient = createAdminClient(),
): Promise<BoardTerm> {
  const { data, error } = await supabase
    .from("board_terms")
    .upsert(
      {
        slug: input.slug,
        label: input.label,
        is_current: input.isCurrent ?? false,
        sort_order: input.sortOrder ?? 0,
      },
      { onConflict: "slug" },
    )
    .select(TERM_COLUMNS)
    .single();

  if (error) throw error;
  return toTerm(data as BoardTermRow);
}

// Insert one board member. Pure insert — the (term_id, name) unique constraint makes a
// re-run's duplicate raise PostgrestError code '23505', which the seed catches as
// "already present" (the articles-seed idempotency pattern).
export async function createBoardMember(
  input: CreateBoardMemberInput,
  supabase: SupabaseClient = createAdminClient(),
): Promise<BoardMember> {
  const { data, error } = await supabase
    .from("board_members")
    .insert({
      term_id: input.termId,
      name: input.name,
      seat: input.seat,
      role: input.role,
      photo_url: input.photoUrl ?? null,
      bio: input.bio ?? "",
      sort_order: input.sortOrder ?? 0,
    })
    .select(MEMBER_COLUMNS)
    .single();

  if (error) throw error;
  return toMember(data as BoardMemberRow);
}
