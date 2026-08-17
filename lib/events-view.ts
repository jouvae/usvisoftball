// Feature softball/events — CLIENT-SAFE view types + constants.
//
// No `server-only`, no Supabase client — safe to import from Client Components (the future
// events-admin island's island <select> needs ISLAND_LABELS). lib/events.ts (server-only)
// re-exports these. Same split as lib/teams-view.ts / lib/board-view.ts.

import { safeStoredImageHref } from "@/lib/safe-image-url";

// Reuse the same three-island taxonomy as teams; an event's island is OPTIONAL (a
// territory-wide event spans all islands → null).
export type EventIsland = "st_thomas" | "st_john" | "st_croix";

export const EVENT_ISLAND_LABELS: Record<EventIsland, string> = {
  st_thomas: "St. Thomas",
  st_john: "St. John",
  st_croix: "St. Croix",
};

// Render-time guard for an event logo URL. Delegates to the single shared, host-aware guard
// (lib/safe-image-url) so it stays in lockstep with the teams guard and the write boundary —
// an off-site https URL whose path merely matched the storage prefix is dropped.
export function safeEventLogoHref(url: string): string {
  return safeStoredImageHref(url);
}

// A federation event / tournament.
export interface FederationEvent {
  id: string;
  name: string;
  slug: string;
  description: string;
  venue: string;
  island: EventIsland | null;
  startDate: string | null; // ISO date 'YYYY-MM-DD' (no time) or null
  endDate: string | null;
  logoUrl: string;
  sortOrder: number;
}

// A team participating in an event (the event_teams join → teams). Lightweight: only what
// the event detail's Participating Teams section renders + links to.
export interface EventTeam {
  id: string;
  name: string;
  slug: string; // links to /teams/[slug]
  island: EventIsland | null;
}

// An event paired with its ordered list of participating teams — the shape the detail read
// returns.
export interface EventWithTeams extends FederationEvent {
  teams: EventTeam[];
}

// Human date-range label for a card, e.g. "Jun 1–7, 2099" or "Aug 15, 2099". Pure + UTC so
// server and client agree and it never depends on the viewer's timezone. Returns '' when no
// dates are set.
export function formatEventDateRange(
  startDate: string | null,
  endDate: string | null,
): string {
  const s = parseISODate(startDate);
  const e = parseISODate(endDate);
  if (!s && !e) return "";
  if (s && !e) return formatFull(s);
  if (!s && e) return formatFull(e!);
  // both present
  const start = s!;
  const end = e!;
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (start.getTime() === end.getTime()) return formatFull(start);
  if (sameMonth) {
    return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()} – ${MONTHS[end.getUTCMonth()]} ${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  return `${formatFull(start)} – ${formatFull(end)}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseISODate(d: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatFull(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
