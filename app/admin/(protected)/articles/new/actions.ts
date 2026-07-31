"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createArticle } from "@/lib/articles";
import { slugify } from "@/lib/format";

export type CreateDraftState = { error: string } | undefined;

// createDraft — the new-article Server Action (slice-05 §2.2). A Server Action is
// an independently-reachable POST endpoint (server-actions.md §Security; auth.md
// L1446-1449), so it AUTHENTICATES + AUTHORIZES itself: requireRole('contributor')
// runs requireUser() (redirects an anon request) then confirms contributor
// membership through the RLS session client — it does NOT lean on the (protected)
// layout guard. FormData is untrusted (server-actions.md §Security) so every field
// is validated. The insert runs through the SESSION client, so RLS enforces as the
// contributor (author_id = self, status=draft, source=human — published is
// unreachable by construction).
export async function createDraft(
  _prevState: CreateDraftState,
  formData: FormData,
): Promise<CreateDraftState> {
  const { user, profile } = await requireRole("contributor");

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim();
  const coverImageAlt = String(formData.get("coverImageAlt") ?? "").trim();

  if (!title || !body || !category || !coverImageUrl || !coverImageAlt) {
    return {
      error:
        "Title, body, category, hero image, and hero alt text are all required.",
    };
  }

  // The hero must be a LOCAL path (e.g. `/seed/foo.png`). An unconfigured remote host
  // would make `next/image` throw at render time (a 500 on the article page), so reject
  // a non-local URL here as a form error rather than letting it reach the DB (R4).
  if (!coverImageUrl.startsWith("/")) {
    return {
      error: "The hero image must be a local path starting with “/”.",
    };
  }

  const slug = slugify(title);
  if (!slug) {
    return { error: "Enter a title with at least one letter or number." };
  }

  // author_name is NOT NULL (0001): derive the byline from the seeded profile name,
  // falling back to the account email (slice-05 §2.2 step 3, MAJOR-1).
  // Never fall back to user.email — author_name is a PUBLIC byline (red-team PII).
  // Unreachable today (provisioning always sets profile.name); keep the fallback non-PII.
  const authorName = profile.name ?? user.id;

  const supabase = await createSupabaseServerClient();

  let createdId: string;
  try {
    const created = await createArticle(
      {
        title,
        slug,
        body,
        excerpt: null,
        coverImageUrl,
        coverImageAlt,
        authorName,
        authorId: user.id,
        category,
        status: "draft",
        source: "human",
      },
      supabase,
    );
    createdId = created.id;
  } catch {
    // A duplicate slug (23505) or an RLS denial surfaces as a form error rather
    // than an unhandled throw (slug-collision debt — slice-05 §8).
    return { error: "Could not save this draft. Please try again." };
  }

  // The queue must reflect the new draft — revalidate BEFORE the redirect
  // (server-actions.md §single-response). NOT /news: a draft publishes nothing.
  revalidatePath("/admin/queue");

  // Outside any try/catch — redirect throws NEXT_REDIRECT (303 from an action ⇒
  // the browser GETs the editor).
  redirect(`/admin/articles/${createdId}`);
}
