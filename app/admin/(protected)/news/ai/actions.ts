"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditorialRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createArticle, type AiProvenance } from "@/lib/articles";
import { generateDraft } from "@/lib/ai-draft";
import { sourceLabel } from "@/lib/ai-sources";
import { slugify } from "@/lib/format";
import { AI_DRAFT_ENABLED } from "@/lib/flags";

// The default category stamped on an accepted AI draft. Lifted from a hardcoded
// literal so the AI drafter's category has one named home (R5). The AI drafter has
// no category picker yet; every accepted draft lands under the Federation desk.
const DEFAULT_AI_CATEGORY = "Federation";

// The placeholder source allow-list lives in @/lib/ai-sources (a plain module) so both
// this "use server" file and the client island share ONE source of truth. Both Server
// Actions validate the submitted `source` against it via sourceLabel — untrusted FormData
// never reaches generateDraft unchecked (server-actions.md §Security).

export type GenerateAiDraftState =
  | {
      ok: true;
      source: string;
      sourceLabel: string;
      prompt: string;
      title: string;
      body: string;
      aiProvenance: AiProvenance;
    }
  | { ok: false; error: string }
  | undefined;

// generateAiDraft — review ONLY, NOTHING persisted (slice-09 §5.3). A Server Action is
// its own untrusted entry point (auth.md): it authorizes INSIDE (requireEditorialRole)
// rather than leaning on the layout/nav gate, and validates every FormData field.
export async function generateAiDraft(
  _prevState: GenerateAiDraftState,
  formData: FormData,
): Promise<GenerateAiDraftState> {
  // Feature-flag gate: a Server Action is its own POST endpoint, so it must reject
  // when the panel is disabled (prod) — not lean on the hidden route/nav. Returns the
  // action's normal error shape rather than throwing.
  if (!AI_DRAFT_ENABLED) {
    return { ok: false, error: "The AI draft panel is not available." };
  }

  await requireEditorialRole();

  const source = String(formData.get("source") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  const label = sourceLabel(source);
  if (!label) {
    return { ok: false, error: "Select an owned or licensed source." };
  }
  if (!prompt) {
    return { ok: false, error: "Enter a prompt for the draft." };
  }

  // Pure, in-process, no persistence (§3). The human-readable LABEL is the provenance
  // `source` — it is what the review area AND the draft editor's provenance block display
  // (both re-derive from ai_provenance.source), and what the e2e asserts against.
  const draft = generateDraft({ source: label, prompt });
  return {
    ok: true,
    source, // the raw allow-list VALUE — re-submitted as a hidden field on Accept
    sourceLabel: label,
    prompt,
    title: draft.title,
    body: draft.body,
    aiProvenance: draft.aiProvenance,
  };
}

export type AcceptAiDraftState = { error: string } | undefined;

// acceptAiDraft — persists via the SESSION/RLS client, then redirects (slice-09 §5.4).
// The reviewed title/body are shown to the human but NOT trusted from the client: this
// action re-reads only source+prompt (hidden fields) and RE-DERIVES the draft
// server-side, so the persisted content is server-derived, not client-forgeable
// (server-actions.md §Security).
export async function acceptAiDraft(
  _prevState: AcceptAiDraftState,
  formData: FormData,
): Promise<AcceptAiDraftState> {
  // Feature-flag gate (see generateAiDraft) — reject a POST while the panel is off so
  // an accepted draft can never be persisted when the feature is disabled in prod.
  if (!AI_DRAFT_ENABLED) {
    return { error: "The AI draft panel is not available." };
  }

  const { user, profile } = await requireEditorialRole();

  const source = String(formData.get("source") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();

  const label = sourceLabel(source);
  if (!label || !prompt) {
    return { error: "Could not save this draft. Please try again." };
  }

  // Re-derive server-side with the resolved LABEL (matching generateAiDraft) — because
  // generateDraft is deterministic this reproduces exactly what the human reviewed, and
  // guarantees the persisted content is server-derived, not client-forgeable (§5.4).
  const draft = generateDraft({ source: label, prompt });
  const slug = slugify(draft.title);
  if (!slug) {
    return { error: "Could not save this draft. Please try again." };
  }

  // author_name is NOT NULL (0001): derive the byline from the profile name, falling back
  // to the account email (same chain as slice-05 createDraft).
  // Never fall back to user.email — author_name is a PUBLIC byline (red-team PII).
  // Unreachable today (provisioning always sets profile.name); keep the fallback non-PII.
  const authorName = profile.name ?? user.id;

  const supabase = await createSupabaseServerClient();

  let createdId: string;
  try {
    // Through the SESSION client so RLS articles_ai_draft_insert enforces as the caller —
    // never the admin client on the assertion path. status='draft' + source='ai' + a real
    // provenance OBJECT (never JSON null) is exactly the one shape that policy admits.
    const created = await createArticle(
      {
        title: draft.title,
        slug,
        body: draft.body,
        excerpt: null,
        coverImageUrl: null,
        coverImageAlt: null,
        authorName,
        authorId: user.id,
        category: DEFAULT_AI_CATEGORY,
        status: "draft",
        source: "ai",
        aiProvenance: draft.aiProvenance,
      },
      supabase,
    );
    createdId = created.id;
  } catch {
    // A duplicate slug (23505) or an RLS denial surfaces as a form error rather than an
    // unhandled throw (slug-collision debt — slice-05 §8).
    return { error: "Could not save this draft. Please try again." };
  }

  // The queue must reflect the new draft — revalidate BEFORE the redirect. NOT /news: a
  // draft publishes nothing (§5.4 step 6).
  revalidatePath("/admin/queue");

  // Outside any try/catch — redirect throws NEXT_REDIRECT (303 ⇒ the browser GETs the
  // draft editor, where draft-source shows `ai` and draft-provenance shows source+model).
  redirect(`/admin/articles/${createdId}`);
}
