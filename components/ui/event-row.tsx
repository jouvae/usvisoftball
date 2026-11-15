import Link from "next/link";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  ATLANTIC_TZ,
  eventDisplayTitle,
  formatEventDate,
  formatEventTime,
  gameWinner,
  isUsviGame,
  runTotals,
  timeZoneLabel,
  type EventWithGame,
  type Locale,
  type Side,
} from "@/lib/schedule-view";
import { EventStateChip } from "@/components/ui/event-state-chip";
import { TeamBadge } from "@/components/ui/team-badge";

type Variant = "row" | "card";

// One event in a schedule (D12): the SAME component renders list rows and cards — `variant`
// only changes the layout, never the data or the child testids (event-row-time, -away, -home,
// -title, -status). The whole thing is a real <a href="/events/{slug}"> (crawlable, works
// without JS); in-site clicks are intercepted into the modal/drawer by the @modal slot.
// USVI games carry data-usvi="true" and a gold left rule. Isomorphic (no hooks).
export function EventRow({
  event,
  locale,
  variant = "row",
  showDate = false,
  className = "",
}: {
  event: EventWithGame;
  locale: Locale;
  variant?: Variant;
  showDate?: boolean; // outside a day group (team pages) the row names its date
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const usvi = isUsviGame(event.game);
  const game = event.game;
  const showScore = game != null && game.state !== "pregame";
  const totals = game ? runTotals(game.innings) : { away: 0, home: 0 };
  const winner = game ? gameWinner(game, totals) : null;
  const tz = event.timezone;
  const atlantic = tz !== ATLANTIC_TZ;
  const href = localizePath(locale, `/events/${event.slug}`);

  const time = (
    <div data-testid="event-row-time" className="flex flex-col leading-tight">
      {showDate || variant === "card" ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {formatEventDate(event.startsAt, tz, locale)}
        </span>
      ) : null}
      <span className="font-display text-lg font-semibold text-navy tabular-nums">
        <time dateTime={event.startsAt}>{formatEventTime(event.startsAt, tz, locale)}</time>{" "}
        <span className="text-xs font-medium text-muted">
          {timeZoneLabel(event.startsAt, tz, locale)}
        </span>
      </span>
      {atlantic ? (
        <span data-testid="event-row-time-atlantic" className="text-xs text-muted tabular-nums">
          {formatEventTime(event.startsAt, ATLANTIC_TZ, locale)}{" "}
          {timeZoneLabel(event.startsAt, ATLANTIC_TZ, locale)}
        </span>
      ) : null}
    </div>
  );

  const side = (s: Side) =>
    game ? (
      <div className="flex min-w-0 items-center justify-between gap-3">
        <TeamBadge
          team={game[s]}
          locale={locale}
          size="sm"
          testId={`event-row-${s}`}
          className={winner && winner !== s ? "opacity-70" : ""}
        />
        {showScore ? (
          <span
            data-testid={`event-row-score-${s}`}
            className={`font-display text-lg tabular-nums ${winner === s ? "font-bold text-navy" : "text-muted"}`}
          >
            {totals[s]}
          </span>
        ) : null}
      </div>
    ) : null;

  const body = game ? (
    <div className="flex min-w-0 flex-col gap-1">
      {side("away")}
      {side("home")}
    </div>
  ) : (
    <span
      data-testid="event-row-title"
      className="min-w-0 font-display text-base font-semibold text-navy"
    >
      {eventDisplayTitle(event, locale)}
    </span>
  );

  const chip = game ? <EventStateChip event={event} locale={locale} testId="event-row-status" /> : null;
  const usviRule = usvi ? "border-l-accent bg-accent/10" : "border-l-transparent";
  const focus =
    "outline-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:relative";

  if (variant === "card") {
    return (
      <Link
        href={href}
        data-testid="event-card"
        data-slug={event.slug}
        data-usvi={usvi ? "true" : "false"}
        className={`flex flex-col gap-3 rounded-2xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md ${usviRule} ${focus} ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          {time}
          {chip}
        </div>
        {body}
        <p className="truncate text-xs text-muted">
          {event.venue}
          {event.round && t.rounds[event.round] ? ` · ${t.rounds[event.round]}` : ""}
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      data-testid="event-row"
      data-slug={event.slug}
      data-usvi={usvi ? "true" : "false"}
      className={`grid min-h-14 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-l-4 px-3 py-3 transition-colors hover:bg-surface sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] ${usviRule} ${focus} ${className}`}
    >
      {time}
      {body}
      {chip ? <div className="col-start-2 sm:col-start-auto sm:justify-self-end">{chip}</div> : null}
    </Link>
  );
}
