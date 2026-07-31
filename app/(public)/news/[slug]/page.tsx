import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/lib/articles";
import { formatArticleDate } from "@/lib/format";
import { ArticleHero } from "@/components/ui/article-hero";
import { ArticleBody } from "@/components/ui/article-body";
import { ArticleGallery } from "@/components/ui/article-gallery";

// The article is DB-backed, mutable data read via supabase-js (NOT `fetch`, so
// Next's fetch cache does not track it). Force per-request rendering so the page
// reflects live DB state — and so the draft 404 is evaluated at request time
// (caching-without-cache-components.md §dynamic; slice-03 §3.1).
export const dynamic = "force-dynamic";

// Both generateMetadata and the page read the same slug; cache() dedupes the read
// to a single DB round-trip per request (slice-03 §3.6).
const getArticle = cache(getPublishedArticleBySlug);

export async function generateMetadata({
  params,
}: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  // A non-published slug returns null through the RLS-enforced read, so a draft's
  // title can NEVER leak via <title> (slice-03 §3.6, §8).
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  };
}

// Server Component. Awaits the DB read at the TOP with no Suspense above it, then
// calls notFound() BEFORE returning any JSX — so the shell has not begun streaming
// and Next emits a real HTTP 404 for a hidden slug (slice-03 §3.1, §8-#2). Roots
// at <article>, NOT <main>: the layout owns the sole <main> landmark (slice-01 §2).
export default async function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-4">
        <span
          data-testid="article-category"
          className="inline-flex w-fit items-center rounded bg-accent px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-foreground"
        >
          {article.category}
        </span>

        <h1
          data-testid="article-headline"
          className="font-display text-4xl font-bold leading-tight tracking-tight text-brand"
        >
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span data-testid="article-byline">By {article.authorName}</span>
          {article.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time
                data-testid="article-date"
                dateTime={article.publishedAt}
              >
                {formatArticleDate(article.publishedAt)}
              </time>
            </>
          ) : null}
        </div>
      </header>

      <ArticleHero
        coverImageUrl={article.coverImageUrl}
        coverImageAlt={article.coverImageAlt}
        className="rounded-lg"
      />

      <ArticleBody body={article.body} />

      <ArticleGallery images={article.gallery} />
    </article>
  );
}
