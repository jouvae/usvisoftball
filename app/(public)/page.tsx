import type { Metadata } from "next";
import { getHomeFeed, listHighlights } from "@/lib/feed";
import { listPublishedStats } from "@/lib/stats";
import { listTeams } from "@/lib/teams";
import { countryName, formatTournamentWindow, getNextTournament } from "@/lib/schedule";
import { alternatesFor, getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import { EVENTS_ENABLED, TEAMS_ENABLED } from "@/lib/flags";
import { HomeFeedList, type FeedInterstitial } from "@/components/client/home-feed-list";
import { LeadStory } from "@/components/ui/feed-story";
import { GetInvolvedSection } from "@/components/ui/get-involved";
import { HighlightsRail } from "@/components/ui/highlights-rail";
import { HomeEventBand, type HomeEventBandData } from "@/components/ui/home-event";
import { HomeTeamsSection } from "@/components/ui/home-teams";
import { StatsStrip } from "@/components/ui/stats-strip";

// The home page reads stories, highlights, stats, teams and the next event from the DB via
// supabase-js (NOT `fetch`), so force per-request rendering — every section reflects an
// editor's change immediately (and "next event" + the rail's relative times depend on now).
export const dynamic = "force-dynamic";

// Localized page (served at / and /es): hreflang alternates en / es / x-default.
export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale()).home;
  return { title: t.metaTitle, alternates: await alternatesFor("/") };
}

// Server Component. The ESPN-style home (docs/features/softball/home-feed/overview.md):
//   lead story ─────────────── │ highlights rail (sticky on desktop)
//   Latest: story rows, infinite scroll, with the next-tournament band + stats strip as
//   interstitials
//   then Our Teams · Get Involved.
// Every data section is omitted when it has nothing to show. All reads in one Promise.all.
export default async function Home() {
  const locale = await getLocale();
  const now = new Date();
  const [feed, highlights, stats, nationalTeams, next] = await Promise.all([
    getHomeFeed(locale),
    listHighlights(locale),
    listPublishedStats(3),
    TEAMS_ENABLED ? listTeams(undefined, { kind: "national" }) : Promise.resolve([]),
    EVENTS_ENABLED ? getNextTournament(now) : Promise.resolve(null),
  ]);
  const t = getDictionary(locale).home;

  const nextEvent: HomeEventBandData | null = next
    ? {
        name: locale === "es" && next.tournament.nameEs ? next.tournament.nameEs : next.tournament.name,
        href: localizePath(locale, `/tournaments/${next.tournament.slug}`),
        dates: next.window
          ? formatTournamentWindow(next.window, next.tournament.timezone, locale)
          : "",
        dateTime: next.window?.start,
        venue: [
          next.tournament.city,
          next.tournament.countryCode ? countryName(next.tournament.countryCode, locale) : "",
        ]
          .filter(Boolean)
          .join(", "),
        coverImageUrl: next.tournament.coverImageUrl,
      }
    : null;

  // Interstitials ride after the 3rd and 6th stories of the first page (H10). With fewer
  // stories they attach to the last one, so they never silently disappear.
  const firstPage = feed.page.stories;
  const anchorAt = (n: number) => firstPage[Math.min(n, firstPage.length) - 1]?.id;
  const interstitials: FeedInterstitial[] = [];
  if (nextEvent && anchorAt(3)) {
    interstitials.push({
      afterId: anchorAt(3)!,
      testId: "feed-event",
      node: (
        <HomeEventBand
          event={nextEvent}
          variant="inset"
          labels={{
            eyebrow: t.eventEyebrow,
            details: t.eventDetails,
            dates: t.eventDates,
            location: t.eventLocation,
          }}
        />
      ),
    });
  }
  const statsAnchor = anchorAt(6);
  if (stats.length > 0 && statsAnchor && !interstitials.some((i) => i.afterId === statsAnchor)) {
    interstitials.push({ afterId: statsAnchor, testId: "feed-stats", node: <StatsStrip stats={stats} /> });
  }

  const newestAt =
    [feed.lead?.publishedAt, firstPage[0]?.publishedAt]
      .filter((v): v is string => !!v)
      .sort()
      .at(-1) ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">{t.metaTitle}</h1>

      {/* One grid, three children. Phones stack lead → highlights strip → feed; desktop puts the
          rail in column 2 spanning both rows, so its sticky range is the whole feed. */}
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-x-10 lg:gap-y-10 lg:pt-10">
        {feed.lead ? (
          <div className="min-w-0 lg:col-start-1">
            <LeadStory story={feed.lead} locale={locale} />
          </div>
        ) : null}

        {highlights.length > 0 ? (
          <HighlightsRail
            items={highlights}
            locale={locale}
            now={now}
            className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          />
        ) : null}

        {firstPage.length > 0 ? (
          <div className="min-w-0 lg:col-start-1">
            <HomeFeedList
              initialStories={firstPage}
              initialCursor={feed.page.nextCursor}
              leadId={feed.lead?.id ?? null}
              newestAt={newestAt}
              highlightAt={highlights[0]?.publishedAt ?? null}
              interstitials={interstitials}
            />
          </div>
        ) : null}
      </div>

      {nationalTeams.length > 0 ? (
        <HomeTeamsSection teams={nationalTeams.slice(0, 3)} locale={locale} />
      ) : null}

      <GetInvolvedSection locale={locale} />
    </div>
  );
}
