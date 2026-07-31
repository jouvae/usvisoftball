"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { submitArticleForReview } from "@/lib/articles";

export type SubmitForReviewState = { error: string } | undefined;

// submitForReview — bound via `submitForReview.bind(null, id)` so the id is a
// server-closure reference, not a forgeable field (server-actions.md §Security).
// Independently authenticates + authorizes (requireRole), then runs the
// draft→in_review transition through the SESSION client so RLS re-verifies
// ownership and forbids any other target status. A foreign/non-draft id matches 0
// rows, so `.single()` throws PGRST116 — caught and returned as { error }, never an
// unhandled throw (slice-05 §2.2, MINOR-7). On success, revalidating the queue +
// this editor ships the fresh in_review status in the same response. NOT /news:
// submitting for review publishes nothing.
// Signature is just `(id)` — after `.bind(null, id)` React's `useActionState`
// calls it with (prevState, formData), which this action does not need, so they are
// simply not declared (a lower-arity function is assignable to the island's action
// prop type; extra runtime args are ignored). This keeps the action lint-clean.
export async function submitForReview(
  id: string,
): Promise<SubmitForReviewState> {
  await requireRole("contributor");

  const supabase = await createSupabaseServerClient();

  try {
    await submitArticleForReview(id, supabase);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "PGRST116") {
      return { error: "Could not submit this draft." };
    }
    throw err;
  }

  revalidatePath("/admin/queue");
  revalidatePath(`/admin/articles/${id}`);
  return undefined;
}
