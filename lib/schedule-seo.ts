// Feature softball/schedule — SEO builders for event pages (D8). Pure, client-safe.
//
// eventJsonLd(): one schema.org SportsEvent per game page (ceremonies → `Event`), the shape
// Google's sports results read. serializeJsonLd(): JSON for a <script type="application/ld+json">
// with `<` escaped so a team/venue name can never close the script element.
// eventMetaTitle()/eventMetaDescription(): the localized <title> / description.

import {
  countryName,
  eventDisplayTitle,
  formatEventDate,
  formatEventTime,
  formatShortDate,
  isoWithOffset,
  gameRunTotals,
  teamDisplayName,
  venueZoneLabel,
  type EventStatus,
  type EventWithGame,
  type Locale,
  type Tournament,
} from "@/lib/schedule-view";

export const ORGANIZER_NAME = "U.S. Virgin Islands Softball Federation";

type SeoEvent = EventWithGame & {
  tournamentDetail?: Pick<Tournament, "name" | "nameEs" | "city" | "countryCode"> | null;
};

const STATUS_URL: Record<EventStatus, string> = {
  scheduled: "https://schema.org/EventScheduled",
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
};

function tournamentName(event: SeoEvent, locale: Locale): string {
  const t = event.tournamentDetail ?? event.tournament;
  if (!t) return "";
  return locale === "es" && t.nameEs ? t.nameEs : t.name;
}

// "Final: Colombia 3, Mexico 1" once a game is final; '' otherwise.
function finalScoreLine(event: SeoEvent, locale: Locale): string {
  const g = event.game;
  if (!g || g.state !== "final") return "";
  const r = gameRunTotals(g);
  return `Final: ${teamDisplayName(g.away, locale)} ${r.away}, ${teamDisplayName(g.home, locale)} ${r.home}`;
}

// Localized page title: "Colombia vs U.S. Virgin Islands — Nov 21, 2026 · 2026 U18 Women's Pan Am".
export function eventMetaTitle(event: SeoEvent, locale: Locale): string {
  const base = `${eventDisplayTitle(event, locale)} — ${formatShortDate(event.startsAt, event.timezone, locale)}`;
  const t = tournamentName(event, locale);
  return t ? `${base} · ${t}` : base;
}

// Localized description: when (venue-local, zone-labelled) + where, plus the final score.
export function eventMetaDescription(event: SeoEvent, locale: Locale): string {
  const when = `${formatEventDate(event.startsAt, event.timezone, locale)}, ${formatEventTime(
    event.startsAt,
    event.timezone,
    locale,
  )} ${venueZoneLabel(event.timezone, locale)}`;
  const parts = [`${eventDisplayTitle(event, locale)}. ${when} · ${event.venue}.`];
  const t = tournamentName(event, locale);
  if (t) parts.push(`${t}.`);
  const score = finalScoreLine(event, locale);
  if (score) parts.push(`${score}.`);
  return parts.join(" ");
}

// schema.org SportsEvent (games) / Event (ceremonies, other) for one event page.
export function eventJsonLd(
  event: SeoEvent,
  opts: { locale: Locale; url: string; siteUrl: string },
): Record<string, unknown> {
  const { locale } = opts;
  const t = event.tournamentDetail ?? null;
  const address = [t?.city, t?.countryCode ? countryName(t.countryCode, locale) : ""]
    .filter(Boolean)
    .join(", ");
  const score = finalScoreLine(event, locale);
  const description = [eventDisplayTitle(event, locale), tournamentName(event, locale), score]
    .filter(Boolean)
    .join(" · ");
  const superName = tournamentName(event, locale);

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": event.type === "game" && event.game ? "SportsEvent" : "Event",
    name: eventDisplayTitle(event, locale),
    description,
    url: opts.url,
    startDate: isoWithOffset(event.startsAt, event.timezone),
    ...(event.endsAt ? { endDate: isoWithOffset(event.endsAt, event.timezone) } : {}),
    eventStatus: STATUS_URL[event.status],
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue,
      ...(address ? { address } : {}),
    },
    organizer: { "@type": "Organization", name: ORGANIZER_NAME, url: opts.siteUrl },
    ...(superName ? { superEvent: { "@type": "SportsEvent", name: superName } } : {}),
  };
  if (event.type === "game" && event.game) {
    node.sport = "Softball";
    node.awayTeam = { "@type": "SportsTeam", name: teamDisplayName(event.game.away, locale) };
    node.homeTeam = { "@type": "SportsTeam", name: teamDisplayName(event.game.home, locale) };
    node.competitor = [node.awayTeam, node.homeTeam];
  }
  return node;
}

// JSON for an inline ld+json script: `<` → < so no value can terminate the element.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
