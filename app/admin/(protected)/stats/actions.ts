"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createStat,
  updateStat,
  deleteStat,
  isStatIcon,
  STAT_LIMITS,
  StatSourceUrlError,
  type StatInput,
} from "@/lib/stats";

// Feature softball/home-layout — Slice 4 home stats admin CRUD. Each action re-runs
// requireRole('editor') and writes via the editor SESSION client — the 0023 RLS is the real
// boundary, no admin/service fallback. The id is bound server-side. Every write revalidates
// "/" so the home strip reflects the change on the next request.

export type StatActionState = { error: string } | undefined;

function pgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

function readStatFields(formData: FormData): { error: string } | StatInput {
  const label = String(formData.get("label") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim();
  const asOf = String(formData.get("asOf") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim() || null;
  const sortRaw = String(formData.get("sortOrder") ?? "").trim();
  const sortOrder = sortRaw === "" ? 0 : Number(sortRaw);
  const isPublished = formData.get("isPublished") === "1";

  if (!label) return { error: "Label is required." };
  if (label.length > STAT_LIMITS.label) {
    return { error: `Label must be ${STAT_LIMITS.label} characters or fewer.` };
  }
  if (!value) return { error: "Value is required." };
  if (value.length > STAT_LIMITS.value) {
    return {
      error: `Value must be ${STAT_LIMITS.value} characters or fewer — put the explanation in Detail.`,
    };
  }
  if (detail.length > STAT_LIMITS.detail) {
    return { error: `Detail must be ${STAT_LIMITS.detail} characters or fewer.` };
  }
  if (!isStatIcon(icon)) return { error: "Choose an icon." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) {
    return { error: "“As of” date is required — when was this figure true?" };
  }
  if (!Number.isInteger(sortOrder)) return { error: "Sort order must be a whole number." };

  return { label, value, detail, icon, asOf, sourceUrl, sortOrder, isPublished };
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/admin/stats");
}

export async function createStatAction(
  _prevState: StatActionState,
  formData: FormData,
): Promise<StatActionState> {
  await requireRole("editor");
  const f = readStatFields(formData);
  if ("error" in f) return f;
  try {
    await createStat(f, await createSupabaseServerClient());
  } catch (err) {
    if (err instanceof StatSourceUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23514") {
      return { error: "Could not add the stat. Please check the fields and try again." };
    }
    throw err;
  }
  revalidate();
  return undefined;
}

export async function updateStatAction(
  id: string,
  _prevState: StatActionState,
  formData: FormData,
): Promise<StatActionState> {
  await requireRole("editor");
  const f = readStatFields(formData);
  if ("error" in f) return f;
  try {
    await updateStat(id, f, await createSupabaseServerClient());
  } catch (err) {
    if (err instanceof StatSourceUrlError) return { error: err.message };
    if (pgErrorCode(err) === "PGRST116" || pgErrorCode(err) === "23514") {
      return { error: "Could not save the stat. Please try again." };
    }
    throw err;
  }
  revalidate();
  return undefined;
}

export async function deleteStatAction(id: string): Promise<StatActionState> {
  await requireRole("editor");
  await deleteStat(id, await createSupabaseServerClient());
  revalidate();
  return undefined;
}
