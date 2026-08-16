// Feature softball/teams — CLIENT-SAFE view types + constants.
//
// No `server-only` import, no Supabase client — safe to import from Client Components (the
// future teams-admin island's island <select> needs ISLAND_LABELS as a runtime value).
// lib/teams.ts (server-only) re-exports every symbol here, so server callers keep importing
// from "@/lib/teams". Same split as lib/board-view.ts.

// The three USVI islands. Union mirrors the 0013 CHECK (island in
// ('st_thomas','st_john','st_croix')) — keep the two in lockstep.
export type Island = "st_thomas" | "st_john" | "st_croix";

// Canonical, human-facing island labels — the single source of truth so the directory and
// any test never drift.
export const ISLAND_LABELS: Record<Island, string> = {
  st_thomas: "St. Thomas",
  st_john: "St. John",
  st_croix: "St. Croix",
};

// Display order for the directory's island groups.
export const ISLAND_ORDER: readonly Island[] = ["st_thomas", "st_john", "st_croix"];

// A member team / club.
export interface Team {
  id: string;
  name: string;
  slug: string; // URL-safe key for a future /teams/[slug] page
  island: Island;
  division: string; // free text: Men's / Women's / Coed / Youth
  description: string;
  logoUrl: string;
  homeVenue: string;
  foundedYear: number | null;
  sortOrder: number;
}
