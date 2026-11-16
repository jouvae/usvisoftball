"use client";

import { useRouter } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { eventDisplayTitle, type EventDetail as EventDetailData, type Locale } from "@/lib/schedule-view";
import { EventDetail } from "@/components/ui/event-detail";
import { ResponsiveSheet } from "@/components/client/responsive-sheet";
import { LiveRefresh } from "@/components/client/live-refresh";

// The in-site event overlay (D7): the shared EventDetail inside the ResponsiveSheet — a modal at
// ≥ md, a bottom drawer below. Rendered by the intercepted @modal route, so the URL is already
// /events/{slug}; closing pops that history entry (router.back()), which restores the page
// underneath and keeps Back / Escape / close in agreement.
export function EventSheet({ event, locale }: { event: EventDetailData; locale: Locale }) {
  const router = useRouter();
  const t = getDictionary(locale).schedule;
  return (
    <ResponsiveSheet
      title={eventDisplayTitle(event, locale)}
      closeLabel={t.close}
      onClose={() => router.back()}
      modalTestId="event-modal"
      drawerTestId="event-drawer"
    >
      {(presentation) => (
        <>
          <EventDetail event={event} locale={locale} presentation={presentation} />
          <LiveRefresh active={event.game?.state === "live"} />
        </>
      )}
    </ResponsiveSheet>
  );
}
