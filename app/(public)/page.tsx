import Link from "next/link";
import { listHighlightedArticles } from "@/lib/articles";
import { ArticleCard } from "@/components/ui/article-card";
import { HighlightsCarousel } from "@/components/client/highlights-carousel";

// The home page reads editor-curated highlights from the DB via supabase-js (NOT
// `fetch`), so force per-request rendering — the carousel must reflect the live set
// the moment an editor toggles a highlight (the setHighlight action revalidates "/").
export const dynamic = "force-dynamic";

// Server Component. Home = branded hero + editor-curated highlights carousel. The board
// roster now lives on /about (redesign IA); the home stays a lean landing.
export default async function Home() {
  const highlights = await listHighlightedArticles();

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — full-bleed brand-blue band; the frosty nav sits above it. */}
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-20 sm:py-28">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            U.S. Virgin Islands
          </p>
          <h1 className="max-w-3xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
            USVI Softball Federation
          </h1>
          <p className="max-w-2xl text-lg text-white/85">
            The official home of softball in the U.S. Virgin Islands. We govern,
            grow, and celebrate the game across St. Thomas, St. John, and St. Croix
            — from youth leagues to territory champions.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/articles"
              data-testid="hero-articles-cta"
              className="rounded-full bg-accent px-5 py-2.5 font-display font-semibold uppercase tracking-wide text-accent-foreground outline-focus hover:bg-accent-hover focus:outline-2"
            >
              Read the latest
            </Link>
            <Link
              href="/about"
              className="rounded-full border border-white/40 px-5 py-2.5 font-display font-semibold uppercase tracking-wide text-white outline-focus hover:bg-white/10 focus:outline-2"
            >
              About the Federation
            </Link>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
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
                // Whole cards per view (1 + peek on phones, 2 on tablets, 3 on desktop) —
                // the 1.5rem/3rem terms are the track's gap-6 between visible cards.
                className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
              />
            ))}
          </HighlightsCarousel>
        ) : (
          <p data-testid="highlights-empty" className="text-muted">
            No highlights featured yet — browse the latest stories.
          </p>
        )}
      </section>
    </div>
  );
}
