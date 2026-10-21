import { listHomeNews } from "@/lib/articles";
import { listPublishedStats } from "@/lib/stats";
import { ArticleCard } from "@/components/ui/article-card";
import { GetInvolvedSection } from "@/components/ui/get-involved";
import { HomeHero } from "@/components/ui/home-hero";
import { SectionHeader } from "@/components/ui/section-header";
import { StatsStrip } from "@/components/ui/stats-strip";

// The home page reads the curated news grid and the published stats from the DB via
// supabase-js (NOT `fetch`), so force per-request rendering — both must reflect an editor's
// change immediately (the highlight and stat actions revalidate "/").
export const dynamic = "force-dynamic";

// Server Component. Home layout (docs/features/softball/home-layout/design-guide.md), built
// in slices: hero → stats → [teams, event — slice 5] → Latest News → Get Involved. The
// board roster lives on /about. Every section's data loads in one Promise.all (no waterfall).
export default async function Home() {
  const [news, stats] = await Promise.all([listHomeNews(3), listPublishedStats(3)]);

  return (
    <div className="flex flex-1 flex-col">
      <HomeHero />

      {stats.length > 0 ? <StatsStrip stats={stats} /> : null}

      {/* Latest News — editor highlights first, filled with the newest articles (§2.5). */}
      <section
        data-testid="home-news"
        aria-labelledby="home-news-heading"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20"
      >
        <SectionHeader
          id="home-news-heading"
          title="Latest News"
          action={{ href: "/articles", label: "All news", testId: "home-news-link" }}
        />

        {news.length > 0 ? (
          <ul
            data-testid="home-news-grid"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"
          >
            {news.map((article, i) => (
              <ArticleCard
                key={article.id}
                article={article}
                highlight={article.isHighlight}
                headingLevel="h3"
                // Three-up on sm (2 columns): the third card spans both so none is orphaned.
                className={i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}
              />
            ))}
          </ul>
        ) : (
          <p data-testid="home-news-empty" className="text-muted">
            No news yet — check back soon.
          </p>
        )}
      </section>

      <GetInvolvedSection />
    </div>
  );
}
