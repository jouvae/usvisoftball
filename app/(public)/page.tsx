import Link from "next/link";
import { listHighlightedArticles } from "@/lib/articles";
import { GetInvolvedSection } from "@/components/ui/get-involved";
import { HomeHero } from "@/components/ui/home-hero";
import { ArticleCard } from "@/components/ui/article-card";
import { HighlightsCarousel } from "@/components/client/highlights-carousel";

// The home page reads editor-curated highlights from the DB via supabase-js (NOT
// `fetch`), so force per-request rendering — the carousel must reflect the live set
// the moment an editor toggles a highlight (the setHighlight action revalidates "/").
export const dynamic = "force-dynamic";

// Server Component. Home layout (docs/features/softball/home-layout/design-guide.md), built
// in slices: hero → [stats, teams, event — later slices] → highlights (becomes the curated
// news grid in slice 3) → Get Involved. The board roster lives on /about.
export default async function Home() {
  const highlights = await listHighlightedArticles();

  return (
    <div className="flex flex-1 flex-col">
      <HomeHero />

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

      <GetInvolvedSection />
    </div>
  );
}
