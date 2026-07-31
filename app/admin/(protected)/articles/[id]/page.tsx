import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ArticleStatusBadge } from "@/components/ui/article-status-badge";
import { SubmitForReviewButton } from "@/components/client/submit-for-review-button";
import { submitForReview } from "./actions";

// The DB row is mutable and read via the cookie session client (not `fetch`), so
// force per-request rendering — the status badge must reflect the live row after a
// submit revalidation, and the own-read RLS check is evaluated at request time.
export const dynamic = "force-dynamic";

// The draft editor (slice-05 §3). `params` is async (Next 16). The row is read
// through the SESSION client so the contributor own-read RLS policy applies — a row
// the caller does not own (or a missing id) returns null and 404s. The
// submit-for-review action is bound with the id server-side, so the client island
// never carries a forgeable id (server-actions.md §Security).
export default async function DraftEditorPage({
  params,
}: PageProps<"/admin/articles/[id]">) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const article = await getArticleById(id, supabase);
  if (!article) notFound();

  return (
    <section data-testid="draft-editor" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ArticleStatusBadge
            status={article.status}
            testId="draft-status-badge"
          />
          <span
            data-testid="draft-source"
            className="text-sm text-muted"
          >
            Source: {article.source}
          </span>
        </div>
        {/* AI provenance (slice-09 §5.6) — rendered only for an AI row (source=ai);
            a human draft (aiProvenance == null) renders nothing extra. */}
        {article.aiProvenance != null ? (
          <div data-testid="draft-provenance" className="text-sm text-muted">
            AI provenance — source: {article.aiProvenance.source} · model:{" "}
            {article.aiProvenance.model}
          </div>
        ) : null}
        <h1 className="font-display text-3xl font-semibold text-brand">
          {article.title}
        </h1>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">Category</dt>
          <dd className="text-muted">{article.category}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">Hero image</dt>
          <dd className="text-muted">{article.coverImageUrl}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">Body</dt>
          {/* Plain React-escaped text — dangerouslySetInnerHTML stays banned on
              DB-sourced content (slice-05 §3). */}
          <dd className="whitespace-pre-wrap text-muted">{article.body}</dd>
        </div>
      </dl>

      {article.status === "draft" ? (
        <SubmitForReviewButton action={submitForReview.bind(null, id)} />
      ) : null}
    </section>
  );
}
