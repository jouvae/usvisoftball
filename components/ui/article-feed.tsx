import type { ArticleListItem } from "@/lib/articles";
import { ArticleCard } from "@/components/ui/article-card";

export type ArticleFeedProps = {
  articles: ArticleListItem[];
  className?: string;
};

// The feed list. Server Component. Rendered only when ≥1 published article exists
// (the page renders <EmptyState> otherwise). Mobile-first single column; multi
// column at md/lg (slice-02 §6). `role="list"` is explicit because some resets
// strip <ul> semantics.
export function ArticleFeed({ articles, className = "" }: ArticleFeedProps) {
  return (
    <ul
      role="list"
      data-testid="news-feed"
      className={`grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {articles.map((article, index) => (
        <ArticleCard
          key={article.id}
          article={article}
          priority={index === 0}
        />
      ))}
    </ul>
  );
}
