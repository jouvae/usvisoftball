import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { assertBoardPhotoUrlAllowed } from "@/lib/board";

// ---------------------------------------------------------------------------
// Feature softball/about, Slice 5 — standing committees (read side).
//
// SERVER ONLY. Reads go through the RLS-enforced publishable client (public /about render
// of the 0011 public-read policy). Committees are NOT term-scoped. Editor writes arrive
// with the committees CRUD slice; this module is read-only for now.
// ---------------------------------------------------------------------------

export interface CommitteeMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  sortOrder: number;
}

export interface Committee {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  members: CommitteeMember[];
}

type MemberRow = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url: string;
  sort_order: number;
};

type CommitteeRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  committee_members: MemberRow[] | null;
};

// List committees (ordered) each with its members (ordered). Members are sorted in JS so a
// single embedded read returns the whole aggregate; the ordering contract (sort_order, then
// name) matches the board roster so the two render consistently.
export async function listCommittees(
  supabase: SupabaseClient = createPublicClient(),
): Promise<Committee[]> {
  const { data, error } = await supabase
    .from("committees")
    .select(
      "id,name,slug,description,sort_order,committee_members(id,name,role,bio,photo_url,sort_order)",
    )
    .order("sort_order", { ascending: true })
    // Bound the public read (red-team-code Low). A federation has a handful of standing
    // committees; 100 is far above any real count and caps enumeration once the CRUD
    // write slice lets an editor add rows.
    .limit(100);
  if (error) throw error;

  return (data as CommitteeRow[] | null ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sort_order,
    members: (c.committee_members ?? [])
      .map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        bio: m.bio,
        photoUrl: m.photo_url,
        sortOrder: m.sort_order,
      }))
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
  }));
}

// ---------------------------------------------------------------------------
// Admin CRUD write paths (about-e2e-012/013). Every mutator takes an INJECTABLE session
// client with NO default — /admin/committees always passes the editor cookie client, so
// the 0012 editor RLS is the real boundary. A non-editor matches 0 rows → PGRST116.
// Committees are standing (no permanence guard); deleting a committee cascades its members.
// ---------------------------------------------------------------------------

export interface CreateCommitteeInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCommitteeFields {
  name?: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateCommitteeMemberInput {
  committeeId: string;
  name: string;
  role?: string;
  bio?: string;
  photoUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateCommitteeMemberFields {
  name?: string;
  role?: string;
  bio?: string;
  photoUrl?: string | null;
  sortOrder?: number;
}

const COMMITTEE_COLUMNS = "id,name,slug,description,sort_order";
const MEMBER_COLUMNS = "id,name,role,bio,photo_url,sort_order";

// URL-safe slug from the committee name. Stable once created (never re-derived on edit) so
// any future per-committee references don't break when a name is corrected.
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "committee"
  );
}

function toCommittee(
  row: {
    id: string;
    name: string;
    slug: string;
    description: string;
    sort_order: number;
  },
  members: CommitteeMember[] = [],
): Committee {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    members,
  };
}

function toMember(row: MemberRow): CommitteeMember {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photoUrl: row.photo_url,
    sortOrder: row.sort_order,
  };
}

export async function createCommittee(
  input: CreateCommitteeInput,
  supabase: SupabaseClient,
): Promise<Committee> {
  const { data, error } = await supabase
    .from("committees")
    .insert({
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? "",
      sort_order: input.sortOrder ?? 0,
    })
    .select(COMMITTEE_COLUMNS)
    .single();
  if (error) throw error;
  return toCommittee(data as Parameters<typeof toCommittee>[0]);
}

// Update a committee's name/description/order. The slug is intentionally NOT changed.
export async function updateCommittee(
  id: string,
  fields: UpdateCommitteeFields,
  supabase: SupabaseClient,
): Promise<Committee> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.sortOrder !== undefined) patch.sort_order = fields.sortOrder;

  const { data, error } = await supabase
    .from("committees")
    .update(patch)
    .eq("id", id)
    .select(COMMITTEE_COLUMNS)
    .single();
  if (error) throw error;
  return toCommittee(data as Parameters<typeof toCommittee>[0]);
}

// Delete a committee. Its committee_members cascade (FK on delete cascade).
export async function deleteCommittee(
  id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from("committees").delete().eq("id", id);
  if (error) throw error;
}

export async function createCommitteeMember(
  input: CreateCommitteeMemberInput,
  supabase: SupabaseClient,
): Promise<CommitteeMember> {
  assertBoardPhotoUrlAllowed(input.photoUrl);
  const { data, error } = await supabase
    .from("committee_members")
    .insert({
      committee_id: input.committeeId,
      name: input.name,
      role: input.role ?? "",
      bio: input.bio ?? "",
      photo_url: input.photoUrl ?? "",
      sort_order: input.sortOrder ?? 0,
    })
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return toMember(data as MemberRow);
}

export async function updateCommitteeMember(
  id: string,
  fields: UpdateCommitteeMemberFields,
  supabase: SupabaseClient,
): Promise<CommitteeMember> {
  if (fields.photoUrl !== undefined) assertBoardPhotoUrlAllowed(fields.photoUrl);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.role !== undefined) patch.role = fields.role;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  if (fields.photoUrl !== undefined) patch.photo_url = fields.photoUrl ?? "";
  if (fields.sortOrder !== undefined) patch.sort_order = fields.sortOrder;

  const { data, error } = await supabase
    .from("committee_members")
    .update(patch)
    .eq("id", id)
    .select(MEMBER_COLUMNS)
    .single();
  if (error) throw error;
  return toMember(data as MemberRow);
}

export async function deleteCommitteeMember(
  id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("committee_members")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// The member's current photo_url (or null) — for deleting the prior Storage object when a
// photo is replaced/cleared (same orphan-cleanup contract as the board).
export async function getCommitteeMemberPhotoUrl(
  id: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("committee_members")
    .select("photo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const url = (data as { photo_url: string | null } | null)?.photo_url;
  return url ? url : null;
}
