"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createHighlight,
  deleteHighlight,
  updateHighlight,
  HIGHLIGHT_TEXT_MAX,
  isAllowedHighlightLink,
  type HighlightInput,
} from "@/lib/feed";

// Feature softball/home-feed — manual highlights admin CRUD (the stats admin pattern). Each
// action re-runs requireRole('editor') and writes via the editor SESSION client — the 0029 RLS
// is the real boundary. The id is bound server-side. Every write revalidates the home (both
// locales) so the rail reflects it on the next request.

export type HighlightActionState = { error: string } | undefined;

function readFields(formData: FormData): { error: string } | HighlightInput {
  const textEn = String(formData.get("textEn") ?? "").trim();
  const textEs = String(formData.get("textEs") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
  const isPublished = formData.get("isPublished") === "1";

  if (!textEn) return { error: "English text is required." };
  if (!textEs) return { error: "Spanish text is required — the Spanish site shows it." };
  if (textEn.length > HIGHLIGHT_TEXT_MAX || textEs.length > HIGHLIGHT_TEXT_MAX) {
    return { error: `Keep each text to ${HIGHLIGHT_TEXT_MAX} characters or fewer.` };
  }
  if (linkUrl && !isAllowedHighlightLink(linkUrl)) {
    return { error: "Link must start with https:// or be a site path like /events/…" };
  }
  return { textEn, textEs, linkUrl, isPublished };
}

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/es");
  revalidatePath("/admin/highlights");
}

export async function createHighlightAction(
  _prev: HighlightActionState,
  formData: FormData,
): Promise<HighlightActionState> {
  await requireRole("editor");
  const f = readFields(formData);
  if ("error" in f) return f;
  try {
    await createHighlight(f, await createSupabaseServerClient());
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23514") {
      return { error: "Could not add the highlight. Please check the fields and try again." };
    }
    throw err;
  }
  revalidate();
  return undefined;
}

export async function updateHighlightAction(
  id: string,
  _prev: HighlightActionState,
  formData: FormData,
): Promise<HighlightActionState> {
  await requireRole("editor");
  const f = readFields(formData);
  if ("error" in f) return f;
  try {
    await updateHighlight(id, f, await createSupabaseServerClient());
  } catch (err) {
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23514") {
      return { error: "Could not save the highlight. Please try again." };
    }
    throw err;
  }
  revalidate();
  return undefined;
}

export async function deleteHighlightAction(id: string): Promise<HighlightActionState> {
  await requireRole("editor");
  await deleteHighlight(id, await createSupabaseServerClient());
  revalidate();
  return undefined;
}
