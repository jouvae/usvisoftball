import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { assertBoardPhotoUrlAllowed } from "@/lib/board";
import {
  type Island,
  type Team,
  type TeamPlayer,
  type TeamWithRoster,
  ISLAND_LABELS,
  ISLAND_ORDER,
} from "@/lib/teams-view";

// ---------------------------------------------------------------------------
// Feature softball/teams — team directory (read side).
//
// SERVER ONLY. Reads go through the RLS-enforced publishable client (public /teams render
// of the 0013 public-read policy). Editor writes arrive with the teams admin-CRUD slice.
// Client-safe types/constants live in lib/teams-view.ts (re-exported below) so Client
// Components can import them without dragging `server-only` into the browser bundle.
// ---------------------------------------------------------------------------

export {
  type Island,
  type Team,
  type TeamPlayer,
  type TeamWithRoster,
  ISLAND_LABELS,
  ISLAND_ORDER,
};

type PlayerRow = {
  id: string;
  name: string;
  jersey_number: number | null;
  position: string;
  bats_throws: string;
  hometown: string;
  photo_url: string;
  sort_order: number;
};

function toPlayer(row: PlayerRow): TeamPlayer {
  return {
    id: row.id,
    name: row.name,
    jerseyNumber: row.jersey_number,
    position: row.position,
    batsThrows: row.bats_throws,
    hometown: row.hometown,
    photoUrl: row.photo_url,
    sortOrder: row.sort_order,
  };
}

const PLAYER_COLUMNS =
  "id,name,jersey_number,position,bats_throws,hometown,photo_url,sort_order";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  island: Island;
  division: string;
  description: string;
  logo_url: string;
  home_venue: string;
  founded_year: number | null;
  sort_order: number;
};

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    island: row.island,
    division: row.division,
    description: row.description,
    logoUrl: row.logo_url,
    homeVenue: row.home_venue,
    foundedYear: row.founded_year,
    sortOrder: row.sort_order,
  };
}

const COLUMNS =
  "id,name,slug,island,division,description,logo_url,home_venue,founded_year,sort_order";

// All teams, ordered (sort_order, then name). Bounded read.
export async function listTeams(
  supabase: SupabaseClient = createPublicClient(),
): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data as TeamRow[] | null ?? []).map(toTeam);
}

// Group teams by island in the canonical display order, dropping empty islands. The
// directory renders one section per non-empty group.
export function groupTeamsByIsland(
  teams: Team[],
): { island: Island; label: string; teams: Team[] }[] {
  return ISLAND_ORDER.map((island) => ({
    island,
    label: ISLAND_LABELS[island],
    teams: teams.filter((t) => t.island === island),
  })).filter((g) => g.teams.length > 0);
}

// One team by slug, with its ordered roster (single embedded read). Returns null when the
// slug doesn't exist — the detail page maps that to a 404. Roster ordered (sort_order, name).
export async function getTeamBySlug(
  slug: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<TeamWithRoster | null> {
  const { data, error } = await supabase
    .from("teams")
    .select(`${COLUMNS},team_players(${PLAYER_COLUMNS})`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as TeamRow & { team_players: PlayerRow[] | null };
  const players = (row.team_players ?? [])
    .map(toPlayer)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return { ...toTeam(row), players };
}

// ---------------------------------------------------------------------------
// Admin CRUD write paths (teams-e2e-003). Every mutator takes an INJECTABLE session client
// with NO default — /admin/teams always passes the editor cookie client, so the 0015 editor
// RLS is the real boundary. A non-editor matches 0 rows → PGRST116. Deleting a team cascades
// its team_players. Logo reuses the board photo allowlist (assertBoardPhotoUrlAllowed).
// ---------------------------------------------------------------------------

export interface CreateTeamInput {
  name: string;
  island: Island;
  division?: string;
  description?: string;
  logoUrl?: string | null;
  homeVenue?: string;
  foundedYear?: number | null;
  sortOrder?: number;
}

export interface UpdateTeamFields {
  name?: string;
  island?: Island;
  division?: string;
  description?: string;
  logoUrl?: string | null;
  homeVenue?: string;
  foundedYear?: number | null;
  sortOrder?: number;
}

// URL-safe slug from the team name. Stable once created (never re-derived on edit) so the
// /teams/[slug] detail URL doesn't break when a name is corrected.
function slugifyTeam(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "team"
  );
}

export async function createTeam(
  input: CreateTeamInput,
  supabase: SupabaseClient,
): Promise<Team> {
  assertBoardPhotoUrlAllowed(input.logoUrl);
  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: input.name,
      slug: slugifyTeam(input.name),
      island: input.island,
      division: input.division ?? "",
      description: input.description ?? "",
      logo_url: input.logoUrl ?? "",
      home_venue: input.homeVenue ?? "",
      founded_year: input.foundedYear ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toTeam(data as TeamRow);
}

// Update a team's fields. The slug is intentionally NOT changed (detail URL stays stable).
export async function updateTeam(
  id: string,
  fields: UpdateTeamFields,
  supabase: SupabaseClient,
): Promise<Team> {
  if (fields.logoUrl !== undefined) assertBoardPhotoUrlAllowed(fields.logoUrl);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.island !== undefined) patch.island = fields.island;
  if (fields.division !== undefined) patch.division = fields.division;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.logoUrl !== undefined) patch.logo_url = fields.logoUrl ?? "";
  if (fields.homeVenue !== undefined) patch.home_venue = fields.homeVenue;
  if (fields.foundedYear !== undefined) patch.founded_year = fields.foundedYear;
  if (fields.sortOrder !== undefined) patch.sort_order = fields.sortOrder;

  const { data, error } = await supabase
    .from("teams")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toTeam(data as TeamRow);
}

// Delete a team. Its team_players cascade (FK on delete cascade).
export async function deleteTeam(
  id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

// One team's logo_url (or null) — for deleting the prior Storage object on replace/clear.
export async function getTeamLogoUrl(
  id: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("teams")
    .select("logo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const url = (data as { logo_url: string | null } | null)?.logo_url;
  return url ? url : null;
}

// All Storage photo URLs owned by a team (its logo + its players' photos) — read BEFORE a
// cascade delete so the caller can reap the objects afterward.
export async function getTeamOwnedPhotoUrls(
  id: string,
  supabase: SupabaseClient,
): Promise<string[]> {
  const urls: string[] = [];
  const logo = await getTeamLogoUrl(id, supabase);
  if (logo) urls.push(logo);
  const { data } = await supabase
    .from("team_players")
    .select("photo_url")
    .eq("team_id", id);
  for (const r of data ?? []) {
    const u = (r as { photo_url: string | null }).photo_url;
    if (u) urls.push(u);
  }
  return urls;
}
