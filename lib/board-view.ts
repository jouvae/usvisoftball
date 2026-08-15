// Feature softball/about — CLIENT-SAFE view types + constants.
//
// This module has NO `server-only` import and pulls in NO Supabase client, so it can be
// imported from Client Components (e.g. components/client/board-member-form.tsx) without
// poisoning the browser bundle. lib/board.ts (server-only: it wires createAdminClient)
// re-exports every symbol here, so server callers keep importing from "@/lib/board".
// Keep purely-presentational shapes + constants here; keep data-access here-adjacent in
// lib/board.ts.

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

// The canonical slug for the mission singleton. The ONLY site_content key this slice
// reads or writes.
export const ABOUT_MISSION_SLUG = "about_mission";

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
