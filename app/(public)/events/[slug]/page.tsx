import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getEventBySlug,
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
  safeEventLogoHref,
} from "@/lib/events";
import { EVENTS_ENABLED } from "@/lib/flags";

// Event island labels reuse the shared taxonomy; team islands render the same way.
function islandLabel(island: string | null): string {
  if (!island) return "";
  return (EVENT_ISLAND_LABELS as Record<string, string>)[island] ?? "";
}

// DELIVER (events-web-002): one event's detail page — event info — from the REAL Supabase
// read via lib/events (RLS publishable client). `params` is a Promise in Next 16 and MUST
// be awaited. Unknown slug → notFound() (404). force-dynamic: reads Supabase; no
// generateStaticParams so specific slugs render on demand.
export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[slug]">) {
  if (!EVENTS_ENABLED) notFound(); // dormant for MVP launch
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const dates = formatEventDateRange(event.startDate, event.endDate);
  const island = event.island ? EVENT_ISLAND_LABELS[event.island] : "";
  const logo = safeEventLogoHref(event.logoUrl);

  return (
    <section
      data-testid="event-detail"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-12"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/events"
          className="w-fit text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          ← Events
        </Link>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={`${event.name} logo`}
            data-testid="event-detail-logo"
            className="h-24 w-24 rounded-md object-contain"
          />
        ) : null}
        <h1
          data-testid="event-detail-name"
          className="font-display text-4xl font-bold uppercase tracking-tight text-brand"
        >
          {event.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {dates ? (
            <span data-testid="event-detail-dates" className="font-semibold">
              {dates}
            </span>
          ) : null}
          {event.venue ? (
            <span data-testid="event-detail-venue">· {event.venue}</span>
          ) : null}
          {island ? (
            <span data-testid="event-detail-island">· {island}</span>
          ) : null}
        </div>
      </div>

      {event.description ? (
        <p
          data-testid="event-detail-description"
          className="max-w-3xl text-lg text-foreground"
        >
          {event.description}
        </p>
      ) : null}

      {event.teams.length > 0 ? (
        <section
          data-testid="event-participants"
          className="flex flex-col gap-4"
        >
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
            Participating Teams
          </h2>
          <ul role="list" className="flex flex-col gap-2">
            {event.teams.map((team) => (
              <li
                key={team.id}
                data-testid="event-participant"
                className="flex flex-wrap items-center gap-x-2 text-foreground"
              >
                <Link
                  href={`/teams/${team.slug}`}
                  data-testid="event-participant-name"
                  className="font-display text-lg font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline"
                >
                  {team.name}
                </Link>
                {islandLabel(team.island) ? (
                  <span className="text-sm text-muted">
                    · {islandLabel(team.island)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
