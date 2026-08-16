import {
  type FederationEvent,
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
} from "@/lib/events-view";

// One group (Upcoming / Past) of event cards. All fields React-escaped. Empty group → the
// caller omits it. Each card: name, date range, venue (+ island), description.
function EventGroup({
  title,
  events,
  testId,
}: {
  title: string;
  events: FederationEvent[];
  testId: string;
}) {
  if (events.length === 0) return null;
  return (
    <div data-testid={testId} className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
        {title}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => {
          const dates = formatEventDateRange(ev.startDate, ev.endDate);
          const island = ev.island ? EVENT_ISLAND_LABELS[ev.island] : "";
          return (
            <article
              key={ev.id}
              data-testid="event-card"
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-5"
            >
              <h3
                data-testid="event-name"
                className="font-display text-xl font-bold leading-tight tracking-tight text-brand"
              >
                {ev.name}
              </h3>
              {dates ? (
                <p
                  data-testid="event-dates"
                  className="text-sm font-semibold uppercase tracking-wide text-muted"
                >
                  {dates}
                </p>
              ) : null}
              {ev.venue || island ? (
                <p data-testid="event-venue" className="text-sm text-foreground">
                  {[ev.venue, island].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {ev.description ? (
                <p
                  data-testid="event-description"
                  className="text-sm text-foreground"
                >
                  {ev.description}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// The public events directory on /events (events-web-001). Server Component. Renders an
// Upcoming group then a Past group; each is omitted when empty.
export function EventsDirectory({
  upcoming,
  past,
  testId = "events-directory",
}: {
  upcoming: FederationEvent[];
  past: FederationEvent[];
  testId?: string;
}) {
  if (upcoming.length === 0 && past.length === 0) return null;
  return (
    <section data-testid={testId} className="flex flex-col gap-12">
      <EventGroup title="Upcoming" events={upcoming} testId="events-upcoming" />
      <EventGroup title="Past Events" events={past} testId="events-past" />
    </section>
  );
}
