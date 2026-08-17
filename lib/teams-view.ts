// Feature softball/teams — CLIENT-SAFE view types + constants.
//
// No `server-only` import, no Supabase client — safe to import from Client Components (the
// future teams-admin island's island <select> needs ISLAND_LABELS as a runtime value).
// lib/teams.ts (server-only) re-exports every symbol here, so server callers keep importing
// from "@/lib/teams". Same split as lib/board-view.ts.

import { safeStoredImageHref } from "@/lib/safe-image-url";

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

// Render-time guard for team logos / player headshots. Delegates to the single shared,
// host-aware guard (lib/safe-image-url) so the write/render parity can never drift — an
// off-site https URL whose path merely matched the storage prefix is now dropped (a
// host-blind copy previously let it render; red-team-interactive Medium).
export function safeLogoHref(url: string): string {
  return safeStoredImageHref(url);
}
export function safePhotoHref(url: string): string {
  return safeStoredImageHref(url);
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
