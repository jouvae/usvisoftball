import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEventBySlug } from "@/lib/schedule";
import { eventJsonLd, eventMetaDescription, eventMetaTitle, serializeJsonLd } from "@/lib/schedule-seo";
import { alternatesFor, getLocale, getT } from "@/lib/i18n/server";
import { localizePath } from "@/lib/i18n/locale";
import { SITE_URL } from "@/lib/site";
import { EVENTS_ENABLED } from "@/lib/flags";
import { EventDetail } from "@/components/ui/event-detail";
import { LiveRefresh } from "@/components/client/live-refresh";

// One event's full page (D7) — what a direct load, a refresh, a shared link or a crawler gets.
// In-site clicks are intercepted into the @modal slot instead. Same EventDetail component,
// presentation "page". Emits one SportsEvent JSON-LD (D8); the OG image is the colocated
// opengraph-image.tsx. Unknown slug → 404. force-dynamic: reads Supabase per request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/events/[slug]">): Promise<Metadata> {
  if (!EVENTS_ENABLED) return {};
  const { slug } = await params;
  const [event, locale] = await Promise.all([getEventBySlug(slug), getLocale()]);
  if (!event) return {};
  const title = eventMetaTitle(event, locale);
  const description = eventMetaDescription(event, locale);
  const alternates = await alternatesFor(`/events/${slug}`);
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "website",
      title,
      description,
      url: localizePath(locale, `/events/${slug}`),
      siteName: "USVI Softball Federation",
      locale: locale === "es" ? "es_ES" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  if (!EVENTS_ENABLED) notFound(); // dormant for MVP launch
  const { slug } = await params;
  const [event, locale, dict] = await Promise.all([getEventBySlug(slug), getLocale(), getT()]);
  if (!event) notFound();

  const path = localizePath(locale, `/events/${slug}`);
  const jsonLd = eventJsonLd(event, { locale, url: `${SITE_URL}${path}`, siteUrl: SITE_URL });

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <script
        type="application/ld+json"
        // Safe: serializeJsonLd escapes `<`, so no value can close the script element.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Link
        href={localizePath(locale, "/events")}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-brand underline-offset-4 outline-focus hover:text-brand-hover hover:underline focus-visible:outline-2"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {dict.schedule.allEvents}
      </Link>
      <EventDetail event={event} locale={locale} presentation="page" />
      <LiveRefresh active={event.game?.state === "live"} />
    </section>
  );
}
