import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/articles";
import { requireRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ArticleStatusBadge } from "@/components/ui/article-status-badge";
import { PublishArticleForm } from "@/components/client/publish-article-form";
import { UnpublishArticleForm } from "@/components/client/unpublish-article-form";
import { publishArticle, unpublishArticle } from "./actions";

// The DB row is mutable and read via the cookie session client, so force
// per-request rendering — the status badge must reflect the live row after a publish
// revalidation, and the editor SELECT-any RLS check is evaluated at request time.
export const dynamic = "force-dynamic";

// The editor review desk (slice-06 §4.3). A DEDICATED editor route (not the shared
// contributor `[id]` editor) so it can `requireRole('editor')` at the top — a
// contributor hitting it is redirected to /admin — and own its own testids without
// colliding with the draft editor's. `params` is async (Next 16). The row is read
// through the SESSION client; articles_editor_read_all makes ANY row visible to an
// editor (a missing id 404s). Read-only metadata + the PublishArticleForm island;
// once published, a live link to the public article page.
export default async function ReviewPage({
  params,
}: PageProps<"/admin/review/[id]">) {
  await requireRole("editor"); // page-level editor gate (redirects a non-editor)
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const article = await getArticleById(id, supabase);
  if (!article) notFound();

  return (
    <section data-testid="review-view" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ArticleStatusBadge
            status={article.status}
            testId="review-status-badge"
          />
          <span data-testid="review-source" className="text-sm text-muted">
            Source: {article.source}
          </span>
        </div>
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
      </dl>

      {/*
        Status-branched controls (slice-08 §4). Exactly ONE control set renders per
        status, so no two submit islands / error slots collide on the DOM:
          in_review   → PublishArticleForm (editable body + `publish-article`)
          published   → read-only body + review-live-link + UnpublishArticleForm
          unpublished → PublishArticleForm as Re-publish (editable body +
                        `republish-article`, reusing the publishArticle action)
      */}
      {article.status === "in_review" ? (
        <PublishArticleForm
          action={publishArticle.bind(null, id)}
          defaultBody={article.body}
        />
      ) : null}

      {article.status === "published" ? (
        <>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Body</span>
            <p className="whitespace-pre-wrap text-muted">{article.body}</p>
          </div>
          <Link
            data-testid="review-live-link"
            href={`/news/${article.slug}`}
            className="w-fit font-medium text-brand underline outline-focus hover:text-brand-hover focus:outline-2"
          >
            View the live article
          </Link>
          <UnpublishArticleForm action={unpublishArticle.bind(null, id)} />
        </>
      ) : null}

      {article.status === "unpublished" ? (
        <PublishArticleForm
          action={publishArticle.bind(null, id)}
          defaultBody={article.body}
          submitLabel="Re-publish"
          submitTestId="republish-article"
        />
      ) : null}
    </section>
  );
}
