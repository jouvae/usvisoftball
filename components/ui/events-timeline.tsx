import Link from "next/link";
import { MapPin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  DEFAULT_EVENT_HOURS,
  eventDisplayTitle,
  formatEventTime,
  isUsviGame,
  localHours,
  timelinePosition,
  timelineRange,
  venueZoneLabel,
  type DayGroup,
  type EventWithGame,
  type Locale,
} from "@/lib/schedule-view";
import { EventStateChip } from "@/components/ui/event-state-chip";
import { TeamBadge } from "@/components/ui/team-badge";

// Width of one hour on the track; below the container width the track scrolls horizontally
// inside its own scroller (the page never overflows).
const HOUR_REM = 8;
// Height of one stacked item row inside a lane.
const ROW_REM = 6.25;

// The Timeline view (overview §5, schedule-web-021): one venue-local day, a lane per venue, an
// hour axis, and compact items placed left→right by venue-local start (timelinePosition). Items
// whose blocks would overlap stack into extra rows within their lane. Every item is a real
// <a href="/events/{slug}"> so the @modal slot intercepts it like a list row. Day picker = pill
// links to `?view=timeline&date=YYYY-MM-DD`. Isomorphic (no hooks).
export function EventsTimeline({
  days,
  selected,
  locale,
  dayHref,
  className = "",
}: {
  days: DayGroup[]; // every day with events, ascending
  selected: DayGroup | null;
  locale: Locale;
  dayHref: (date: string) => string;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const dayLabel = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div data-testid="events-timeline" className={`flex min-w-0 flex-col gap-5 ${className}`}>
      <nav aria-label={t.timelineDays}>
        <ul role="list" className="flex flex-wrap gap-2">
          {days.map((day) => {
            const active = day.date === selected?.date;
            return (
              <li key={day.date}>
                <Link
                  href={dayHref(day.date)}
                  data-testid="timeline-day"
                  data-date={day.date}
                  aria-current={active ? "date" : undefined}
                  scroll={false}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 font-display text-sm font-semibold uppercase tracking-wide outline-focus ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    active
                      ? "bg-navy text-navy-foreground ring-navy"
                      : "bg-white text-navy ring-border hover:bg-surface"
                  }`}
                >
                  {dayLabel.format(dayDate(day))}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {selected ? <DayTimeline day={selected} locale={locale} /> : null}
    </div>
  );
}

// A calendar date as a UTC-noon Date, so formatting without a zone never shifts the day.
function dayDate(day: DayGroup): Date {
  return new Date(`${day.date}T12:00:00Z`);
}

function DayTimeline({ day, locale }: { day: DayGroup; locale: Locale }) {
  const tz = day.timezone;
  const range = timelineRange(
    day.venues.flatMap((v) => v.events),
    tz,
  );
  const hours = range.endHour - range.startHour;
  const ticks = Array.from({ length: hours }, (_, i) => range.startHour + i);
  const hourLabel = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hour12: true,
    timeZone: "UTC",
  });
  const grid = {
    backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px)",
    backgroundSize: `${100 / hours}% 100%`,
  };

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-2xl bg-white ring-1 ring-border">
      <div className="relative flex flex-col" style={{ minWidth: `${hours * HOUR_REM}rem` }}>
        <div
          data-testid="timeline-axis"
          aria-hidden="true"
          className="relative h-9 border-b border-border bg-surface"
        >
          {ticks.map((h) => (
            <span
              key={h}
              className="absolute top-0 flex h-full items-center border-l border-border pl-1.5 text-xs font-semibold text-muted tabular-nums"
              style={{ left: `${((h - range.startHour) / hours) * 100}%` }}
            >
              {hourLabel.format(new Date(Date.UTC(2000, 0, 1, h)))}
            </span>
          ))}
        </div>

        {day.venues.map((v) => {
          const placed = placeItems(v.events, range, tz);
          const rows = Math.max(1, ...placed.map((p) => p.row + 1));
          return (
            <section
              key={v.venue}
              data-testid="timeline-lane"
              data-venue={v.venue}
              aria-label={v.venue}
              className="border-b border-border last:border-b-0"
            >
              <h3 className="sticky left-0 inline-flex px-3 pt-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 font-display text-sm font-semibold uppercase tracking-wide text-accent-foreground">
                  <MapPin aria-hidden="true" className="size-3.5" />
                  {v.venue}
                </span>
              </h3>
              <ul
                role="list"
                className="relative my-3"
                style={{ ...grid, height: `${rows * ROW_REM}rem` }}
              >
                {placed.map(({ event, left, width, row }) => (
                  <li
                    key={event.id}
                    className="absolute px-1"
                    style={{
                      left: `${left * 100}%`,
                      width: `${width * 100}%`,
                      top: `${row * ROW_REM}rem`,
                      height: `${ROW_REM - 0.5}rem`,
                    }}
                  >
                    <TimelineItem event={event} locale={locale} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Left/width fractions per event + a stacking row so blocks in one lane never overlap. A block
// spans max(duration, DEFAULT_EVENT_HOURS) — wide enough for its content — clipped to the track.
function placeItems(
  events: EventWithGame[],
  range: { startHour: number; endHour: number },
  tz: string,
) {
  const hours = range.endHour - range.startHour;
  const rowEnds: number[] = [];
  return events.map((event) => {
    const left = timelinePosition(event.startsAt, range, tz);
    const duration = event.endsAt
      ? (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 3_600_000
      : DEFAULT_EVENT_HOURS;
    const width = Math.max(
      0.02,
      Math.min(Math.max(duration, DEFAULT_EVENT_HOURS) / hours, 1 - left),
    );
    const start = localHours(event.startsAt, tz);
    let row = rowEnds.findIndex((end) => end <= start + 1e-9);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = start + width * hours;
    return { event, left, width, row };
  });
}

function TimelineItem({ event, locale }: { event: EventWithGame; locale: Locale }) {
  const usvi = isUsviGame(event.game);
  const game = event.game;
  return (
    <Link
      href={localizePath(locale, `/events/${event.slug}`)}
      data-testid="timeline-item"
      data-slug={event.slug}
      data-usvi={usvi ? "true" : "false"}
      className={`flex h-full flex-col justify-center gap-1 overflow-hidden rounded-lg border-l-4 px-2.5 py-1.5 shadow-sm ring-1 ring-border outline-focus transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 ${
        usvi
          ? "border-l-accent bg-white bg-linear-to-r from-accent/10 to-accent/10"
          : "border-l-navy/30 bg-white"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-navy tabular-nums">
          <time dateTime={event.startsAt}>
            {formatEventTime(event.startsAt, event.timezone, locale)}
          </time>{" "}
          <span className="text-xs font-medium text-muted">
            {venueZoneLabel(event.timezone, locale)}
          </span>
        </span>
        {game ? (
          <EventStateChip event={event} locale={locale} testId="timeline-item-status" />
        ) : null}
      </span>
      {game ? (
        <>
          <TeamBadge
            team={game.away}
            locale={locale}
            size="sm"
            className="[&>span:last-child]:truncate"
          />
          <TeamBadge
            team={game.home}
            locale={locale}
            size="sm"
            className="[&>span:last-child]:truncate"
          />
        </>
      ) : (
        <span className="line-clamp-2 font-display text-sm font-semibold text-navy">
          {eventDisplayTitle(event, locale)}
        </span>
      )}
    </Link>
  );
}
