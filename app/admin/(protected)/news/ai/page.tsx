import { notFound } from "next/navigation";
import { AiDraftPanel } from "@/components/client/ai-draft-panel";
import { AI_DRAFT_ENABLED } from "@/lib/flags";

// The AI draft panel route (slice-09 §5.1). Server Component that renders inside the
// layout's sole <main> — this page roots at a <section>, never a second <main>. No data
// read: the panel starts idle. Authorization is enforced INSIDE the generateAiDraft /
// acceptAiDraft Server Actions (auth.md) + by RLS, not by this render; the render is a
// convenience surface reached from the role-gated dashboard nav.
//
// Feature-flag gate: when NEXT_PUBLIC_AI_DRAFT_ENABLED is not "true" (prod default),
// the route is invisible — notFound() renders the standard 404 rather than the panel.
export default function AiDraftPage() {
  if (!AI_DRAFT_ENABLED) {
    notFound();
  }

  return (
    <section data-testid="ai-draft-panel" className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold text-brand">
        AI draft
      </h1>
      <p className="text-muted">
        Generate a draft from an owned or licensed source for editorial review. AI
        drafts are never auto-published — an editor must review and publish them
        through the normal workflow.
      </p>
      <AiDraftPanel />
    </section>
  );
}
