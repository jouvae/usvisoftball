import Link from "next/link";
import { ChevronDown, LayoutGrid, List, MapPin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  formatEventDate,
  groupEventsByDay,
  type DayGroup,
  type EventWithGame,
  type Locale,
} from "@/lib/schedule-view";
import { EventRow } from "@/components/ui/event-row";

export type EventsViewMode = "list" | "cards";

// The schedule hub (D12) — used by /events and /tournaments/[slug]. A List | Cards switcher
// and the "USVI games" toggle are plain links that drive `?view=` / `?team=usvi` (shareable,
// server-rendered, no client JS). Events group day → venue like the flyer: a navy bar per
// VENUE-LOCAL day, a gold venue label, then the rows (or cards) in start order. Past days fold
// into a "Past" disclosure below the upcoming ones. Isomorphic (no hooks).
export function EventsView({
  events,
  locale,
  path,
  view,
  usviOnly = false,
  showFilter = true,
  now,
  className = "",
}: {
  events: EventWithGame[];
  locale: Locale;
  path: string; // the internal (unprefixed) route these controls link to, e.g. "/events"
  view: EventsViewMode;
  usviOnly?: boolean;
  showFilter?: boolean;
  now: Date;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const { upcoming, past } = groupEventsByDay(events, now);

  const href = (next: { view: EventsViewMode; usvi: boolean }) => {
    const qs = new URLSearchParams();
    if (next.view === "cards") qs.set("view", "cards");
    if (next.usvi) qs.set("team", "usvi");
    const q = qs.toString();
    return localizePath(locale, path) + (q ? `?${q}` : "");
  };

  const control =
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 font-display text-sm font-semibold tracking-wide outline-focus transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div data-testid="events-view" data-view={view} className={`flex flex-col gap-8 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          data-testid="events-view-switcher"
          aria-label={t.viewLabel}
          className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-border"
        >
          {(
            [
              { mode: "list", label: t.viewList, Icon: List },
              { mode: "cards", label: t.viewCards, Icon: LayoutGrid },
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
                className={`${control} ${
                  active ? "bg-navy text-navy-foreground shadow-sm" : "text-navy hover:bg-white"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {showFilter ? (
          <Link
            href={href({ view, usvi: !usviOnly })}
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

      {upcoming.length === 0 && past.length === 0 ? (
        <p data-testid="events-empty" className="rounded-2xl bg-surface p-6 text-muted">
          {usviOnly ? t.emptyFiltered : t.empty}
        </p>
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
              <Day key={day.date} day={day} locale={locale} view={view} testId="events-past-day" />
            ))}
          </div>
        </details>
      ) : null}
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
