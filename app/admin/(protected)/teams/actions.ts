"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamLogoUrl,
  getTeamOwnedPhotoUrls,
  type Island,
} from "@/lib/teams";
import { ISLAND_LABELS } from "@/lib/teams-view";
import { BoardPhotoUrlError } from "@/lib/board";
import {
  uploadBoardPhoto,
  deleteBoardPhotoByUrl,
  isBoardPhotoStorageUrl,
  BoardPhotoUploadError,
} from "@/lib/board-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Feature softball/teams — Slice 3 teams admin CRUD (teams-e2e-003). Each action is an
// independently-callable POST endpoint: it re-runs requireRole('editor') and writes via the
// editor SESSION client — the 0015 RLS is the real boundary, no admin/service fallback. Team
// logos reuse the board-photos bucket + validated upload; deleting a team reaps its logo AND
// its cascade-deleted players' photo objects.

export type TeamActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function parseIntOrNull(raw: string): number | null | undefined {
  // "" → null (clear); a non-number → undefined (signal invalid)
  const t = raw.trim();
  if (!t) return null;
  const v = Number(t);
  return Number.isNaN(v) ? undefined : v;
}

function isValidIsland(v: string): v is Island {
  return Object.prototype.hasOwnProperty.call(ISLAND_LABELS, v);
}

// file → upload (editor session client); else removeLogo → null; else logoUrl text; else
// the authoritative server-read preserveUrl.
async function resolveLogoFromForm(
  formData: FormData,
  supabase: SupabaseClient,
  preserveUrl: string | null = null,
): Promise<string | null> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) {
    return await uploadBoardPhoto(file, supabase);
  }
  if (formData.get("removeLogo")) return null;
  const text = String(formData.get("logoUrl") ?? "").trim();
  if (text) return text;
  return preserveUrl;
}

// Read the common team fields off the form. Returns an error string or the parsed fields.
function readTeamFields(formData: FormData):
  | { error: string }
  | {
      name: string;
      island: Island;
      division: string;
      description: string;
      homeVenue: string;
      foundedYear: number | null;
      sortOrder: number;
    } {
  const name = String(formData.get("name") ?? "").trim();
  const island = String(formData.get("island") ?? "").trim();
  const division = String(formData.get("division") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const homeVenue = String(formData.get("homeVenue") ?? "").trim();
  const foundedYear = parseIntOrNull(String(formData.get("foundedYear") ?? ""));
  const sortOrderRaw = parseIntOrNull(String(formData.get("sortOrder") ?? ""));

  if (!name) return { error: "Team name is required." };
  if (!isValidIsland(island)) return { error: "Choose a valid island." };
  if (foundedYear === undefined) return { error: "Founded year must be a number." };
  if (sortOrderRaw === undefined) return { error: "Sort order must be a number." };

  return {
    name,
    island,
    division,
    description,
    homeVenue,
    foundedYear,
    sortOrder: sortOrderRaw ?? 0,
  };
}

export async function createTeamAction(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  await requireRole("editor");
  const f = readTeamFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let logoUrl: string | null;
  try {
    logoUrl = await resolveLogoFromForm(formData, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await createTeam({ ...f, logoUrl }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    await deleteBoardPhotoByUrl(logoUrl, supabase);
    if (pgErrorCode(err) === "23505") {
      return { error: "A team with a similar name already exists." };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not create the team. Please try again." };
    }
    throw err;
  }
  revalidatePath("/teams");
  revalidatePath("/admin/teams");
  return undefined;
}

export async function updateTeamAction(
  id: string,
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  await requireRole("editor");
  const f = readTeamFields(formData);
  if ("error" in f) return f;

  const supabase = await createSupabaseServerClient();
  let oldLogo: string | null = null;
  try {
    oldLogo = await getTeamLogoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  let nextLogo: string | null;
  try {
    nextLogo = await resolveLogoFromForm(formData, supabase, oldLogo);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await updateTeam(id, { ...f, logoUrl: nextLogo }, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116") {
      if (isBoardPhotoStorageUrl(nextLogo) && nextLogo !== oldLogo) {
        await deleteBoardPhotoByUrl(nextLogo, supabase);
      }
      return { error: "Could not save the team. Please try again." };
    }
    throw err;
  }
  if (oldLogo && oldLogo !== nextLogo) {
    await deleteBoardPhotoByUrl(oldLogo, supabase);
  }
  revalidatePath("/teams");
  revalidatePath("/admin/teams");
  return undefined;
}

export async function deleteTeamAction(id: string): Promise<TeamActionState> {
  await requireRole("editor");
  const supabase = await createSupabaseServerClient();
  // Reap the team's logo + its (cascade-deleting) players' photos — read before the delete.
  let ownedPhotos: string[] = [];
  try {
    ownedPhotos = (await getTeamOwnedPhotoUrls(id, supabase)).filter((u) =>
      isBoardPhotoStorageUrl(u),
    );
  } catch {
    // non-fatal — worst case a few orphan objects remain
  }
  try {
    await deleteTeam(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not delete the team." };
    }
    throw err;
  }
  for (const url of ownedPhotos) {
    await deleteBoardPhotoByUrl(url, supabase);
  }
  revalidatePath("/teams");
  revalidatePath("/admin/teams");
  return undefined;
}
