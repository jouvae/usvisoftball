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

// One published article — image-cover layout (redesign): the cover photo fills the card
// under a dark gradient, with the category, meta, and headline laid over it. The whole
// card is one click target (the headline link's `absolute inset-0`). Missing cover → the
// dark base still reads. Testids are preserved so the e2e feed/detail specs keep passing.
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
      className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-slate-900 px-6 pt-52 pb-6 ${className}`}
    >
      {coverImageUrl ? (
        <Image
          data-testid="article-card-image"
          src={coverImageUrl}
          alt={coverImageAlt ?? ""}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="absolute inset-0 -z-10 object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : null}

      {/* Legibility gradient + hairline ring over the photo. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/5" />
      <div className="absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset ring-white/10" />

      <span
        data-testid="article-card-category"
        className="mb-3 inline-flex w-fit items-center rounded bg-accent px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-foreground"
      >
        {category}
      </span>

      <div className="flex flex-wrap items-center gap-x-2 text-sm text-white/80">
        <span data-testid="article-card-byline">By {authorName}</span>
        <span aria-hidden="true">·</span>
        <time data-testid="article-card-date" dateTime={publishedAt ?? undefined}>
          {publishedAt ? formatArticleDate(publishedAt) : ""}
        </time>
      </div>

      <h2
        data-testid="article-card-headline"
        className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-white"
      >
        <Link
          data-testid="article-card-link"
          href={`/articles/${slug}`}
          className="outline-focus focus:outline-2"
        >
          <span className="absolute inset-0" />
          {title}
        </Link>
      </h2>
    </li>
  );
}
