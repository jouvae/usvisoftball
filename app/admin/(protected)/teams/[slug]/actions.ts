"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTeamPlayer,
  updateTeamPlayer,
  deleteTeamPlayer,
  getTeamPlayerPhotoUrl,
} from "@/lib/teams";
import { BoardPhotoUrlError } from "@/lib/board";
import {
  uploadBoardPhoto,
  deleteBoardPhotoByUrl,
  BoardPhotoUploadError,
} from "@/lib/board-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Feature softball/teams — Slice 4 roster (player) admin CRUD (teams-e2e-004). Each action
// re-runs requireRole('editor') and writes via the editor SESSION client — the 0016 RLS is
// the real boundary, no admin/service fallback. teamId (create) and player id (edit/delete)
// are bound server-side by the roster page. Player photos reuse the board-photos bucket.
// `slug` is bound only to revalidate the right public detail path.

export type PlayerActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function parseIntOrNull(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  const v = Number(t);
  return Number.isNaN(v) ? undefined : v;
}

// Returns { url, uploaded } — `uploaded` is true ONLY when this request uploaded a new
// object, so a caller can reap that object on a later failure without ever deleting a
// pre-existing (typed) shared object (red-team-code Low).
async function resolvePhotoFromForm(
  formData: FormData,
  supabase: SupabaseClient,
  preserveUrl: string | null = null,
): Promise<{ url: string | null; uploaded: boolean }> {
  const file = formData.get("photoFile");
  if (file instanceof File && file.size > 0) {
    return { url: await uploadBoardPhoto(file, supabase), uploaded: true };
  }
  if (formData.get("removePhoto")) return { url: null, uploaded: false };
  const text = String(formData.get("photoUrl") ?? "").trim();
  if (text) return { url: text, uploaded: false };
  return { url: preserveUrl, uploaded: false };
}

type PlayerFields =
  | { error: string }
  | {
      name: string;
      jerseyNumber: number | null;
      position: string;
      batsThrows: string;
      hometown: string;
      sortOrder: number;
    };

function readPlayerFields(formData: FormData): PlayerFields {
  const name = String(formData.get("name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const batsThrows = String(formData.get("batsThrows") ?? "").trim();
  const hometown = String(formData.get("hometown") ?? "").trim();
  const jerseyNumber = parseIntOrNull(String(formData.get("jerseyNumber") ?? ""));
  const sortOrder = parseIntOrNull(String(formData.get("sortOrder") ?? ""));
  if (!name) return { error: "Player name is required." };
  if (jerseyNumber === undefined) return { error: "Jersey number must be a number." };
  if (sortOrder === undefined) return { error: "Sort order must be a number." };
  return {
    name,
    jerseyNumber,
    position,
    batsThrows,
    hometown,
    sortOrder: sortOrder ?? 0,
  };
}

export async function createPlayerAction(
  teamId: string,
  slug: string,
  _prevState: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  await requireRole("editor");
  const f = readPlayerFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let photoUrl: string | null;
  let photoUploaded: boolean;
  try {
    ({ url: photoUrl, uploaded: photoUploaded } = await resolvePhotoFromForm(
      formData,
      supabase,
    ));
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await createTeamPlayer({ teamId, ...f, photoUrl }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    // Only reap the object if THIS request uploaded it — never delete a typed, pre-existing
    // (possibly shared) object on a create failure.
    if (photoUploaded) await deleteBoardPhotoByUrl(photoUrl, supabase);
    if (pgErrorCode(err) === "23505") {
      return { error: "This team already has a player with that name." };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not add this player. Please try again." };
    }
    throw err;
  }
  revalidatePath("/teams");
  revalidatePath(`/teams/${slug}`);
  revalidatePath(`/admin/teams/${slug}`);
  return undefined;
}

export async function updatePlayerAction(
  id: string,
  slug: string,
  _prevState: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  await requireRole("editor");
  const f = readPlayerFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let oldPhoto: string | null = null;
  try {
    oldPhoto = await getTeamPlayerPhotoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  let nextPhoto: string | null;
  let photoUploaded: boolean;
  try {
    ({ url: nextPhoto, uploaded: photoUploaded } = await resolvePhotoFromForm(
      formData,
      supabase,
      oldPhoto,
    ));
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await updateTeamPlayer(id, { ...f, photoUrl: nextPhoto }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116") {
      // Only reap an object THIS request uploaded — never a typed/preserved existing one.
      if (photoUploaded) await deleteBoardPhotoByUrl(nextPhoto, supabase);
      return { error: "Could not save this player. Please try again." };
    }
    throw err;
  }
  if (oldPhoto && oldPhoto !== nextPhoto) {
    await deleteBoardPhotoByUrl(oldPhoto, supabase);
  }
  revalidatePath("/teams");
  revalidatePath(`/teams/${slug}`);
  revalidatePath(`/admin/teams/${slug}`);
  return undefined;
}

export async function deletePlayerAction(
  id: string,
  slug: string,
): Promise<PlayerActionState> {
  await requireRole("editor");
  const supabase = await createSupabaseServerClient();
  let photo: string | null = null;
  try {
    photo = await getTeamPlayerPhotoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  try {
    await deleteTeamPlayer(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not remove this player." };
    }
    throw err;
  }
  await deleteBoardPhotoByUrl(photo, supabase);
  revalidatePath("/teams");
  revalidatePath(`/teams/${slug}`);
  revalidatePath(`/admin/teams/${slug}`);
  return undefined;
}
