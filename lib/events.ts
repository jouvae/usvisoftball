import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { assertBoardPhotoUrlAllowed } from "@/lib/board";
import {
  type EventIsland,
  type FederationEvent,
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
  safeEventLogoHref,
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
  safeEventLogoHref,
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

// One event by slug. Returns null when the slug doesn't exist — the detail page maps that
// to a 404. The slug is passed as a parametrized .eq filter (no interpolation/injection).
export async function getEventBySlug(
  slug: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<FederationEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toEvent(data as EventRow) : null;
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

// ---------------------------------------------------------------------------
// Admin CRUD write paths (events-e2e-003). Every mutator takes an INJECTABLE session client
// with NO default — /admin/events always passes the editor cookie client, so the 0018
// editor RLS is the real boundary. A non-editor matches 0 rows → PGRST116. Logo reuses the
// board photo allowlist (assertBoardPhotoUrlAllowed). Dates are ISO 'YYYY-MM-DD' or null.
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  name: string;
  description?: string;
  venue?: string;
  island?: EventIsland | null;
  startDate?: string | null;
  endDate?: string | null;
  logoUrl?: string | null;
  sortOrder?: number;
}

export interface UpdateEventFields {
  name?: string;
  description?: string;
  venue?: string;
  island?: EventIsland | null;
  startDate?: string | null;
  endDate?: string | null;
  logoUrl?: string | null;
  sortOrder?: number;
}

// URL-safe slug from the event name. Stable once created (the /events/[slug] URL doesn't
// break when a name is corrected).
function slugifyEvent(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

export async function createEvent(
  input: CreateEventInput,
  supabase: SupabaseClient,
): Promise<FederationEvent> {
  assertBoardPhotoUrlAllowed(input.logoUrl);
  const { data, error } = await supabase
    .from("events")
    .insert({
      name: input.name,
      slug: slugifyEvent(input.name),
      description: input.description ?? "",
      venue: input.venue ?? "",
      island: input.island ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      logo_url: input.logoUrl ?? "",
      sort_order: input.sortOrder ?? 0,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toEvent(data as EventRow);
}

// Update an event's fields. The slug is intentionally NOT changed.
export async function updateEvent(
  id: string,
  fields: UpdateEventFields,
  supabase: SupabaseClient,
): Promise<FederationEvent> {
  if (fields.logoUrl !== undefined) assertBoardPhotoUrlAllowed(fields.logoUrl);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.venue !== undefined) patch.venue = fields.venue;
  if (fields.island !== undefined) patch.island = fields.island;
  if (fields.startDate !== undefined) patch.start_date = fields.startDate;
  if (fields.endDate !== undefined) patch.end_date = fields.endDate;
  if (fields.logoUrl !== undefined) patch.logo_url = fields.logoUrl ?? "";
  if (fields.sortOrder !== undefined) patch.sort_order = fields.sortOrder;

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toEvent(data as EventRow);
}

export async function deleteEvent(
  id: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

// One event's logo_url (or null) — for deleting the prior Storage object on replace/clear/delete.
export async function getEventLogoUrl(
  id: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("events")
    .select("logo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const url = (data as { logo_url: string | null } | null)?.logo_url;
  return url ? url : null;
}
