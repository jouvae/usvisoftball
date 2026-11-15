import type { NextRequest } from "next/server";
import { getEventBySlug, eventDisplayTitle } from "@/lib/schedule";
import { buildEventIcs } from "@/lib/ics";
import { localizePath } from "@/lib/i18n/locale";
import { SITE_URL } from "@/lib/site";
import { EVENTS_ENABLED } from "@/lib/flags";

// "Add to calendar" (overview §5): one event as an iCalendar file (UTC DTSTART/DTEND, 2 h
// default length). `?lang=es` localizes the summary + URL (the proxy skips paths with an
// extension, so the Spanish page links here with a query instead of an /es prefix).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext<"/events/[slug]/calendar.ics">) {
  if (!EVENTS_ENABLED) return new Response("Not found", { status: 404 });
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) return new Response("Not found", { status: 404 });

  const locale = request.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
  const t = event.tournamentDetail;
  const tournamentName = t ? (locale === "es" && t.nameEs ? t.nameEs : t.name) : "";
  const title = eventDisplayTitle(event, locale);
  const body = buildEventIcs({
    uid: `${event.slug}@usvisoftball.org`,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    summary: tournamentName ? `${title} · ${tournamentName}` : title,
    location: [event.venue, t?.city].filter(Boolean).join(", "),
    url: `${SITE_URL}${localizePath(locale, `/events/${event.slug}`)}`,
    description: tournamentName,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
