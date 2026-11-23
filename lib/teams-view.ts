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

// 'club' = an island member club; 'national' = a USVI national team (no single island);
// 'guest' = a lightweight opponent (country + flag, no roster, no island — schedule D5).
// Mirrors the 0026 CHECK (supersedes 0024).
export type TeamKind = "club" | "national" | "guest";

// The kinds an editor manages through the teams admin form. Guests are loaded by the
// schedule seed and stay out of the /teams directory and the admin kind <select>.
export type MemberTeamKind = Exclude<TeamKind, "guest">;

export const TEAM_KIND_LABELS: Record<MemberTeamKind, string> = {
  national: "National team",
  club: "Club",
};

// A member club or a national team.
export interface Team {
  id: string;
  name: string;
  slug: string; // URL-safe key for the /teams/[slug] detail page
  kind: TeamKind;
  shortName: string; // '' → use name
  island: Island | null; // null for national + guest teams (0024 CHECK)
  countryCode: string | null; // ISO 3166-1 alpha-2, uppercase; required for guests (0026)
  division: string; // free text: Men's / Women's / Coed / Youth
  description: string;
  logoUrl: string;
  coverImageUrl: string; // '' → no-photo variant
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
  active: boolean; // false = deactivated (players are never deleted — schedule D4, 0026)
}

// A team paired with its ordered roster — the shape the detail read returns.
export interface TeamWithRoster extends Team {
  players: TeamPlayer[];
}

// The roster's B/T column only renders when at least one player has it (home-feed Phase B).
export function showBatsThrows(players: readonly Pick<TeamPlayer, "batsThrows">[]): boolean {
  return players.some((p) => p.batsThrows.trim() !== "");
}
