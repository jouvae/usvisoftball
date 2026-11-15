import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/schedule";
import { getLocale } from "@/lib/i18n/server";
import { EVENTS_ENABLED } from "@/lib/flags";
import { EventSheet } from "@/components/client/event-sheet";

// D7: an in-site (soft) navigation to /events/[slug] from any public page is intercepted into
// the (public) layout's @modal slot — the URL becomes /events/{slug} while the page underneath
// stays rendered; the event opens as a modal (≥ md) / bottom drawer (< md). A direct load or a
// refresh is NOT intercepted and renders the full page (app/(public)/events/[slug]/page.tsx).
export const dynamic = "force-dynamic";

export default async function EventModal({ params }: PageProps<"/events/[slug]">) {
  if (!EVENTS_ENABLED) notFound();
  const { slug } = await params;
  const [event, locale] = await Promise.all([getEventBySlug(slug), getLocale()]);
  if (!event) notFound();
  return <EventSheet event={event} locale={locale} />;
}
