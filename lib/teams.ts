import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import {
  type Island,
  type Team,
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
  ISLAND_LABELS,
  ISLAND_ORDER,
};

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
