import Link from "next/link";
import { listQueueArticles, listEditorialQueue } from "@/lib/articles";
import { requireUser } from "@/lib/auth";
import { readOwnProfile } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ArticleStatusBadge } from "@/components/ui/article-status-badge";

// The DB rows are mutable and read via the cookie session client, so force
// per-request rendering — a freshly submitted draft must appear after its
// revalidation, and the RLS filters are evaluated at request time.
export const dynamic = "force-dynamic";

// The role-aware editorial queue (slice-05 §3, slice-06 §4.2, slice-08 §5). An
// EDITOR sees ALL in_review + published + unpublished rows (articles_editor_read_all)
// and links each to the review desk (/admin/review/[id]); a CONTRIBUTOR sees their
// OWN draft + in_review rows (contributor own-read) and links each to their own editor
// (/admin/articles/[id]). One route, one set of `queue-*` testids. Renders inside the
// layout's sole <main>.
export default async function QueuePage() {
  const user = await requireUser();
  const profile = await readOwnProfile(user.id);
  const isEditor = (profile?.roles ?? []).includes("editor");
  const supabase = await createSupabaseServerClient();
  const articles = isEditor
    ? await listEditorialQueue(supabase)
    : await listQueueArticles(supabase);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Editorial queue
      </h1>

      {articles.length === 0 ? (
        <p data-testid="queue-empty" className="text-muted">
          No drafts yet. Create one from the dashboard.
        </p>
      ) : (
        <ul
          data-testid="queue-list"
          className="flex flex-col divide-y divide-border rounded-lg border border-border"
        >
          {articles.map((article) => (
            <li
              key={article.id}
              data-testid="queue-item"
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <Link
                data-testid="queue-item-title"
                href={
                  isEditor
                    ? `/admin/review/${article.id}`
                    : `/admin/articles/${article.id}`
                }
                className="font-display text-lg font-semibold text-brand hover:text-brand-hover"
              >
                {article.title}
              </Link>
              <ArticleStatusBadge
                status={article.status}
                testId="queue-item-status"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
