import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import {
  USVI_COUNTRY,
  countryName,
  formatTournamentWindow,
  getTournamentBySlug,
  hasLiveGame,
  listEvents,
  tournamentWindow,
  type ScheduleTeam,
} from "@/lib/schedule";
import { alternatesFor, getLocale, getT } from "@/lib/i18n/server";
import { localizePath } from "@/lib/i18n/locale";
import { EVENTS_ENABLED } from "@/lib/flags";
import { EventsView, type EventsViewMode } from "@/components/ui/events-view";
import { TeamBadge } from "@/components/ui/team-badge";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { LiveRefresh } from "@/components/client/live-refresh";

// A tournament hub (overview §5): localized name, city, the DERIVED date window (D2, in the
// tournament's zone), the shared EventsView scoped to its events, and the participating teams
// derived from its games. Unknown slug → 404. force-dynamic: reads Supabase per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/tournaments/[slug]">): Promise<Metadata> {
  if (!EVENTS_ENABLED) return {};
  const { slug } = await params;
  const [tournament, locale] = await Promise.all([getTournamentBySlug(slug), getLocale()]);
  if (!tournament) return {};
  const name = locale === "es" && tournament.nameEs ? tournament.nameEs : tournament.name;
  const description =
    (locale === "es" && tournament.descriptionEs ? tournament.descriptionEs : tournament.description) ||
    name;
  return {
    title: name,
    description,
    alternates: await alternatesFor(`/tournaments/${slug}`),
    openGraph: { title: name, description },
  };
}

export default async function TournamentPage({
  params,
  searchParams,
}: PageProps<"/tournaments/[slug]">) {
  if (!EVENTS_ENABLED) notFound();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  const view: EventsViewMode = sp.view === "cards" ? "cards" : "list";
  const usviOnly = sp.team === "usvi";
  const [all, shown, locale, dict] = await Promise.all([
    listEvents({ tournamentId: tournament.id }),
    usviOnly
      ? listEvents({ tournamentId: tournament.id, teamCountry: USVI_COUNTRY })
      : Promise.resolve(null),
    getLocale(),
    getT(),
  ]);
  const t = dict.schedule;
  const events = shown ?? all;
  const name = locale === "es" && tournament.nameEs ? tournament.nameEs : tournament.name;
  const description =
    locale === "es" && tournament.descriptionEs ? tournament.descriptionEs : tournament.description;
  const window = tournamentWindow(all, tournament);
  const place = [
    tournament.city,
    tournament.countryCode ? countryName(tournament.countryCode, locale) : "",
  ]
    .filter(Boolean)
    .join(", ");

  // Participating teams, derived from the tournament's games: USVI first, then by name.
  const teams = new Map<string, ScheduleTeam>();
  for (const e of all) {
    if (!e.game) continue;
    teams.set(e.game.away.id, e.game.away);
    teams.set(e.game.home.id, e.game.home);
  }
  const participants = [...teams.values()].sort(
    (a, b) =>
      Number(b.countryCode === USVI_COUNTRY) - Number(a.countryCode === USVI_COUNTRY) ||
      countryName(a.countryCode ?? "", locale).localeCompare(countryName(b.countryCode ?? "", locale)),
  );

  return (
    <div className="flex flex-1 flex-col">
      <section
        data-testid="tournament-detail"
        aria-labelledby="tournament-heading"
        className="bg-navy text-navy-foreground"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href={localizePath(locale, "/events")}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-navy-muted underline-offset-4 outline-accent hover:text-accent hover:underline focus-visible:outline-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t.allEvents}
          </Link>
          <div className="flex items-center gap-4">
            <AccentRule />
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">
              {t.tournament}
            </p>
          </div>
          <h1
            id="tournament-heading"
            className="max-w-4xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
          >
            {name}
          </h1>
          <ul className="flex flex-col gap-2 text-lg sm:flex-row sm:gap-8">
            <li className="flex items-center gap-3">
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span data-testid="tournament-dates">
                {window ? formatTournamentWindow(window, tournament.timezone, locale) : t.datesTba}
              </span>
            </li>
            {place ? (
              <li className="flex items-center gap-3">
                <MapPin aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span data-testid="tournament-place">{place}</span>
              </li>
            ) : null}
          </ul>
          {description ? <p className="max-w-3xl text-navy-muted">{description}</p> : null}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6">
        <section aria-labelledby="tournament-schedule-heading" className="flex flex-col gap-6">
          <h2
            id="tournament-schedule-heading"
            className="font-display text-3xl font-bold uppercase tracking-tight text-navy"
          >
            {t.schedule}
          </h2>
          <EventsView
            events={events}
            locale={locale}
            path={`/tournaments/${tournament.slug}`}
            view={view}
            usviOnly={usviOnly}
            now={new Date()}
          />
        </section>

        {participants.length > 0 ? (
          <section
            data-testid="tournament-teams"
            aria-labelledby="tournament-teams-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="tournament-teams-heading"
              className="font-display text-3xl font-bold uppercase tracking-tight text-navy"
            >
              {t.participatingTeams}
            </h2>
            <ul role="list" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((team) => (
                <li key={team.id} className="rounded-xl px-3 ring-1 ring-border">
                  <TeamBadge team={team} locale={locale} href testId="tournament-team" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <LiveRefresh active={hasLiveGame(events)} />
    </div>
  );
}
