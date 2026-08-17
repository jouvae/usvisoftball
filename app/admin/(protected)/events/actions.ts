"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventLogoUrl,
  type EventIsland,
} from "@/lib/events";
import { EVENT_ISLAND_LABELS } from "@/lib/events-view";
import { BoardPhotoUrlError } from "@/lib/board";
import {
  uploadBoardPhoto,
  deleteBoardPhotoByUrl,
  isBoardPhotoStorageUrl,
  BoardPhotoUploadError,
} from "@/lib/board-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Feature softball/events — Slice 3 events admin CRUD (events-e2e-003). Each action re-runs
// requireRole('editor') and writes via the editor SESSION client — the 0018 RLS is the real
// boundary, no admin/service fallback. id bound server-side. Event logos reuse the
// board-photos bucket; deleting an event reaps its logo object.

export type EventActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function isValidIsland(v: string): v is EventIsland {
  return Object.prototype.hasOwnProperty.call(EVENT_ISLAND_LABELS, v);
}

// A date field: '' → null; otherwise must be a real ISO 'YYYY-MM-DD' (the <input type=date>
// posts this shape). Returns null (clear), the string (valid), or undefined (invalid).
function parseDate(raw: string): string | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const d = new Date(t + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? undefined : t;
}

function parseSortOrder(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return 0;
  const v = Number(t);
  return Number.isNaN(v) ? undefined : v;
}

// file → upload (editor session client, uploaded:true); else removeLogo → null; else logoUrl
// text; else preserveUrl. `uploaded` lets a caller reap only objects it uploaded.
async function resolveLogoFromForm(
  formData: FormData,
  supabase: SupabaseClient,
  preserveUrl: string | null = null,
): Promise<{ url: string | null; uploaded: boolean }> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) {
    return { url: await uploadBoardPhoto(file, supabase), uploaded: true };
  }
  if (formData.get("removeLogo")) return { url: null, uploaded: false };
  const text = String(formData.get("logoUrl") ?? "").trim();
  if (text) return { url: text, uploaded: false };
  return { url: preserveUrl, uploaded: false };
}

type EventFields =
  | { error: string }
  | {
      name: string;
      description: string;
      venue: string;
      island: EventIsland | null;
      startDate: string | null;
      endDate: string | null;
      sortOrder: number;
    };

function readEventFields(formData: FormData): EventFields {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const islandRaw = String(formData.get("island") ?? "").trim();
  const startDate = parseDate(String(formData.get("startDate") ?? ""));
  const endDate = parseDate(String(formData.get("endDate") ?? ""));
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? ""));

  if (!name) return { error: "Event name is required." };
  // '' island = territory-wide (null); any non-empty value must be a valid island.
  if (islandRaw !== "" && !isValidIsland(islandRaw)) {
    return { error: "Choose a valid island (or leave it territory-wide)." };
  }
  const island: EventIsland | null = islandRaw === "" ? null : islandRaw;
  if (startDate === undefined) return { error: "Start date is invalid." };
  if (endDate === undefined) return { error: "End date is invalid." };
  if (startDate && endDate && endDate < startDate) {
    return { error: "End date can’t be before the start date." };
  }
  if (sortOrder === undefined) return { error: "Sort order must be a number." };

  return { name, description, venue, island, startDate, endDate, sortOrder };
}

export async function createEventAction(
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  await requireRole("editor");
  const f = readEventFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let logoUrl: string | null;
  let logoUploaded: boolean;
  try {
    ({ url: logoUrl, uploaded: logoUploaded } = await resolveLogoFromForm(
      formData,
      supabase,
    ));
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await createEvent({ ...f, logoUrl }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    if (logoUploaded) await deleteBoardPhotoByUrl(logoUrl, supabase);
    if (pgErrorCode(err) === "23505") {
      return { error: "An event with a similar name already exists." };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not create the event. Please try again." };
    }
    throw err;
  }
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return undefined;
}

export async function updateEventAction(
  id: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  await requireRole("editor");
  const f = readEventFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let oldLogo: string | null = null;
  try {
    oldLogo = await getEventLogoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  let nextLogo: string | null;
  let logoUploaded: boolean;
  try {
    ({ url: nextLogo, uploaded: logoUploaded } = await resolveLogoFromForm(
      formData,
      supabase,
      oldLogo,
    ));
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await updateEvent(id, { ...f, logoUrl: nextLogo }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116") {
      if (logoUploaded) await deleteBoardPhotoByUrl(nextLogo, supabase);
      return { error: "Could not save the event. Please try again." };
    }
    throw err;
  }
  // On success, if the logo changed, reap the prior uploaded object (best effort).
  if (oldLogo && oldLogo !== nextLogo && isBoardPhotoStorageUrl(oldLogo)) {
    await deleteBoardPhotoByUrl(oldLogo, supabase);
  }
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return undefined;
}

export async function deleteEventAction(id: string): Promise<EventActionState> {
  await requireRole("editor");
  const supabase = await createSupabaseServerClient();
  let logo: string | null = null;
  try {
    logo = await getEventLogoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  try {
    await deleteEvent(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not delete the event." };
    }
    throw err;
  }
  if (isBoardPhotoStorageUrl(logo)) await deleteBoardPhotoByUrl(logo, supabase);
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return undefined;
}
