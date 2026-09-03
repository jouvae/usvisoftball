import Link from "next/link";
import { listHighlightedArticles } from "@/lib/articles";
import { listCurrentBoard } from "@/lib/board";
import { ArticleCard } from "@/components/ui/article-card";
import { HighlightsCarousel } from "@/components/client/highlights-carousel";
import { BoardGrid } from "@/components/client/board-grid";

// The home page reads editor-curated highlights from the DB via supabase-js (NOT
// `fetch`), so force per-request rendering — the carousel must reflect the live set
// the moment an editor toggles a highlight (the setHighlight action revalidates "/").
export const dynamic = "force-dynamic";

// Server Component. Roots at <section>s inside the layout's sole <main> (slice-01 §2).
// Hero (short federation intro) + an editor-curated highlights carousel with a
// "view all articles" link. The carousel is omitted entirely when nothing is
// highlighted; the "view all" link always shows so the home always routes to /articles.
export default async function Home() {
  const highlights = await listHighlightedArticles();
  const board = await listCurrentBoard();

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-16 sm:py-20">
        <h1 className="font-display text-5xl font-bold uppercase tracking-tight text-brand sm:text-6xl">
          USVI Softball Federation
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          The official home of softball in the U.S. Virgin Islands. We govern,
          grow, and celebrate the game across St. Thomas, St. John, and St. Croix
          — from youth leagues to territory champions.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
            {highlights.length > 0 ? "Highlights" : "Latest news"}
          </h2>
          <Link
            data-testid="highlights-view-all"
            href="/articles"
            className="w-fit font-display font-semibold text-brand underline outline-focus hover:text-brand-hover focus:outline-2"
          >
            View all articles
          </Link>
        </div>

        {highlights.length > 0 ? (
          <HighlightsCarousel>
            {highlights.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                priority={index === 0}
                className="w-[85vw] shrink-0 snap-start sm:w-80"
              />
            ))}
          </HighlightsCarousel>
        ) : (
          <p data-testid="highlights-empty" className="text-muted">
            No highlights featured yet — browse the latest stories.
          </p>
        )}
      </section>

      {board && board.members.length > 0 ? (
        <section
          data-testid="home-board"
          className="border-t border-border bg-surface"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
                Our Board
              </h2>
              <Link
                href="/about"
                data-testid="home-board-about-link"
                className="w-fit font-display font-semibold text-brand underline outline-focus hover:text-brand-hover focus:outline-2"
              >
                About the Federation
              </Link>
            </div>
            <BoardGrid members={board.members} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
