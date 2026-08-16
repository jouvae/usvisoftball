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

// Render-time guard for a team logo URL (red-team-code Low from slice 1, now that the CRUD
// slice lets an editor set logo_url). Return the URL to use as an <img src> ONLY if it is a
// local /public path or an https URL; otherwise ''. Blocks a stored javascript:/data: (or
// other scheme) value from ever reaching the DOM as a live src. Mirrors the board photo /
// contact link write+render defense-in-depth. Uploaded logos are board-photos https URLs, so
// they pass; typed local paths pass; anything else is dropped at render.
export function safeLogoHref(url: string): string {
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url; // local /public path
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

// A member team / club.
export interface Team {
  id: string;
  name: string;
  slug: string; // URL-safe key for the /teams/[slug] detail page
  island: Island;
  division: string; // free text: Men's / Women's / Coed / Youth
  description: string;
  logoUrl: string;
  homeVenue: string;
  foundedYear: number | null;
  sortOrder: number;
}

// A roster player on a team (team detail page).
export interface TeamPlayer {
  id: string;
  name: string;
  jerseyNumber: number | null;
  position: string; // free text: P / C / 1B / SS / OF …
  batsThrows: string; // free text: R/R, L/L, S/R …
  hometown: string;
  photoUrl: string;
  sortOrder: number;
}

// A team paired with its ordered roster — the shape the detail read returns.
export interface TeamWithRoster extends Team {
  players: TeamPlayer[];
}
