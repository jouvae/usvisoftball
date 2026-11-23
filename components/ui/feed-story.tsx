import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import { ATLANTIC_TZ, formatShortDate, type Locale } from "@/lib/schedule-view";
import type { FeedStory, StoryScore } from "@/lib/feed-view";

// Feature softball/home-feed — the home feed's story pieces (overview §3). Isomorphic: the
// server renders the first page and the client list renders later pages with the same markup.
// Dates are absolute and pinned to USVI time, so server and client always print the same text.

function storyHref(locale: Locale, slug: string): string {
  return localizePath(locale, `/articles/${slug}`);
}

function storyDate(iso: string | null, locale: Locale): string {
  return iso ? formatShortDate(iso, ATLANTIC_TZ, locale) : "";
}

// A recap's score line (H9): away then home, the winner in bold, the state as a word (never
// colour alone). Pregame games have no score to show, so only live/final render.
export function StoryScoreBar({ score, locale }: { score: StoryScore; locale: Locale }) {
  if (score.state === "pregame") return null;
  const t = getDictionary(locale).schedule;
  const awayWon = score.state === "final" && score.awayRuns > score.homeRuns;
  const homeWon = score.state === "final" && score.homeRuns > score.awayRuns;
  return (
    <p
      data-testid="story-score"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-sm tracking-wide text-navy"
    >
      <span
        className={
          score.state === "live"
            ? "rounded-sm bg-red-600 px-1.5 font-semibold uppercase text-white"
            : "rounded-sm bg-navy px-1.5 font-semibold uppercase text-navy-foreground"
        }
      >
        {score.state === "live" ? t.stateLive : t.stateFinal}
      </span>
      <span className={awayWon ? "font-bold" : "font-medium"}>
        {score.away} {score.awayRuns}
      </span>
      <span className={homeWon ? "font-bold" : "font-medium"}>
        {score.home} {score.homeRuns}
      </span>
    </p>
  );
}

// What sits above a headline: the score line for a linked recap, else the story's category.
function StoryKicker({ story, locale }: { story: FeedStory; locale: Locale }) {
  if (story.score && story.score.state !== "pregame") {
    return <StoryScoreBar score={story.score} locale={locale} />;
  }
  return (
    <p data-testid="story-category" className="font-display text-sm font-semibold tracking-wide text-navy/80">
      {story.category}
    </p>
  );
}

// One feed row: text left, a 4:3 thumbnail right. The headline link covers the row.
export function FeedStoryRow({ story, locale }: { story: FeedStory; locale: Locale }) {
  return (
    <li
      data-testid="feed-story"
      data-slug={story.slug}
      className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-5 sm:gap-6 sm:py-6"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <StoryKicker story={story} locale={locale} />
        <h3 className="font-display text-lg font-semibold leading-snug text-navy sm:text-[1.375rem]">
          <Link
            href={storyHref(locale, story.slug)}
            data-testid="feed-story-link"
            className="outline-focus group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4 focus:outline-2 focus:outline-offset-4"
          >
            <span aria-hidden="true" className="absolute inset-0" />
            {story.title}
          </Link>
        </h3>
        {story.excerpt ? (
          <p className="hidden max-w-[68ch] text-muted sm:line-clamp-2">{story.excerpt}</p>
        ) : null}
        <time dateTime={story.publishedAt ?? undefined} className="text-sm text-muted">
          {storyDate(story.publishedAt, locale)}
        </time>
      </div>
      {story.coverImageUrl ? (
        <div className="relative aspect-[4/3] w-24 self-start overflow-hidden rounded-lg bg-surface sm:w-44">
          <Image
            src={story.coverImageUrl}
            alt={story.coverImageAlt ?? ""}
            fill
            sizes="(min-width: 640px) 176px, 96px"
            className="object-cover"
          />
        </div>
      ) : null}
    </li>
  );
}

// The lead story (H4): the one loud story on the page — big photo, big headline, the dek.
export function LeadStory({ story, locale }: { story: FeedStory; locale: Locale }) {
  const t = getDictionary(locale).home;
  return (
    <article data-testid="home-lead" data-slug={story.slug} className="group relative flex flex-col gap-4">
      {story.coverImageUrl ? (
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface">
          <Image
            src={story.coverImageUrl}
            alt={story.coverImageAlt ?? ""}
            fill
            priority
            sizes="(min-width: 1152px) 792px, (min-width: 1024px) 66vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        <StoryKicker story={story} locale={locale} />
        <h2 className="font-display text-[clamp(2rem,4.2vw,3.25rem)] font-bold leading-[1.04] tracking-tight text-navy">
          <Link
            href={storyHref(locale, story.slug)}
            data-testid="home-lead-link"
            className="outline-focus group-hover:underline group-hover:decoration-[3px] group-hover:underline-offset-[6px] focus:outline-2 focus:outline-offset-4"
          >
            <span aria-hidden="true" className="absolute inset-0" />
            {story.title}
          </Link>
        </h2>
        {story.excerpt ? (
          <p className="max-w-[68ch] text-lg leading-relaxed text-foreground/80">{story.excerpt}</p>
        ) : null}
        <p className="flex flex-wrap gap-x-4 text-sm text-muted">
          <span>{t.byline.replace("{name}", story.authorName)}</span>
          <time dateTime={story.publishedAt ?? undefined}>{storyDate(story.publishedAt, locale)}</time>
        </p>
      </div>
    </article>
  );
}
