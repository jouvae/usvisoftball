import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeamBySlug, ISLAND_LABELS } from "@/lib/teams";
import { countryName, flagEmoji, hasLiveGame, listGamesForTeam } from "@/lib/schedule";
import { getLocale, getT } from "@/lib/i18n/server";
import { TeamRoster } from "@/components/ui/team-roster";
import { EventRow } from "@/components/ui/event-row";
import { LiveRefresh } from "@/components/client/live-refresh";
import { EVENTS_ENABLED, TEAMS_ENABLED } from "@/lib/flags";

// One team's page from the REAL Supabase read via lib/teams (RLS publishable client). `params`
// is a Promise in Next 16 and MUST be awaited. Unknown slug → 404. Member teams (clubs,
// national teams) show their roster — ACTIVE players only (players are deactivated, never
// deleted: schedule D4). Guest teams (opponents, D5) get a light page: flag, country,
// division and their games — never a roster. Teams with games list them as shared EventRows.
// force-dynamic: reads Supabase, never prerendered at build.
export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: PageProps<"/teams/[slug]">) {
  if (!TEAMS_ENABLED) notFound(); // dormant for MVP launch
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const [games, locale, dict] = await Promise.all([
    EVENTS_ENABLED ? listGamesForTeam(team.id) : Promise.resolve([]),
    getLocale(),
    getT(),
  ]);
  const t = dict.schedule;
  const guest = team.kind === "guest";
  const players = team.players.filter((p) => p.active);
  const flag = flagEmoji(team.countryCode);

  return (
    <section
      data-testid="team-detail"
      data-kind={team.kind}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/teams"
          className="w-fit text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          ← Teams
        </Link>
        <h1
          data-testid="team-detail-name"
          className="flex items-center gap-3 font-display text-4xl font-bold uppercase tracking-tight text-navy"
        >
          {guest && flag ? (
            <span data-testid="team-flag" aria-hidden="true" className="text-5xl leading-none">
              {flag}
            </span>
          ) : null}
          {team.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {guest ? (
            <span data-testid="team-country" className="font-semibold">
              {team.countryCode ? countryName(team.countryCode, locale) : ""}
            </span>
          ) : (
            <span data-testid="team-detail-island" className="font-semibold">
              {team.island ? ISLAND_LABELS[team.island] : "U.S. Virgin Islands"}
            </span>
          )}
          {team.division ? (
            <span data-testid="team-detail-division">· {team.division}</span>
          ) : null}
          {team.homeVenue ? (
            <span data-testid="team-detail-venue">· {team.homeVenue}</span>
          ) : null}
          {team.foundedYear ? <span>· Est. {team.foundedYear}</span> : null}
        </div>
      </div>

      {team.description && !guest ? (
        <p
          data-testid="team-detail-description"
          className="max-w-3xl text-lg text-foreground"
        >
          {team.description}
        </p>
      ) : null}

      {games.length > 0 || guest ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
            {t.games}
          </h2>
          {games.length > 0 ? (
            <ul
              role="list"
              data-testid="team-games"
              className="divide-y divide-border overflow-hidden rounded-xl bg-white ring-1 ring-border"
            >
              {games.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} locale={locale} showDate />
                </li>
              ))}
            </ul>
          ) : (
            <p data-testid="team-games-empty" className="text-muted">
              {t.noGames}
            </p>
          )}
          <LiveRefresh active={hasLiveGame(games)} />
        </div>
      ) : null}

      {guest ? null : (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-navy">
            Roster
          </h2>
          <TeamRoster players={players} />
        </div>
      )}
    </section>
  );
}
