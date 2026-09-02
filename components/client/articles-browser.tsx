"use client";

import { useMemo, useState } from "react";
import type { ArticleListItem } from "@/lib/articles";
import { ArticleFeed } from "@/components/ui/article-feed";

// Client-side search + category filter over the published-article list (MVP decision:
// client-side is fine at launch scale). The server passes the full published list; this
// island holds the query + category state and renders the filtered ArticleFeed. Text search
// matches title / excerpt / author (case-insensitive); the category select is derived from
// the articles themselves so it never drifts from the data.
export function ArticlesBrowser({ articles }: { articles: ArticleListItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [articles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      const haystack = [a.title, a.excerpt ?? "", a.authorName, a.category]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [articles, query, category]);

  const field =
    "rounded-md border border-border bg-background px-3 py-2 text-foreground outline-focus focus:outline-2";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-foreground">
          <span className="sr-only">Search articles</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            data-testid="articles-search"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground sm:w-56">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="articles-category"
            className={field}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p data-testid="articles-count" className="text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "article" : "articles"}
      </p>

      {filtered.length > 0 ? (
        <ArticleFeed articles={filtered} />
      ) : (
        <p data-testid="articles-no-results" className="text-muted">
          No articles match your search.
        </p>
      )}
    </div>
  );
}
