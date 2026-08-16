import { listEvents, splitEventsByDate, todayISO } from "@/lib/events";
import { EventsDirectory } from "@/components/ui/events-directory";

// DELIVER (events-web-001): the public events directory, from the REAL Supabase read via
// lib/events (RLS publishable client), split into Upcoming vs Past by end_date relative to
// the current date. force-dynamic: reads Supabase AND uses the request-time date (a build
// snapshot would go stale). Server Component; roots at <section>s.
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await listEvents();
  const { upcoming, past } = splitEventsByDate(events, todayISO(new Date()));

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
          Events
        </h1>
        <p className="max-w-3xl text-lg text-muted">
          Tournaments and events of the USVI Softball Federation.
        </p>
      </div>

      {upcoming.length > 0 || past.length > 0 ? (
        <EventsDirectory upcoming={upcoming} past={past} />
      ) : (
        <p data-testid="events-empty" className="text-muted">
          Events will be listed here soon.
        </p>
      )}
    </section>
  );
}
