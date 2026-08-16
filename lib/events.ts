import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import {
  type EventIsland,
  type FederationEvent,
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
} from "@/lib/events-view";

// ---------------------------------------------------------------------------
// Feature softball/events — events directory (read side).
//
// SERVER ONLY. Reads through the RLS-enforced publishable client (public /events render of
// the 0017 public-read policy). Editor writes arrive with the events admin-CRUD slice.
// Client-safe types/constants live in lib/events-view.ts (re-exported below).
// ---------------------------------------------------------------------------

export {
  type EventIsland,
  type FederationEvent,
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
};

type EventRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  venue: string;
  island: EventIsland | null;
  start_date: string | null;
  end_date: string | null;
  logo_url: string;
  sort_order: number;
};

function toEvent(row: EventRow): FederationEvent {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    venue: row.venue,
    island: row.island,
    startDate: row.start_date,
    endDate: row.end_date,
    logoUrl: row.logo_url,
    sortOrder: row.sort_order,
  };
}

const COLUMNS =
  "id,name,slug,description,venue,island,start_date,end_date,logo_url,sort_order";

// All events, bounded read. Ordering is applied per-group in splitEventsByDate.
export async function listEvents(
  supabase: SupabaseClient = createPublicClient(),
): Promise<FederationEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .limit(200);
  if (error) throw error;
  return (data as EventRow[] | null ?? []).map(toEvent);
}

// Today's date as an ISO 'YYYY-MM-DD' string in UTC — the boundary for upcoming vs past.
// Passed in so the pure split function stays deterministic/testable.
export function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// Split events into Upcoming (end_date >= today, OR no end_date — undated events are treated
// as upcoming/current) and Past (end_date < today). Upcoming sorted soonest-first
// (sort_order, then start_date asc); Past most-recent-first (end_date desc, then sort_order).
export function splitEventsByDate(
  events: FederationEvent[],
  todayIso: string,
): { upcoming: FederationEvent[]; past: FederationEvent[] } {
  const upcoming: FederationEvent[] = [];
  const past: FederationEvent[] = [];
  for (const e of events) {
    if (e.endDate && e.endDate < todayIso) past.push(e);
    else upcoming.push(e);
  }
  upcoming.sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") ||
      a.name.localeCompare(b.name),
  );
  past.sort(
    (a, b) =>
      (b.endDate ?? "").localeCompare(a.endDate ?? "") ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
  return { upcoming, past };
}
