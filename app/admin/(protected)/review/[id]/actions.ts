"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  publishArticle as publishArticleRow,
  unpublishArticle as unpublishArticleRow,
} from "@/lib/articles";

export type PublishArticleState = { error: string } | undefined;
export type UnpublishArticleState = { error: string } | undefined;

// publishArticle — bound via `publishArticle.bind(null, id)` so the id is a
// server-closure reference, not a forgeable field (server-actions.md §Security). A
// Server Action is an independently-reachable POST endpoint, so it re-verifies the
// session + editor role itself (requireRole), never leaning on the (protected)
// layout guard — RLS `articles_editor_update` is the real boundary. The untrusted
// body is validated (empty → { error }); the publish runs through the SESSION client
// so RLS enforces as the editor. A non-editor-visible or missing id matches 0 rows,
// so `.single()` throws PGRST116 — caught and returned as { error }. On success,
// revalidate every affected LITERAL path BEFORE returning (no redirect — stay on the
// review desk; the fresh Published status + live link ship in the same roundtrip).
export async function publishArticle(
  id: string,
  _prevState: PublishArticleState,
  formData: FormData,
): Promise<PublishArticleState> {
  await requireRole("editor");

  const body = (formData.get("body") ?? "").toString();
  if (body.trim().length === 0) {
    return { error: "The article body cannot be empty." };
  }

  const supabase = await createSupabaseServerClient();

  let published;
  try {
    published = await publishArticleRow(id, { body }, supabase);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "PGRST116") {
      return { error: "Could not publish this article." };
    }
    throw err;
  }

  revalidatePath("/articles");
  revalidatePath(`/articles/${published.slug}`);
  revalidatePath("/admin/queue");
  revalidatePath(`/admin/review/${id}`);
  return undefined;
}

// unpublishArticle — bound via `unpublishArticle.bind(null, id)` so the id is a
// server-closure reference, not a forgeable field (server-actions.md §Security). A
// Server Action is an independently-reachable POST endpoint, so it re-verifies the
// session + editor role itself (requireRole), never leaning on the (protected)
// layout guard — RLS `articles_editor_update` is the real boundary. Unpublish reads
// NO untrusted body (a pure status transition), so there is nothing to validate; the
// _prevState/formData shape is kept only to satisfy useActionState's signature. The
// unpublish runs through the SESSION client so RLS enforces as the editor. A
// non-editor-visible or missing id matches 0 rows, so `.single()` throws PGRST116 —
// caught and returned as { error }. On success, revalidate every affected LITERAL
// path BEFORE returning (no redirect — stay on the review desk; the fresh Unpublished
// status + Re-publish control ship in the same roundtrip). Takes only the bound id:
// useActionState calls it with (prevState) which unpublish reads nothing from, so the
// param is omitted (a 0-arg action is assignable to the hook's action type).
export async function unpublishArticle(
  id: string,
): Promise<UnpublishArticleState> {
  await requireRole("editor");

  const supabase = await createSupabaseServerClient();

  let unpublished;
  try {
    unpublished = await unpublishArticleRow(id, supabase);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "PGRST116") {
      return { error: "Could not unpublish this article." };
    }
    throw err;
  }

  revalidatePath("/articles"); // feed loses the card
  revalidatePath(`/articles/${unpublished.slug}`); // public article page now 404s for anon
  revalidatePath("/admin/queue"); // queue row's badge flips to Unpublished
  revalidatePath(`/admin/review/${id}`); // review view flips to Unpublished + Re-publish
  return undefined; // no redirect — stay on the review desk
}
