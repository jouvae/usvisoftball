import Link from "next/link";
import { CalendarPlus, Clock, ExternalLink, MapPin, Tv } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  ATLANTIC_TZ,
  countryName,
  eventDisplayTitle,
  formatEventDate,
  formatEventTime,
  gameWinner,
  googleMapsUrl,
  isUsviTeam,
  runTotals,
  timeZoneLabel,
  type EventDetail as EventDetailData,
  type Locale,
  type Side,
} from "@/lib/schedule-view";
import { BoxScore } from "@/components/ui/box-score";
import { EventStateChip } from "@/components/ui/event-state-chip";
import { LineScore } from "@/components/ui/line-score";
import { Roster } from "@/components/ui/roster";
import { TeamBadge } from "@/components/ui/team-badge";
import { ShareButton } from "@/components/client/share-button";

export type EventPresentation = "page" | "modal" | "drawer";

// One event's detail (D7/D12) — the SAME component for the full page (direct load) and the
// in-site modal (≥ md) / drawer (< md); `presentation` only changes density and heading level.
// Sections top → bottom: header (teams, state, score) · when & where (venue-local + USVI time,
// venue, map, .ics) · watch live · line score · box score (USVI lines) · roster (USVI sides) ·
// share. Ceremonies: header + when & where. Isomorphic (no hooks) so the client sheet can render
// it with the same data the server page does.
export function EventDetail({
  event,
  locale,
  presentation,
  className = "",
}: {
  event: EventDetailData;
  locale: Locale;
  presentation: EventPresentation;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const tz = event.timezone;
  const game = event.game;
  const isPage = presentation === "page";
  const Title = isPage ? "h1" : "h2";
  const title = eventDisplayTitle(event, locale);
  const tournament = event.tournamentDetail;
  const tournamentName = tournament
    ? locale === "es" && tournament.nameEs
      ? tournament.nameEs
      : tournament.name
    : "";
  const place = tournament
    ? [tournament.city, tournament.countryCode ? countryName(tournament.countryCode, locale) : ""]
        .filter(Boolean)
        .join(", ")
    : "";
  const totals = game ? runTotals(game.innings) : { away: 0, home: 0 };
  const winner = game ? gameWinner(game, totals) : null;
  const showScore = game != null && game.state !== "pregame";
  const usviSides = game ? (["away", "home"] as const).filter((s) => isUsviTeam(game[s])) : [];
  const usviTeamIds = new Set(usviSides.map((s) => game![s].id));
  const usviLines = event.statLines.filter((l) => usviTeamIds.has(l.teamId));
  const path = localizePath(locale, `/events/${event.slug}`);
  const icsHref = `/events/${event.slug}/calendar.ics${locale === "es" ? "?lang=es" : ""}`;
  const round = event.round ? t.rounds[event.round] : "";

  const side = (s: Side) =>
    game ? (
      <div
        className={`flex min-w-0 flex-1 flex-col gap-1 ${s === "home" ? "items-end text-right" : "items-start"}`}
      >
        <TeamBadge
          team={game[s]}
          locale={locale}
          size={isPage ? "lg" : "md"}
          href
          testId={`event-team-${s}`}
          className={s === "home" ? "flex-row-reverse" : ""}
        />
        {showScore ? (
          <span
            data-testid={`event-score-${s}`}
            className={`font-display text-4xl tabular-nums sm:text-5xl ${winner === s ? "font-bold text-navy" : "text-muted"}`}
          >
            {totals[s]}
          </span>
        ) : null}
      </div>
    ) : null;

  const row = "flex items-start gap-3";
  const icon = "mt-0.5 size-5 shrink-0 text-navy";
  const action =
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-display text-sm font-semibold tracking-wide outline-focus transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <article
      data-testid="event-detail"
      data-presentation={presentation}
      data-slug={event.slug}
      className={`flex flex-col gap-6 ${className}`}
    >
      <header data-testid="event-detail-header" className="flex flex-col gap-4">
        {tournamentName || round ? (
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {tournament ? (
              <Link
                href={localizePath(locale, `/tournaments/${tournament.slug}`)}
                className="text-brand underline-offset-4 outline-focus hover:text-brand-hover hover:underline focus-visible:outline-2"
              >
                {tournamentName}
              </Link>
            ) : null}
            {round ? <span>· {round}</span> : null}
          </p>
        ) : null}

        {game ? (
          <>
            <Title className="sr-only">{title}</Title>
            <div className="flex items-start justify-between gap-3 sm:gap-6">
              {side("away")}
              <span
                aria-hidden="true"
                className="mt-2 shrink-0 font-display text-sm font-semibold uppercase text-muted"
              >
                {t.vs}
              </span>
              {side("home")}
            </div>
            <div>
              <EventStateChip event={event} locale={locale} testId="event-state" />
            </div>
          </>
        ) : (
          <>
            <Title
              className={`font-display font-bold tracking-tight text-navy ${isPage ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}
            >
              {title}
            </Title>
            {event.status !== "scheduled" ? (
              <div>
                <EventStateChip event={event} locale={locale} testId="event-state" />
              </div>
            ) : null}
          </>
        )}
      </header>

      <div className={isPage ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "flex flex-col gap-6"}>
        <div className="order-2 flex min-w-0 flex-col gap-8 lg:order-1">
          {game ? <LineScore game={game} locale={locale} /> : null}
          {game && usviLines.length > 0 ? <BoxScore lines={usviLines} locale={locale} /> : null}
          {game && usviSides.length > 0 ? (
            <Roster
              locale={locale}
              sides={usviSides.map((s) => ({ team: game[s], players: event.rosters[s] }))}
            />
          ) : null}
        </div>

        <aside
          aria-label={t.whenWhere}
          className={`order-1 flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-border lg:order-2 ${game ? "" : "lg:col-span-2"}`}
        >
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
            {t.whenWhere}
          </h2>
          <div className={row}>
            <Clock aria-hidden="true" className={icon} />
            <div className="flex flex-col gap-1">
              <p data-testid="event-detail-date" className="font-semibold text-foreground">
                {formatEventDate(event.startsAt, tz, locale)}
              </p>
              <p data-testid="event-time-local" className="text-foreground tabular-nums">
                <time dateTime={event.startsAt} className="font-display text-xl font-semibold text-navy">
                  {formatEventTime(event.startsAt, tz, locale)}
                </time>{" "}
                <span className="text-sm text-muted">
                  {timeZoneLabel(event.startsAt, tz, locale)} · {t.localTime}
                </span>
              </p>
              {tz !== ATLANTIC_TZ ? (
                <p data-testid="event-time-atlantic" className="text-sm text-muted tabular-nums">
                  <span className="font-semibold text-foreground">
                    {formatEventTime(event.startsAt, ATLANTIC_TZ, locale)}
                  </span>{" "}
                  {timeZoneLabel(event.startsAt, ATLANTIC_TZ, locale)} · {t.atlanticTime}
                </p>
              ) : null}
            </div>
          </div>
          <div className={row}>
            <MapPin aria-hidden="true" className={icon} />
            <div className="flex flex-col gap-1">
              <p data-testid="event-detail-venue" className="font-semibold text-foreground">
                {event.venue}
              </p>
              {place ? <p className="text-sm text-muted">{place}</p> : null}
              <a
                href={googleMapsUrl(event.venue, place)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="event-detail-map"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 outline-focus hover:text-brand-hover hover:underline focus-visible:outline-2"
              >
                {t.map}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={icsHref}
              download
              data-testid="event-detail-ics"
              className={`${action} bg-white text-navy ring-1 ring-navy/30 hover:bg-white/70`}
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              {t.addToCalendar}
            </a>
            {event.streamUrl ? (
              <a
                href={event.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="event-detail-stream"
                className={`${action} bg-accent text-accent-foreground hover:bg-accent-hover`}
              >
                <Tv aria-hidden="true" className="size-4" />
                {t.watchLive}
              </a>
            ) : null}
            <ShareButton
              path={path}
              title={title}
              label={t.share}
              copiedLabel={t.shareCopied}
              className="bg-white"
            />
          </div>
        </aside>
      </div>
    </article>
  );
}
