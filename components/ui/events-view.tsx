import Link from "next/link";
import { CalendarDays, ChevronDown, ChartGantt, LayoutGrid, List, MapPin, X } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  ATLANTIC_TZ,
  defaultCalendarMonth,
  formatEventDate,
  groupEventsByDay,
  localDateKey,
  type DayGroup,
  type EventWithGame,
  type Locale,
} from "@/lib/schedule-view";
import { EventRow } from "@/components/ui/event-row";
import { EventsCalendar } from "@/components/ui/events-calendar";
import { EventsTimeline } from "@/components/ui/events-timeline";

export type EventsViewMode = "list" | "cards" | "timeline" | "calendar";

const VIEW_MODES: readonly EventsViewMode[] = ["list", "cards", "timeline", "calendar"];

// The hub's URL state, parsed from searchParams: `view`, `team=usvi`, `date` (YYYY-MM-DD — the
// list's day filter and the timeline's day) and `month` (YYYY-MM — the calendar's month).
// Malformed values are ignored.
export function parseEventsParams(sp: Record<string, string | string[] | undefined>): {
  view: EventsViewMode;
  usviOnly: boolean;
  date: string | null;
  month: string | null;
} {
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const view = one(sp.view);
  const date = one(sp.date);
  const month = one(sp.month);
  return {
    view: VIEW_MODES.includes(view as EventsViewMode) ? (view as EventsViewMode) : "list",
    usviOnly: one(sp.team) === "usvi",
    date: date && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : null,
    month: month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null,
  };
}

// The schedule hub (D12) — used by /events and /tournaments/[slug]. A List | Cards | Timeline |
// Calendar switcher and the "USVI games" toggle are plain links that drive `?view=` /
// `?team=usvi` (shareable, server-rendered, no client JS); `?date=` filters the list to one
// venue-local day (or picks the timeline's day) and `?month=` pages the calendar. Events group day → venue like the flyer: a navy bar per
// VENUE-LOCAL day, a gold venue label, then the rows (or cards) in start order. Past days fold
// into a "Past" disclosure below the upcoming ones. Isomorphic (no hooks).
export function EventsView({
  events,
  locale,
  path,
  view,
  usviOnly = false,
  date = null,
  month = null,
  showFilter = true,
  now,
  className = "",
}: {
  events: EventWithGame[];
  locale: Locale;
  path: string; // the internal (unprefixed) route these controls link to, e.g. "/events"
  view: EventsViewMode;
  usviOnly?: boolean;
  date?: string | null; // 'YYYY-MM-DD' (list/cards filter, timeline day)
  month?: string | null; // 'YYYY-MM' (calendar)
  showFilter?: boolean;
  now: Date;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const { upcoming, past } = groupEventsByDay(events, now);

  const href = (next: {
    view: EventsViewMode;
    usvi: boolean;
    date?: string | null;
    month?: string | null;
  }) => {
    const qs = new URLSearchParams();
    if (next.view !== "list" || next.date) qs.set("view", next.view);
    if (next.usvi) qs.set("team", "usvi");
    if (next.date) qs.set("date", next.date);
    if (next.month) qs.set("month", next.month);
    const q = qs.toString();
    return localizePath(locale, path) + (q ? `?${q}` : "");
  };
  // The zone "today" and the default calendar month are read in: the events' venue zone.
  const zone = events[0]?.timezone ?? ATLANTIC_TZ;

  const control =
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 font-display text-sm font-semibold tracking-wide outline-focus transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div data-testid="events-view" data-view={view} className={`flex flex-col gap-8 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          data-testid="events-view-switcher"
          aria-label={t.viewLabel}
          className="grid w-full grid-cols-4 rounded-xl bg-surface p-1 ring-1 ring-border sm:inline-flex sm:w-auto"
        >
          {(
            [
              { mode: "list", label: t.viewList, Icon: List },
              { mode: "cards", label: t.viewCards, Icon: LayoutGrid },
              { mode: "timeline", label: t.viewTimeline, Icon: ChartGantt },
              { mode: "calendar", label: t.viewCalendar, Icon: CalendarDays },
            ] as const
          ).map(({ mode, label, Icon }) => {
            const active = view === mode;
            return (
              <Link
                key={mode}
                href={href({ view: mode, usvi: usviOnly })}
                data-testid={`events-view-${mode}`}
                aria-current={active ? "true" : undefined}
                scroll={false}
                className={`${control} justify-center px-2 sm:px-3.5 ${
                  active ? "bg-navy text-navy-foreground shadow-sm" : "text-navy hover:bg-white"
                }`}
              >
                <Icon aria-hidden="true" className="hidden size-4 sm:block" />
                {label}
              </Link>
            );
          })}
        </nav>

        {showFilter ? (
          <Link
            href={href({ view, usvi: !usviOnly, date, month })}
            data-testid="events-filter-usvi"
            aria-pressed={usviOnly ? "true" : "false"}
            scroll={false}
            className={`${control} ring-1 ${
              usviOnly
                ? "bg-accent text-accent-foreground ring-accent hover:bg-accent-hover"
                : "bg-white text-navy ring-border hover:bg-surface"
            }`}
          >
            <span aria-hidden="true">🇻🇮</span>
            {t.filterUsvi}
          </Link>
        ) : null}
      </div>

      {view === "timeline" ? (
        events.length === 0 ? (
          <Empty text={usviOnly ? t.emptyFiltered : t.empty} />
        ) : (
          <EventsTimeline
            days={[...past, ...upcoming]}
            selected={
              [...past, ...upcoming].find((d) => d.date === date) ??
              upcoming[0] ??
              past[past.length - 1] ??
              null
            }
            locale={locale}
            dayHref={(d) => href({ view: "timeline", usvi: usviOnly, date: d })}
          />
        )
      ) : view === "calendar" ? (
        <EventsCalendar
          events={events}
          month={month ?? defaultCalendarMonth(events, now.toISOString(), zone)}
          today={localDateKey(now.toISOString(), zone)}
          locale={locale}
          monthHref={(m) => href({ view: "calendar", usvi: usviOnly, month: m })}
          dayHref={(d) => href({ view: "list", usvi: usviOnly, date: d })}
        />
      ) : date ? (
        <DateFiltered
          days={[...past, ...upcoming].filter((d) => d.date === date)}
          date={date}
          locale={locale}
          view={view}
          clearHref={href({ view, usvi: usviOnly })}
        />
      ) : (
        <>
          {upcoming.length === 0 && past.length === 0 ? (
            <Empty text={usviOnly ? t.emptyFiltered : t.empty} />
          ) : null}

          {upcoming.map((day) => (
            <Day key={day.date} day={day} locale={locale} view={view} testId="events-day" />
          ))}

          {past.length > 0 ? (
            <details data-testid="events-past" className="group rounded-2xl ring-1 ring-border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 font-display text-lg font-semibold uppercase tracking-wide text-navy outline-focus focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                <span>
                  {t.past} <span className="text-muted">({past.length})</span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-8 p-3 pt-1 sm:p-4">
                {[...past].reverse().map((day) => (
                  <Day
                    key={day.date}
                    day={day}
                    locale={locale}
                    view={view}
                    testId="events-past-day"
                  />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

function Day({
  day,
  locale,
  view,
  testId,
}: {
  day: DayGroup;
  locale: Locale;
  view: EventsViewMode;
  testId: string;
}) {
  return (
    <section data-testid={testId} data-date={day.date} className="flex flex-col gap-4">
      <h2
        data-testid="events-day-heading"
        className="rounded-lg bg-navy px-4 py-2.5 font-display text-lg font-bold uppercase tracking-wide text-navy-foreground sm:text-xl"
      >
        {formatEventDate(day.firstStartsAt, day.timezone, locale)}
      </h2>
      {day.venues.map((v) => (
        <div key={v.venue} data-testid="events-venue" className="flex flex-col gap-2">
          <h3 className="flex items-center">
            <span
              data-testid="events-venue-name"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 font-display text-sm font-semibold uppercase tracking-wide text-accent-foreground"
            >
              <MapPin aria-hidden="true" className="size-3.5" />
              {v.venue}
            </span>
          </h3>
          {view === "cards" ? (
            <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {v.events.map((e) => (
                <li key={e.id} className="flex">
                  <EventRow event={e} locale={locale} variant="card" className="w-full" />
                </li>
              ))}
            </ul>
          ) : (
            <ul
              role="list"
              className="divide-y divide-border overflow-hidden rounded-xl bg-white ring-1 ring-border"
            >
              {v.events.map((e) => (
                <li key={e.id}>
                  <EventRow event={e} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p data-testid="events-empty" className="rounded-2xl bg-surface p-6 text-muted">
      {text}
    </p>
  );
}

// The list/cards filtered to one venue-local day (`?date=`): a "Showing {date}" bar with a
// clear link back to every date, then that single day (never folded into "Past").
function DateFiltered({
  days,
  date,
  locale,
  view,
  clearHref,
}: {
  days: DayGroup[];
  date: string;
  locale: Locale;
  view: EventsViewMode;
  clearHref: string;
}) {
  const t = getDictionary(locale).schedule;
  const label = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-2 ring-1 ring-border">
        <p className="font-display text-sm font-semibold uppercase tracking-wide text-navy">
          {t.dateShowing.replace("{date}", label)}
        </p>
        <Link
          href={clearHref}
          data-testid="events-date-clear"
          scroll={false}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-display text-sm font-semibold text-navy underline-offset-4 outline-focus hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X aria-hidden="true" className="size-4" />
          {t.dateClear}
        </Link>
      </div>
      {days.length === 0 ? <Empty text={t.emptyDate} /> : null}
      {days.map((day) => (
        <Day key={day.date} day={day} locale={locale} view={view} testId="events-day" />
      ))}
    </>
  );
}
