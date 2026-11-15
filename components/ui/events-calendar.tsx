import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  calendarMonthGrid,
  isUsviGame,
  localDateKey,
  type EventWithGame,
  type Locale,
} from "@/lib/schedule-view";

// Shift a 'YYYY-MM' month by ±n.
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// The Calendar view (overview §5, schedule-web-022): a month grid of whole weeks (Sunday-first
// en, Monday-first es) as a real <table>. Each day with events shows a count, a gold USVI marker
// when it has a USVI game, and links to the list filtered to that VENUE-LOCAL day
// (`?view=list&date=YYYY-MM-DD`). Prev/next are plain <a> links to `?month=` — a full
// navigation, so rapid repeated clicks always act on the page they land on (a client transition
// would let a second click hit the previous month's stale link). Isomorphic (no hooks).
export function EventsCalendar({
  events,
  month,
  today,
  locale,
  monthHref,
  dayHref,
  className = "",
}: {
  events: EventWithGame[];
  month: string; // 'YYYY-MM'
  today: string; // 'YYYY-MM-DD'
  locale: Locale;
  monthHref: (month: string) => string;
  dayHref: (date: string) => string;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const [year, m] = month.split("-").map(Number);
  const weekStartsOn = locale === "es" ? 1 : 0;
  const weeks = calendarMonthGrid(year, m, weekStartsOn);

  const byDate = new Map<string, { count: number; usvi: boolean }>();
  for (const e of events) {
    const key = localDateKey(e.startsAt, e.timezone);
    const cur = byDate.get(key) ?? { count: 0, usvi: false };
    cur.count += 1;
    cur.usvi ||= isUsviGame(e.game);
    byDate.set(key, cur);
  }

  const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
  const heading = fmt({ month: "long", year: "numeric" }).format(utc(`${month}-15`));
  const longDay = fmt({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const weekdayShort = fmt({ weekday: "short" });
  const weekdayLong = fmt({ weekday: "long" });
  const headingId = `calendar-heading-${month}`;

  const nav =
    "inline-flex size-11 items-center justify-center rounded-lg bg-white text-navy ring-1 ring-border outline-focus transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div data-testid="events-calendar" className={`flex min-w-0 flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <a
          href={monthHref(shiftMonth(month, -1))}
          data-testid="calendar-prev"
          aria-label={t.calendarPrev}
          className={nav}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </a>
        <h2
          id={headingId}
          data-testid="calendar-month-heading"
          className="font-display text-2xl font-bold uppercase tracking-tight text-navy sm:text-3xl"
        >
          {heading}
        </h2>
        <a
          href={monthHref(shiftMonth(month, 1))}
          data-testid="calendar-next"
          aria-label={t.calendarNext}
          className={nav}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </a>
      </div>

      <table
        aria-labelledby={headingId}
        className="w-full table-fixed border-collapse overflow-hidden rounded-2xl bg-white ring-1 ring-border"
      >
        <thead className="bg-navy text-navy-foreground">
          <tr>
            {weeks[0].map((d) => (
              <th
                key={d}
                scope="col"
                className="py-2 font-display text-xs font-semibold uppercase tracking-wide sm:text-sm"
              >
                <abbr title={weekdayLong.format(utc(d))} className="no-underline">
                  {weekdayShort.format(utc(d))}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((d) => {
                const info = byDate.get(d);
                const inMonth = d.startsWith(month);
                const isToday = d === today;
                const label = info
                  ? [
                      longDay.format(utc(d)),
                      info.count === 1
                        ? t.calendarEvent
                        : t.calendarEvents.replace("{n}", String(info.count)),
                      info.usvi ? t.calendarUsvi : "",
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : undefined;
                const number = (
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums ${
                      isToday ? "bg-navy font-bold text-navy-foreground" : ""
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                );
                return (
                  <td
                    key={d}
                    data-testid="calendar-day"
                    data-date={d}
                    data-usvi={info?.usvi ? "true" : "false"}
                    aria-current={isToday ? "date" : undefined}
                    className={`h-16 border border-border p-0 align-top sm:h-24 ${
                      inMonth ? "text-foreground" : "bg-surface text-muted/70"
                    }`}
                  >
                    {info ? (
                      <Link
                        href={dayHref(d)}
                        aria-label={label}
                        className={`flex h-full flex-col items-start gap-1 p-1 outline-focus transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 sm:p-2 ${
                          info.usvi ? "border-l-4 border-l-accent bg-accent/10" : ""
                        }`}
                      >
                        {number}
                        <span
                          data-testid="calendar-day-count"
                          className="inline-flex items-center gap-1 rounded-full bg-navy px-1.5 font-display text-xs font-semibold text-navy-foreground sm:px-2"
                        >
                          {info.count}
                          {info.usvi ? <span aria-hidden="true">🇻🇮</span> : null}
                        </span>
                      </Link>
                    ) : (
                      <div className="p-1 sm:p-2">{number}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
