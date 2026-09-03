"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  updateMission,
  createBoardMember,
  updateBoardMember,
  deleteBoardMember,
  rollBoardTerm,
  getBoardMemberPhotoUrl,
  BoardPhotoUrlError,
  BoardSocialUrlError,
  SEAT_LABELS,
  type BoardSeat,
  type UpdateBoardMemberFields,
} from "@/lib/board";
import { BOARD_SOCIAL_PLATFORMS } from "@/lib/board-view";
import {
  uploadBoardPhoto,
  deleteBoardPhotoByUrl,
  isBoardPhotoStorageUrl,
  BoardPhotoUploadError,
} from "@/lib/board-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Feature softball/about — Slice 2 admin CRUD Server Actions (about-e2e-004..006).
//
// Each action is an independently-reachable POST endpoint (server-actions.md
// §Security), so it AUTHENTICATES + AUTHORIZES itself: `requireRole('editor')`
// runs requireUser() (redirects an anon request) then confirms editor membership
// through the RLS session client — it does NOT lean on the (protected) layout guard.
// FormData is untrusted, so every field is validated. Every write goes through the
// SESSION client (createSupabaseServerClient), so the 0007 editor RLS policies are
// the real boundary — there is no admin/service-client fallback on this path.
//
// A `BoardPhotoUrlError` (photo allowlist) maps to a friendly form error; a
// PostgrestError PGRST116 (0 rows — a non-editor or an archived-term H2 denial)
// maps to a generic form error; any other error re-throws to the error boundary.
// On success we revalidate BOTH the public /about render and this admin screen.
// ---------------------------------------------------------------------------

export type MissionActionState = { error: string } | undefined;
export type BoardMemberActionState = { error: string } | undefined;
export type DeleteMemberActionState = { error: string } | undefined;
export type RollTermActionState = { error: string } | undefined;

function isValidSeat(value: string): value is BoardSeat {
  return Object.prototype.hasOwnProperty.call(SEAT_LABELS, value);
}

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

// Resolve the photo for a create/edit submit, in precedence order:
//   1. a chosen FILE  → validate + upload to Supabase Storage via the editor SESSION
//      client (RLS) and return its public URL (throws BoardPhotoUploadError on a bad file);
//   2. the `removePhoto` toggle → null (explicit clear);
//   3. a `photoUrl` text value → that (a local /seed path);
//   4. `preserveUrl` → the existing photo on a bare edit (add mode passes null).
// `preserveUrl` is the AUTHORITATIVE server-read value (getBoardMemberPhotoUrl), never a
// client field — so a forged input can't repoint one member at another's object (red-team
// Low). `File` is a Node 20+ global; a file input with no selection posts a 0-byte entry.
async function resolvePhotoFromForm(
  formData: FormData,
  supabase: SupabaseClient,
  preserveUrl: string | null = null,
): Promise<string | null> {
  const file = formData.get("photoFile");
  if (file instanceof File && file.size > 0) {
    return await uploadBoardPhoto(file, supabase);
  }
  if (formData.get("removePhoto")) return null;
  const text = String(formData.get("photoUrl") ?? "").trim();
  if (text) return text;
  return preserveUrl;
}

// updateMissionAction (about-e2e-004): edit the mission prose in place.
export async function updateMissionAction(
  _prevState: MissionActionState,
  formData: FormData,
): Promise<MissionActionState> {
  await requireRole("editor");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    return { error: "The mission statement cannot be empty." };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await updateMission(body, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not save the mission. Please try again." };
    }
    throw err;
  }

  revalidatePath("/about");
  revalidatePath("/admin/board");
  return undefined;
}

// Read the four social-link fields (facebookUrl / instagramUrl / linkedinUrl / xUrl) from
// the untrusted FormData, trimmed. '' means "no link" — the lib validator skips empties and
// the update path clears the column. Driven by BOARD_SOCIAL_PLATFORMS so the form, the DB
// columns, and this parse never drift.
function readSocialsFromForm(formData: FormData): {
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  xUrl: string;
} {
  return Object.fromEntries(
    BOARD_SOCIAL_PLATFORMS.map((p) => [
      `${p}Url`,
      String(formData.get(`${p}Url`) ?? "").trim(),
    ]),
  ) as {
    facebookUrl: string;
    instagramUrl: string;
    linkedinUrl: string;
    xUrl: string;
  };
}

// createBoardMemberAction (about-e2e-005): add a member to the CURRENT term. The
// term id is bound server-side (page passes the current term's id), so it is a
// closure reference, never a forgeable field.
export async function createBoardMemberAction(
  termId: string,
  _prevState: BoardMemberActionState,
  formData: FormData,
): Promise<BoardMemberActionState> {
  await requireRole("editor");

  const name = String(formData.get("name") ?? "").trim();
  const seat = String(formData.get("seat") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();

  if (!name || !seat || !role) {
    return { error: "Name, seat, and role are required." };
  }
  if (!isValidSeat(seat)) {
    return { error: "Choose a valid island seat." };
  }
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  if (Number.isNaN(sortOrder)) {
    return { error: "Sort order must be a number." };
  }

  const supabase = await createSupabaseServerClient();
  let photoUrl: string | null;
  try {
    photoUrl = await resolvePhotoFromForm(formData, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  const socials = readSocialsFromForm(formData);
  try {
    await createBoardMember(
      { termId, name, seat, role, photoUrl, bio, sortOrder, ...socials },
      supabase,
    );
  } catch (err) {
    if (err instanceof BoardPhotoUrlError || err instanceof BoardSocialUrlError) {
      // A rejected social URL is a validation error, not an orphaned-photo case — but the
      // photo already uploaded, so clean it up before returning the friendly message.
      await deleteBoardPhotoByUrl(photoUrl, supabase);
      return { error: err.message };
    }
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23505") {
      // The member write failed after the photo uploaded — clean up the orphan.
      await deleteBoardPhotoByUrl(photoUrl, supabase);
      return { error: "Could not add this member. Please try again." };
    }
    await deleteBoardPhotoByUrl(photoUrl, supabase);
    throw err;
  }

  revalidatePath("/about");
  revalidatePath("/admin/board");
  return undefined;
}

// updateBoardMemberAction (about-e2e-005): PATCH one current-term member. The id is
// bound server-side. The edit form submits every column; an empty photo clears it.
export async function updateBoardMemberAction(
  id: string,
  _prevState: BoardMemberActionState,
  formData: FormData,
): Promise<BoardMemberActionState> {
  await requireRole("editor");

  const name = String(formData.get("name") ?? "").trim();
  const seat = String(formData.get("seat") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();

  if (!name || !seat || !role) {
    return { error: "Name, seat, and role are required." };
  }
  if (!isValidSeat(seat)) {
    return { error: "Choose a valid island seat." };
  }
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  if (Number.isNaN(sortOrder)) {
    return { error: "Sort order must be a number." };
  }

  const supabase = await createSupabaseServerClient();
  // The prior photo (if any) — to delete its Storage object when it's replaced/cleared.
  let oldPhoto: string | null = null;
  try {
    oldPhoto = await getBoardMemberPhotoUrl(id, supabase);
  } catch {
    // non-fatal; skip orphan cleanup if we can't read the prior value
  }
  let nextPhoto: string | null;
  try {
    nextPhoto = await resolvePhotoFromForm(formData, supabase, oldPhoto);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }

  const socials = readSocialsFromForm(formData);
  const fields: UpdateBoardMemberFields = {
    name,
    seat,
    role,
    photoUrl: nextPhoto,
    bio,
    sortOrder,
    ...socials,
  };

  try {
    await updateBoardMember(id, fields, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUrlError || err instanceof BoardSocialUrlError) {
      // The write didn't happen — a freshly-uploaded photo would be an orphan; clean it up
      // (guards leave the OLD photo untouched via isBoardPhotoStorageUrl + the !== check).
      if (isBoardPhotoStorageUrl(nextPhoto) && nextPhoto !== oldPhoto) {
        await deleteBoardPhotoByUrl(nextPhoto, supabase);
      }
      return { error: err.message };
    }
    if (pgErrorCode(err) === "PGRST116") {
      // 0 rows updated (non-editor / archived-term guard) — the write didn't happen, so
      // the OLD photo is still in use; only clean up a freshly-uploaded orphan.
      if (isBoardPhotoStorageUrl(nextPhoto) && nextPhoto !== oldPhoto) {
        await deleteBoardPhotoByUrl(nextPhoto, supabase);
      }
      return { error: "Could not save this member. Please try again." };
    }
    throw err;
  }

  // Success: if the photo changed, delete the prior uploaded object (best effort).
  if (oldPhoto && oldPhoto !== nextPhoto) {
    await deleteBoardPhotoByUrl(oldPhoto, supabase);
  }

  revalidatePath("/about");
  revalidatePath("/admin/board");
  return undefined;
}

// deleteBoardMemberAction (about-e2e-005): remove one current-term member. The id is
// bound server-side; RLS forbids deleting an archived-term member (H2 permanence).
export async function deleteBoardMemberAction(
  id: string,
): Promise<DeleteMemberActionState> {
  await requireRole("editor");

  const supabase = await createSupabaseServerClient();
  try {
    await deleteBoardMember(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not remove this member." };
    }
    throw err;
  }

  revalidatePath("/about");
  revalidatePath("/admin/board");
  return undefined;
}

// rollBoardTermAction (about-e2e-006): roll the board to a new term. The prior
// roster is never touched — permanence holds by construction (lib/board.rollBoardTerm).
export async function rollBoardTermAction(
  _prevState: RollTermActionState,
  formData: FormData,
): Promise<RollTermActionState> {
  await requireRole("editor");

  const newSlug = String(formData.get("newSlug") ?? "").trim();
  const newLabel = String(formData.get("newLabel") ?? "").trim();

  if (!newSlug || !newLabel) {
    return { error: "A term slug and label are both required." };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await rollBoardTerm({ newSlug, newLabel }, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23505") {
      return { error: "Could not roll the term. Please try again." };
    }
    throw err;
  }

  revalidatePath("/about");
  revalidatePath("/admin/board");
  return undefined;
}
