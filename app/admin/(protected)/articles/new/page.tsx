import { ArticleDraftForm } from "@/components/client/article-draft-form";

// New-article route (slice-05 §3). Server Component that renders inside the
// layout's sole <main data-testid="admin-main"> — this page roots at a <section>,
// never a second <main>. Authorization is enforced INSIDE the createDraft Server
// Action (auth.md L1449-1469) + by RLS, not by this render; the render is a
// convenience surface reached from the role-gated dashboard nav.
export default function NewArticlePage() {
  return (
    <section data-testid="admin-new-article" className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold text-brand">
        New article
      </h1>
      <ArticleDraftForm className="max-w-2xl" />
    </section>
  );
}
