import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { USVI_COUNTRY, hasLiveGame, listEvents } from "@/lib/schedule";
import { alternatesFor, getLocale, getT } from "@/lib/i18n/server";
import { EVENTS_ENABLED } from "@/lib/flags";
import { EventsView, parseEventsParams } from "@/components/ui/events-view";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { LiveRefresh } from "@/components/client/live-refresh";

// The schedule hub (overview §5): every calendar event (upcoming + past) from the 0026 tables,
// grouped day → venue like the flyer. `?view=` picks List / Cards / Timeline / Calendar;
// `?team=usvi` keeps only USVI games; `?date=` (one venue-local day) and `?month=` (calendar).
// force-dynamic: reads Supabase per request and depends on today's date.
export const dynamic = "force-dynamic";

// Localized page (served at /events and /es/events): title, description, hreflang alternates.
export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT()).schedule;
  return {
    title: t.eventsMetaTitle,
    description: t.eventsIntro,
    alternates: await alternatesFor("/events"),
  };
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  if (!EVENTS_ENABLED) notFound(); // dormant for MVP launch
  const { view, usviOnly, date, month } = parseEventsParams(await searchParams);
  const [events, locale, dict] = await Promise.all([
    listEvents(usviOnly ? { teamCountry: USVI_COUNTRY } : {}),
    getLocale(),
    getT(),
  ]);
  const t = dict.schedule;

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <AccentRule />
          <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-navy sm:text-5xl">
            {t.eventsTitle}
          </h1>
        </div>
        <p data-testid="events-intro" className="max-w-3xl text-lg text-muted">
          {t.eventsIntro}
        </p>
      </div>

      <EventsView
        events={events}
        locale={locale}
        path="/events"
        view={view}
        usviOnly={usviOnly}
        date={date}
        month={month}
        now={new Date()}
      />
      <LiveRefresh active={hasLiveGame(events)} />
    </section>
  );
}
