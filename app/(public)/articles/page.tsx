import { listPublishedArticles } from "@/lib/articles";
import { ArticlesBrowser } from "@/components/client/articles-browser";
import { EmptyState } from "@/components/ui/empty-state";

// The feed is DB-backed, mutable data read via supabase-js (NOT `fetch`, so Next's
// fetch cache does not track it). With `cacheComponents` off and no request-time
// API, Next may prerender a frozen feed at build (caching-without-cache-components.md
// §dynamic). Force per-request rendering so the feed is always live — and so the
// tester deterministically sees seeded rows right after seeding.
export const dynamic = "force-dynamic";

// Server Component: awaits the DB read (06-fetching-data.md §"With an ORM or
// database" — credentials/query stay server-side). Roots at <section>, NOT <main>:
// the layout owns the sole <main> landmark (slice-01 §2).
export default async function ArticlesPage() {
  const articles = await listPublishedArticles();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12">
      {articles.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
            Articles
          </h1>
          <ArticlesBrowser articles={articles} />
        </>
      )}
    </section>
  );
}
