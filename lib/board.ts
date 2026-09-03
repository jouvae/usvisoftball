import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBoardPhotoStorageUrl } from "@/lib/board-photos";
import {
  type BoardSeat,
  type BoardTerm,
  type BoardMember,
  type BoardSocialPlatform,
  type Mission,
  type BoardRoster,
  SEAT_LABELS,
  ABOUT_MISSION_SLUG,
  BOARD_SOCIAL_HOSTS,
  BOARD_SOCIAL_LABELS,
} from "@/lib/board-view";

// Re-export the client-safe view types + constants so existing server callers keep
// importing them from "@/lib/board" unchanged. The canonical declarations now live in
// lib/board-view.ts (no server-only) so Client Components can import them too — see the
// header there for why. (Fixes a `next build` failure: board-member-form.tsx imported
// SEAT_LABELS from here and dragged `server-only` into the browser bundle.)
export {
  type BoardSeat,
  type BoardTerm,
  type BoardMember,
  type Mission,
  type BoardRoster,
  SEAT_LABELS,
  ABOUT_MISSION_SLUG,
};

// A social URL failed the https + host-allowlist check. Distinct type so the board
// Server Actions map it to a friendly form error rather than a 500 (mirrors
// lib/contact.ts ContactUrlError). Editor-supplied social links are rendered as public
// <a href>, so this is defense-in-depth against javascript:/data:/open-redirect at write.
export class BoardSocialUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardSocialUrlError";
  }
}

// Write-side validator: an optional (''/null) link is fine; a present one MUST be https on
// the platform's allowlisted host. Throws BoardSocialUrlError otherwise. The render path is
// independently guarded by safeBoardSocialHref (lib/board-view), so a value that bypassed
// this (raw PostgREST) still cannot emit a live off-platform/js: link.
export function assertBoardSocialUrlAllowed(
  url: string | null | undefined,
  platform: BoardSocialPlatform,
): void {
  if (!url) return;
  const label = BOARD_SOCIAL_LABELS[platform];
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new BoardSocialUrlError(`${label} must be a full https:// URL.`);
  }
  if (u.protocol !== "https:") {
    throw new BoardSocialUrlError(`${label} must start with https://.`);
  }
  if (u.username || u.password) {
    throw new BoardSocialUrlError(`${label} must not contain a username or password.`);
  }
  if (!BOARD_SOCIAL_HOSTS[platform].includes(u.host)) {
    throw new BoardSocialUrlError(
      `${label} must be a ${BOARD_SOCIAL_HOSTS[platform][0]} URL.`,
    );
  }
}

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

// ---------------------------------------------------------------------------
// Write shapes. Seed shapes (upsert*/create*) + admin-CRUD shapes (update*/roll*).
// One shape per write, matching the CreateArticleInput discipline.
// ---------------------------------------------------------------------------

export interface UpsertMissionInput {
  slug?: string; // defaults to ABOUT_MISSION_SLUG
  title?: string | null;
  body: string;
}

// The editable columns of a board member, all OPTIONAL — the admin roster editor
// PATCHes only the fields the form changed. `photoUrl: null` clears the photo (the
// missing-photo state); an OMITTED key leaves the column untouched.
export interface UpdateBoardMemberFields {
  name?: string;
  seat?: BoardSeat;
  role?: string;
  photoUrl?: string | null;
  bio?: string;
  // MVP slice 5 socials. A key present with '' / null CLEARS that link; an OMITTED key
  // leaves the column untouched (matches the photoUrl `"x" in fields` discipline below).
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
  sortOrder?: number;
}

// The rollover payload (about-e2e-006): only the new term's identity. The old current
// term is discovered inside rollBoardTerm and archived — the caller never names it.
export interface RollBoardTermInput {
  newSlug: string;
  newLabel: string;
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
  facebookUrl?: string | null; // MVP slice 5; omitted → null at the DB
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  xUrl?: string | null;
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
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const TERM_COLUMNS =
  "id, slug, label, is_current, sort_order, created_at, updated_at";
const MEMBER_COLUMNS =
  "id, term_id, name, seat, role, photo_url, bio, facebook_url, instagram_url, linkedin_url, x_url, sort_order, created_at, updated_at";
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
    socials: {
      facebook: row.facebook_url,
      instagram: row.instagram_url,
      linkedin: row.linkedin_url,
      x: row.x_url,
    },
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
//
// The client is REQUIRED (no admin default) — this function is DUAL-USE: the seed passes
// the BYPASSRLS admin client explicitly, but createBoardMemberAction passes the editor
// SESSION client so RLS is the real boundary. A default would be an RLS-bypass footgun
// (red-team-code advisory): a future CRUD caller could omit it and silently write past
// RLS. This now matches its four sibling CRUD mutators, none of which default the client.
export async function createBoardMember(
  input: CreateBoardMemberInput,
  supabase: SupabaseClient,
): Promise<BoardMember> {
  // SSRF/write-boundary guard (red-team): reject a photo_url that is neither a local
  // /public path nor an allowlisted host, BEFORE it reaches the DB. Seed fixtures use
  // local /seed/*.png paths, so they pass unchanged.
  assertBoardPhotoUrlAllowed(input.photoUrl);
  // Social links: https + per-platform host allowlist before the DB write (slice 5).
  assertBoardSocialUrlAllowed(input.facebookUrl, "facebook");
  assertBoardSocialUrlAllowed(input.instagramUrl, "instagram");
  assertBoardSocialUrlAllowed(input.linkedinUrl, "linkedin");
  assertBoardSocialUrlAllowed(input.xUrl, "x");

  const { data, error } = await supabase
    .from("board_members")
    .insert({
      term_id: input.termId,
      name: input.name,
      seat: input.seat,
      role: input.role,
      photo_url: input.photoUrl ?? null,
      bio: input.bio ?? "",
      facebook_url: input.facebookUrl ?? null,
      instagram_url: input.instagramUrl ?? null,
      linkedin_url: input.linkedinUrl ?? null,
      x_url: input.xUrl ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select(MEMBER_COLUMNS)
    .single();

  if (error) throw error;
  return toMember(data as BoardMemberRow);
}

// Read one member's current photo_url (or null) — used by the edit action to delete the
// PRIOR uploaded object when a photo is replaced or cleared, so Storage doesn't accumulate
// orphans. Reads through whatever client the caller passes (the editor session client).
export async function getBoardMemberPhotoUrl(
  id: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("board_members")
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as { photo_url: string | null } | null)?.photo_url ?? null;
}

// ---------------------------------------------------------------------------
// photo_url write-boundary guard (red-team SSRF item).
//
// A board photo is rendered by next/image on the public /about page. next.config.ts
// allows ONLY the Supabase Storage board-photos public path (0009) as a remote source, so
// a stored upload URL renders; any OTHER remote host would 500 at render even if it
// reached the DB. We therefore reject, at the WRITE boundary, any photo_url that is
// neither a local path, nor one of our uploaded board-photo URLs, nor an ALLOWLISTED
// host, so an editor cannot persist an arbitrary off-site (SSRF-shaped) URL.
// ---------------------------------------------------------------------------

// Allowlisted remote hosts for board photos. EMPTY today by design: local /public
// paths are the only render-safe source while next.config.ts has no remotePatterns.
// This is the single FORWARD SEAM — adding a host here is a deliberate, PAIRED change
// with a matching next.config remotePatterns entry, never a silent widening.
const BOARD_PHOTO_ALLOWED_HOSTS: readonly string[] = [];

// Thrown when a photo_url fails the allowlist. A distinct type so a Server Action can
// map it to a friendly form error (vs re-throwing an unexpected DB/transport error).
export class BoardPhotoUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardPhotoUrlError";
  }
}

// Reject a photo_url that is neither a local /public path nor an allowlisted host.
// `null`/`undefined`/'' are the legitimate missing-photo state and pass through. A
// relative path MUST start with '/' (a bare 'evil.com/x' is not local). A parseable
// absolute URL is allowed ONLY if its host is allowlisted; anything unparseable or
// off-allowlist throws BoardPhotoUrlError.
export function assertBoardPhotoUrlAllowed(
  photoUrl: string | null | undefined,
): void {
  if (photoUrl == null || photoUrl === "") return; // missing-photo state
  // A local /public path must start with a single '/' and NOT smuggle an authority via a
  // second slash OR a backslash — the URL parser resolves '/\host' off-origin. This mirrors
  // the render-side safePhotoHref guard so a stored value can never resolve off-origin even
  // if a future render path (next/image, email, RSS) omits the guard (red-team parity).
  if (/^\/(?![/\\])/.test(photoUrl)) return; // local path
  if (isBoardPhotoStorageUrl(photoUrl)) return; // an uploaded board photo (0009 bucket)
  let host: string;
  try {
    host = new URL(photoUrl).host;
  } catch {
    throw new BoardPhotoUrlError(
      "Photo URL must be a local path starting with “/” or an allowlisted URL.",
    );
  }
  if (!BOARD_PHOTO_ALLOWED_HOSTS.includes(host)) {
    throw new BoardPhotoUrlError(
      `Photo URL host “${host}” is not on the allowlist.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Admin CRUD write paths (about-e2e-004..006). These take an INJECTABLE client with
// NO default: the admin UI ALWAYS passes the RLS-ENFORCED cookie SESSION client
// (createSupabaseServerClient), so every write runs as the editor and the 0007
// policies are the real boundary. There is NO admin-client default here — a mutation
// must never silently bypass RLS the way the seed path deliberately does. DB errors /
// RLS denials surface as PostgrestError (e.g. PGRST116 when 0 rows match, which is how
// the H2 archived-term guard presents), which the Server Action maps to a form error.
// ---------------------------------------------------------------------------

// updateMission (about-e2e-004): edit the mission prose in place. UPDATE (not upsert)
// of the ABOUT_MISSION_SLUG row — the mission is seeded, so this only edits `body`;
// `title` is left untouched. RLS `site_content_editor_update` enforces the editor role;
// a non-editor matches 0 rows and `.single()` throws PGRST116. Returns the fresh row so
// the caller can revalidate /about with the new copy.
export async function updateMission(
  body: string,
  supabase: SupabaseClient,
): Promise<Mission> {
  const { data, error } = await supabase
    .from("site_content")
    .update({ body })
    .eq("slug", ABOUT_MISSION_SLUG)
    .select(MISSION_COLUMNS)
    .single();

  if (error) throw error;
  return toMission(data as SiteContentRow);
}

// updateBoardMember (about-e2e-005): PATCH one current-term member. Only the supplied
// fields are written (an omitted key leaves its column untouched); `photoUrl: null`
// clears the photo. The photo guard runs BEFORE the write. RLS
// `board_members_editor_update` enforces editor + CURRENT-TERM-ONLY: updating an
// archived-term member matches 0 rows (H2 permanence) and `.single()` throws PGRST116.
export async function updateBoardMember(
  id: string,
  fields: UpdateBoardMemberFields,
  supabase: SupabaseClient,
): Promise<BoardMember> {
  if ("photoUrl" in fields) {
    assertBoardPhotoUrlAllowed(fields.photoUrl);
  }
  // Validate any social link the PATCH actually carries (present key), before the write.
  if ("facebookUrl" in fields) assertBoardSocialUrlAllowed(fields.facebookUrl, "facebook");
  if ("instagramUrl" in fields) assertBoardSocialUrlAllowed(fields.instagramUrl, "instagram");
  if ("linkedinUrl" in fields) assertBoardSocialUrlAllowed(fields.linkedinUrl, "linkedin");
  if ("xUrl" in fields) assertBoardSocialUrlAllowed(fields.xUrl, "x");

  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.seat !== undefined) patch.seat = fields.seat;
  if (fields.role !== undefined) patch.role = fields.role;
  if ("photoUrl" in fields) patch.photo_url = fields.photoUrl ?? null;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  // A present social key writes its value (''/null clears the column).
  if ("facebookUrl" in fields) patch.facebook_url = fields.facebookUrl || null;
  if ("instagramUrl" in fields) patch.instagram_url = fields.instagramUrl || null;
  if ("linkedinUrl" in fields) patch.linkedin_url = fields.linkedinUrl || null;
  if ("xUrl" in fields) patch.x_url = fields.xUrl || null;
  if (fields.sortOrder !== undefined) patch.sort_order = fields.sortOrder;

  const { data, error } = await supabase
    .from("board_members")
    .update(patch)
    .eq("id", id)
    .select(MEMBER_COLUMNS)
    .single();

  if (error) throw error;
  return toMember(data as BoardMemberRow);
}

// deleteBoardMember (about-e2e-005): remove one current-term member. RLS
// `board_members_editor_delete` enforces editor + CURRENT-TERM-ONLY, so deleting an
// archived-term member affects 0 rows (H2 permanence) — the caller re-reads the roster
// to confirm. Returns nothing; a DB/transport error THROWS.
export async function deleteBoardMember(
  id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("board_members")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// rollBoardTerm (about-e2e-006): roll the board to a new term WITHOUT touching the
// prior roster. ORDER MATTERS for the 0006 immediate partial-unique index
// (board_terms_single_current_idx): we ARCHIVE the outgoing current term FIRST
// (is_current=false), THEN INSERT the new current term — so the index never sees two
// is_current=true rows. The new term's sort_order is the outgoing term's + 10, keeping
// it newest in the archive ordering once it is itself later rolled. Both statements run
// through the editor session client (RLS `board_terms_editor_update` / `_insert`). No
// prior-term member is read, updated, or deleted — permanence holds by construction.
//
// KNOWN WINDOW (documented, acceptable for an editor action): between the archive and
// the insert there is transiently no current term; if the INSERT fails, the old term
// stays archived and the caller sees the error. Making the pair atomic (a single
// SECURITY DEFINER SQL function / transaction) is the forward hardening if this proves
// fragile — not built now.
export async function rollBoardTerm(
  input: RollBoardTermInput,
  supabase: SupabaseClient,
): Promise<BoardTerm> {
  // Discover the outgoing current term (if any) to derive ordering + archive it.
  const { data: currentData, error: currentErr } = await supabase
    .from("board_terms")
    .select(TERM_COLUMNS)
    .eq("is_current", true)
    .maybeSingle();

  if (currentErr) throw currentErr;

  let nextSortOrder = 0;
  if (currentData != null) {
    const outgoing = toTerm(currentData as BoardTermRow);
    nextSortOrder = outgoing.sortOrder + 10;

    // Archive FIRST so the partial-unique index is free for the new current term.
    const { error: archiveErr } = await supabase
      .from("board_terms")
      .update({ is_current: false })
      .eq("id", outgoing.id);

    if (archiveErr) throw archiveErr;
  }

  // Create the new CURRENT term. is_current=true is now collision-free.
  const { data, error } = await supabase
    .from("board_terms")
    .insert({
      slug: input.newSlug,
      label: input.newLabel,
      is_current: true,
      sort_order: nextSortOrder,
    })
    .select(TERM_COLUMNS)
    .single();

  if (error) throw error;
  return toTerm(data as BoardTermRow);
}
