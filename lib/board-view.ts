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

// Board-member social platforms (MVP slice 5). EMAIL is intentionally absent (product
// decision: the profile modal shows social links, not an email). Each link is optional.
export type BoardSocialPlatform = "facebook" | "instagram" | "linkedin" | "x";

export interface BoardSocials {
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  x: string | null;
}

// Per-platform https host allowlist — the SINGLE source of truth for BOTH the write-side
// validation (lib/board assertBoardSocialUrlAllowed) and the render-side guard below, so a
// social <a href> can only ever point at the real platform. Blocks javascript:/data:
// schemes (stored XSS via href) and off-platform open-redirects — the field is editor-
// supplied and rendered as a public link.
export const BOARD_SOCIAL_HOSTS: Record<BoardSocialPlatform, readonly string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
};

export const BOARD_SOCIAL_LABELS: Record<BoardSocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
};

// The platforms in render order — one place drives the modal link list + the form inputs.
export const BOARD_SOCIAL_PLATFORMS: readonly BoardSocialPlatform[] = [
  "facebook",
  "instagram",
  "linkedin",
  "x",
];

// Render-time guard (CLIENT-SAFE: no server-only import, so the modal client island can
// call it). Returns the URL to use as an <a href> ONLY if it is https on the platform's
// allowlisted host; otherwise ''. So even a value that reached the DB around the app write
// path (a misused editor token on PostgREST, or a future non-validating writer) is dropped
// at render, never emitted as a live link. Mirrors lib/contact.ts safeSocialHref.
export function safeBoardSocialHref(
  url: string | null | undefined,
  platform: BoardSocialPlatform,
): string {
  if (!url) return "";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "";
  }
  // Reject embedded credentials (https://user:pass@facebook.com) — the host is the real
  // platform so it is not an open-redirect, but userinfo has no place in a public profile
  // link and browsers warn on it (red-team-code Low). Then https + exact host allowlist.
  if (u.username || u.password) return "";
  return u.protocol === "https:" && BOARD_SOCIAL_HOSTS[platform].includes(u.host)
    ? url
    : "";
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
  socials: BoardSocials; // MVP slice 5; each link null when unset
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
