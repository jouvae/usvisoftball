"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCommittee,
  updateCommittee,
  deleteCommittee,
  createCommitteeMember,
  updateCommitteeMember,
  deleteCommitteeMember,
  getCommitteeMemberPhotoUrl,
} from "@/lib/committees";
import { BoardPhotoUrlError } from "@/lib/board";
import {
  uploadBoardPhoto,
  deleteBoardPhotoByUrl,
  isBoardPhotoStorageUrl,
  BoardPhotoUploadError,
} from "@/lib/board-photos";
import type { SupabaseClient } from "@supabase/supabase-js";

// Feature softball/about — Slice 6 committees admin CRUD (about-e2e-012/013). Each action
// is an independently-callable POST endpoint, so it re-runs requireRole('editor') itself
// and writes through the editor SESSION client — the 0012 RLS is the real boundary, no
// admin/service fallback. Member photos reuse the board-photos bucket + validated upload.

export type CommitteeActionState = { error: string } | undefined;
export type CommitteeMemberActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function parseSortOrder(raw: string): number | null {
  const v = raw ? Number(raw) : 0;
  return Number.isNaN(v) ? null : v;
}

// Same photo resolver as the board actions: file → upload (editor session client); else
// removePhoto → null; else photoUrl text; else the authoritative server-read preserveUrl.
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

// ── committee CRUD ───────────────────────────────────────────────────────────

export async function createCommitteeAction(
  _prevState: CommitteeActionState,
  formData: FormData,
): Promise<CommitteeActionState> {
  await requireRole("editor");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? "").trim());
  if (!name) return { error: "Committee name is required." };
  if (sortOrder === null) return { error: "Sort order must be a number." };

  const supabase = await createSupabaseServerClient();
  try {
    await createCommittee({ name, description, sortOrder }, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      return { error: "A committee with a similar name already exists." };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not create the committee. Please try again." };
    }
    throw err;
  }
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}

export async function updateCommitteeAction(
  id: string,
  _prevState: CommitteeActionState,
  formData: FormData,
): Promise<CommitteeActionState> {
  await requireRole("editor");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? "").trim());
  if (!name) return { error: "Committee name is required." };
  if (sortOrder === null) return { error: "Sort order must be a number." };

  const supabase = await createSupabaseServerClient();
  try {
    await updateCommittee(id, { name, description, sortOrder }, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not save the committee. Please try again." };
    }
    throw err;
  }
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}

export async function deleteCommitteeAction(
  id: string,
): Promise<CommitteeActionState> {
  await requireRole("editor");
  const supabase = await createSupabaseServerClient();
  // Best-effort: reap the Storage photos of the members that will cascade-delete.
  let memberPhotoUrls: string[] = [];
  try {
    const { data } = await supabase
      .from("committee_members")
      .select("photo_url")
      .eq("committee_id", id);
    memberPhotoUrls = (data ?? [])
      .map((r) => (r as { photo_url: string | null }).photo_url ?? "")
      .filter((u) => isBoardPhotoStorageUrl(u));
  } catch {
    // non-fatal — worst case a few orphan objects remain
  }
  try {
    await deleteCommittee(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not delete the committee." };
    }
    throw err;
  }
  for (const url of memberPhotoUrls) {
    await deleteBoardPhotoByUrl(url, supabase);
  }
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}

// ── committee-member CRUD ────────────────────────────────────────────────────

export async function createCommitteeMemberAction(
  committeeId: string,
  _prevState: CommitteeMemberActionState,
  formData: FormData,
): Promise<CommitteeMemberActionState> {
  await requireRole("editor");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? "").trim());
  if (!name) return { error: "Member name is required." };
  if (sortOrder === null) return { error: "Sort order must be a number." };

  const supabase = await createSupabaseServerClient();
  let photoUrl: string | null;
  try {
    photoUrl = await resolvePhotoFromForm(formData, supabase);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await createCommitteeMember(
      { committeeId, name, role, bio, photoUrl, sortOrder },
      supabase,
    );
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    await deleteBoardPhotoByUrl(photoUrl, supabase);
    if (pgErrorCode(err) === "23505") {
      return { error: "That committee already has a member with this name." };
    }
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not add this member. Please try again." };
    }
    throw err;
  }
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}

export async function updateCommitteeMemberAction(
  id: string,
  _prevState: CommitteeMemberActionState,
  formData: FormData,
): Promise<CommitteeMemberActionState> {
  await requireRole("editor");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const sortOrder = parseSortOrder(String(formData.get("sortOrder") ?? "").trim());
  if (!name) return { error: "Member name is required." };
  if (sortOrder === null) return { error: "Sort order must be a number." };

  const supabase = await createSupabaseServerClient();
  let oldPhoto: string | null = null;
  try {
    oldPhoto = await getCommitteeMemberPhotoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  let nextPhoto: string | null;
  try {
    nextPhoto = await resolvePhotoFromForm(formData, supabase, oldPhoto);
  } catch (err) {
    if (err instanceof BoardPhotoUploadError) return { error: err.message };
    throw err;
  }
  try {
    await updateCommitteeMember(
      id,
      { name, role, bio, photoUrl: nextPhoto, sortOrder },
      supabase,
    );
  } catch (err) {
    if (err instanceof BoardPhotoUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116") {
      if (isBoardPhotoStorageUrl(nextPhoto) && nextPhoto !== oldPhoto) {
        await deleteBoardPhotoByUrl(nextPhoto, supabase);
      }
      return { error: "Could not save this member. Please try again." };
    }
    throw err;
  }
  if (oldPhoto && oldPhoto !== nextPhoto) {
    await deleteBoardPhotoByUrl(oldPhoto, supabase);
  }
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}

export async function deleteCommitteeMemberAction(
  id: string,
): Promise<CommitteeMemberActionState> {
  await requireRole("editor");
  const supabase = await createSupabaseServerClient();
  let photo: string | null = null;
  try {
    photo = await getCommitteeMemberPhotoUrl(id, supabase);
  } catch {
    // non-fatal
  }
  try {
    await deleteCommitteeMember(id, supabase);
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116") {
      return { error: "Could not remove this member." };
    }
    throw err;
  }
  await deleteBoardPhotoByUrl(photo, supabase);
  revalidatePath("/about");
  revalidatePath("/admin/committees");
  return undefined;
}
