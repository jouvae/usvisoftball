import Image from "next/image";
import Link from "next/link";
import type { ArticleListItem } from "@/lib/articles";
import { formatArticleDate } from "@/lib/format";

export type ArticleCardProps = {
  article: ArticleListItem;
  // Above-the-fold cards get `priority` (no lazy-load); below-fold cards do not.
  priority?: boolean;
  className?: string;
};

// One published article. Server Component — nothing here is interactive.
// The headline is an <h2> wrapping a <Link> to /news/[slug] (slice 03; the route
// now exists). The `article-card-headline` testid STAYS on the <h2> (its
// accessible name is still the title); a new `article-card-link` testid rides the
// <Link>. The category eyebrow is a navy-text-on-gold chip (8.13:1, the DESIGN.md
// inversion) — never gold text on white.
export function ArticleCard({
  article,
  priority = false,
  className = "",
}: ArticleCardProps) {
  const {
    slug,
    title,
    category,
    authorName,
    publishedAt,
    coverImageUrl,
    coverImageAlt,
  } = article;

  return (
    <li
      data-testid="article-card"
      data-slug={slug}
      className={`flex flex-col overflow-hidden rounded-lg border border-border bg-background ${className}`}
    >
      {/* `fill` requires the parent to be `position: relative` (image.md §fill). */}
      <div className="relative aspect-[16/9] bg-surface">
        {coverImageUrl ? (
          <Image
            data-testid="article-card-image"
            src={coverImageUrl}
            alt={coverImageAlt ?? ""}
            fill
            priority={priority}
            sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <span
          data-testid="article-card-category"
          className="inline-flex w-fit items-center rounded bg-accent px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-foreground"
        >
          {category}
        </span>

        <h2
          data-testid="article-card-headline"
          className="font-display text-xl font-bold leading-tight tracking-tight text-brand"
        >
          <Link
            data-testid="article-card-link"
            href={`/news/${slug}`}
            className="hover:text-brand-hover"
          >
            {title}
          </Link>
        </h2>

        <div className="mt-auto flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span data-testid="article-card-byline">By {authorName}</span>
          <span aria-hidden="true">·</span>
          <time
            data-testid="article-card-date"
            dateTime={publishedAt ?? undefined}
          >
            {publishedAt ? formatArticleDate(publishedAt) : ""}
          </time>
        </div>
      </div>
    </li>
  );
}
