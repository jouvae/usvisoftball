import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";

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
