// Feature softball/schedule — slice S3 unit tests: the pure helpers behind the public schedule.
// grouping day → venue (schedule-web-010), the tournament window label (018), the .ics builder
// (015), and the SEO builders (016). Whitespace is normalized because ICU may emit U+202F/U+2009.

import { describe, expect, it } from "vitest";
import {
  formatShortDate,
  formatTournamentWindow,
  googleMapsUrl,
  groupEventsByDay,
  hasLiveGame,
  isoWithOffset,
  type EventDetail,
  type EventWithGame,
  type GameWithTeams,
  type ScheduleTeam,
} from "@/lib/schedule-view";
import { buildEventIcs, icsEscape, icsFold, icsUtc } from "@/lib/ics";
import {
  eventJsonLd,
  eventMetaDescription,
  eventMetaTitle,
  serializeJsonLd,
} from "@/lib/schedule-seo";

const SV_TZ = "America/El_Salvador";
const norm = (s: string) => s.replace(/\s/g, " ");

function team(o: Partial<ScheduleTeam>): ScheduleTeam {
  return {
    id: "t",
    name: "Team",
    slug: "team",
    kind: "guest",
    shortName: "",
    countryCode: null,
    division: "",
    logoUrl: "",
    ...o,
  };
}
const USVI = team({ id: "vi", slug: "usvi", kind: "national", countryCode: "VI" });
const CO = team({ id: "co", slug: "co", countryCode: "CO" });
const MX = team({ id: "mx", slug: "mx", countryCode: "MX" });

function game(away: ScheduleTeam, home: ScheduleTeam, o: Partial<GameWithTeams> = {}): GameWithTeams {
  return {
    id: "g",
    eventId: "e",
    awayTeamId: away.id,
    homeTeamId: home.id,
    state: "pregame",
    currentInning: null,
    awayHits: 0,
    awayErrors: 0,
    homeHits: 0,
    homeErrors: 0,
    away,
    home,
    innings: [],
    ...o,
  };
}

let seq = 0;
function ev(startsAt: string, venue: string, o: Partial<EventWithGame> = {}): EventWithGame {
  seq += 1;
  return {
    id: `e${seq}`,
    tournamentId: "t1",
    type: "game",
    slug: `ev-${seq}`,
    title: "",
    titleEs: "",
    startsAt,
    endsAt: null,
    venue,
    round: "",
    status: "scheduled",
    streamUrl: null,
    sortOrder: 0,
    timezone: SV_TZ,
    tournament: { id: "t1", name: "Cup", nameEs: "Copa", slug: "cup" },
    game: game(CO, MX),
    ...o,
  };
}

describe("groupEventsByDay — flyer grouping (schedule-web-010)", () => {
  const now = new Date("2099-03-01T00:00:00Z");

  it("keys days by venue-local date, not UTC", () => {
    // 00:30Z on the 15th is 18:30 on the 14th in El Salvador (UTC−6).
    const late = ev("2099-03-15T00:30:00Z", "Alpha");
    const morning = ev("2099-03-15T15:00:00Z", "Alpha");
    const { upcoming, past } = groupEventsByDay([morning, late], now);
    expect(past).toEqual([]);
    expect(upcoming.map((d) => d.date)).toEqual(["2099-03-14", "2099-03-15"]);
    expect(upcoming[0].venues[0].events).toEqual([late]);
    expect(upcoming[0].firstStartsAt).toBe(late.startsAt);
  });

  it("orders venues by their earliest start and rows by start, then sort order", () => {
    const b1 = ev("2099-03-15T14:00:00Z", "Bravo");
    const a1 = ev("2099-03-15T15:00:00Z", "Alpha", { sortOrder: 2 });
    const a0 = ev("2099-03-15T15:00:00Z", "Alpha", { sortOrder: 1 });
    const b2 = ev("2099-03-15T21:00:00Z", "Bravo");
    const [day] = groupEventsByDay([b2, a1, b1, a0], now).upcoming;
    expect(day.venues.map((v) => v.venue)).toEqual(["Bravo", "Alpha"]);
    expect(day.venues[0].events).toEqual([b1, b2]);
    expect(day.venues[1].events).toEqual([a0, a1]);
  });

  it("splits past days (venue-local date before today) from upcoming, both ascending", () => {
    const old1 = ev("2099-02-10T15:00:00Z", "Alpha");
    const old2 = ev("2099-02-20T15:00:00Z", "Alpha");
    // 2099-03-01T03:00Z is still Feb 28 in El Salvador → a past day at `now`.
    const lastNight = ev("2099-03-01T03:00:00Z", "Alpha");
    // Today (venue-local Feb 28 at `now` = 2099-02-28T18:00 local) is upcoming.
    const today = ev("2099-02-28T23:00:00Z", "Alpha");
    const next = ev("2099-03-02T15:00:00Z", "Alpha");
    const { upcoming, past } = groupEventsByDay([next, old2, today, old1, lastNight], now);
    expect(past.map((d) => d.date)).toEqual(["2099-02-10", "2099-02-20"]);
    expect(upcoming.map((d) => d.date)).toEqual(["2099-02-28", "2099-03-02"]);
    expect(upcoming[0].venues[0].events).toEqual([today, lastNight]);
  });

  it("returns no groups for no events", () => {
    expect(groupEventsByDay([], now)).toEqual({ upcoming: [], past: [] });
  });
});

describe("date/time + link helpers", () => {
  it("formats the tournament window in its zone (schedule-web-018)", () => {
    const label = norm(
      formatTournamentWindow(
        { start: "2099-03-15T00:30:00Z", end: "2099-03-15T21:00:00Z", source: "events" },
        SV_TZ,
        "en",
      ),
    );
    expect(label).toMatch(/^Mar 14 – 15, 2099$/);
  });

  it("formats announced (date-only) windows without shifting the day", () => {
    const label = norm(
      formatTournamentWindow({ start: "2026-11-20", end: "2026-11-23", source: "announced" }, SV_TZ, "en"),
    );
    expect(label).toBe("Nov 20 – 23, 2026");
  });

  it("formats a short date in a zone", () => {
    expect(formatShortDate("2026-11-21T21:00:00Z", SV_TZ, "en")).toBe("Nov 21, 2026");
  });

  it("expresses an instant in a zone with its offset", () => {
    expect(isoWithOffset("2099-03-15T15:00:00Z", SV_TZ)).toBe("2099-03-15T09:00:00-06:00");
    expect(isoWithOffset("2099-03-15T15:00:00Z", "America/St_Thomas")).toBe(
      "2099-03-15T11:00:00-04:00",
    );
    expect(isoWithOffset("2099-03-15T15:00:00Z", "UTC")).toBe("2099-03-15T15:00:00Z");
    expect(Date.parse(isoWithOffset("2099-03-15T15:00:00Z", SV_TZ))).toBe(
      Date.parse("2099-03-15T15:00:00Z"),
    );
  });

  it("builds a Google Maps search URL", () => {
    expect(googleMapsUrl("Estadio Cuscatlán", "San Salvador")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Estadio%20Cuscatl%C3%A1n%2C%20San%20Salvador",
    );
  });

  it("detects a live game", () => {
    expect(hasLiveGame([ev("2099-03-15T15:00:00Z", "A")])).toBe(false);
    expect(hasLiveGame([ev("2099-03-15T15:00:00Z", "A", { game: game(CO, MX, { state: "live" }) })])).toBe(
      true,
    );
    expect(hasLiveGame([ev("2099-03-15T15:00:00Z", "A", { type: "ceremony", game: null })])).toBe(false);
  });
});

describe("buildEventIcs (schedule-web-015)", () => {
  const ics = buildEventIcs({
    uid: "co-vs-vi@usvisoftball.org",
    startsAt: "2099-03-15T15:00:00Z",
    endsAt: null,
    summary: "Colombia vs U.S. Virgin Islands",
    location: "Field Alpha, San Salvador",
    url: "https://usvisoftball.org/events/co-vs-vi",
    now: new Date("2099-01-01T00:00:00Z"),
  });

  it("is a CRLF VCALENDAR with one VEVENT in UTC, 2 h by default", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").filter((l) => l.includes("\n"))).toEqual([]);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    expect(ics).toContain("\r\nDTSTART:20990315T150000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20990315T170000Z\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20990101T000000Z\r\n");
    expect(ics).toContain("\r\nSUMMARY:Colombia vs U.S. Virgin Islands\r\n");
    expect(ics).toContain("\r\nLOCATION:Field Alpha\\, San Salvador\r\n");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("uses ends_at when present", () => {
    const withEnd = buildEventIcs({
      uid: "x",
      startsAt: "2099-03-15T15:00:00Z",
      endsAt: "2099-03-15T16:30:00Z",
      summary: "x",
      location: "",
      url: "https://x",
    });
    expect(withEnd).toContain("\r\nDTEND:20990315T163000Z\r\n");
  });

  it("escapes text and folds long lines at 75 octets", () => {
    expect(icsEscape("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    expect(icsUtc(new Date("2099-03-15T15:00:00.123Z"))).toBe("20990315T150000Z");
    const folded = icsFold(`SUMMARY:${"é".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("SEO builders (schedule-web-016)", () => {
  const detail: EventDetail = {
    ...ev("2026-11-21T21:00:00Z", "Estadio Cuscatlán", { game: game(CO, USVI) }),
    tournament: { id: "t1", name: "2026 U18 Women's Pan Am", nameEs: "Panam U18 2026", slug: "pa" },
    tournamentDetail: {
      id: "t1",
      name: "2026 U18 Women's Pan Am",
      nameEs: "Panam U18 2026",
      slug: "pa",
      description: "",
      descriptionEs: "",
      city: "San Salvador",
      countryCode: "SV",
      timezone: SV_TZ,
      logoUrl: "",
      coverImageUrl: "",
      streamUrl: null,
      announcedStart: null,
      announcedEnd: null,
      sortOrder: 0,
    },
    statLines: [],
    rosters: { away: [], home: [] },
  };

  it("emits a SportsEvent with offset startDate, teams, place, organizer, superEvent", () => {
    const ld = eventJsonLd(detail, {
      locale: "en",
      url: "https://usvisoftball.org/events/x",
      siteUrl: "https://usvisoftball.org",
    });
    expect(ld["@type"]).toBe("SportsEvent");
    expect(ld.startDate).toBe("2026-11-21T15:00:00-06:00");
    expect(ld).not.toHaveProperty("endDate");
    expect(ld.eventStatus).toBe("https://schema.org/EventScheduled");
    expect(ld.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(ld.awayTeam).toEqual({ "@type": "SportsTeam", name: "Colombia" });
    expect(ld.homeTeam).toEqual({ "@type": "SportsTeam", name: "U.S. Virgin Islands" });
    expect(ld.location).toEqual({
      "@type": "Place",
      name: "Estadio Cuscatlán",
      address: "San Salvador, El Salvador",
    });
    expect(ld.organizer).toEqual({
      "@type": "Organization",
      name: "U.S. Virgin Islands Softball Federation",
      url: "https://usvisoftball.org",
    });
    expect(ld.superEvent).toEqual({ "@type": "SportsEvent", name: "2026 U18 Women's Pan Am" });
    expect(ld.sport).toBe("Softball");
  });

  it("uses Event (no teams) for a ceremony and maps postponed/cancelled", () => {
    const ceremony = { ...detail, type: "ceremony" as const, title: "Opening", game: null, status: "postponed" as const };
    const ld = eventJsonLd(ceremony, { locale: "en", url: "u", siteUrl: "s" });
    expect(ld["@type"]).toBe("Event");
    expect(ld).not.toHaveProperty("homeTeam");
    expect(ld.eventStatus).toBe("https://schema.org/EventPostponed");
  });

  it("puts the final score in the description once final", () => {
    const final = {
      ...detail,
      game: game(CO, USVI, {
        state: "final",
        innings: [
          { inning: 1, side: "away", runs: 1 },
          { inning: 1, side: "home", runs: 4 },
        ],
      }),
    };
    expect(eventJsonLd(final, { locale: "en", url: "u", siteUrl: "s" }).description).toContain(
      "Final: Colombia 1, U.S. Virgin Islands 4",
    );
    expect(eventMetaDescription(final, "en")).toContain("Final: Colombia 1, U.S. Virgin Islands 4");
  });

  it("builds localized titles", () => {
    expect(eventMetaTitle(detail, "en")).toBe(
      "Colombia vs U.S. Virgin Islands — Nov 21, 2026 · 2026 U18 Women's Pan Am",
    );
    expect(eventMetaTitle(detail, "es")).toContain("Colombia vs Islas Vírgenes de EE. UU.");
    expect(eventMetaTitle(detail, "es")).toContain("Panam U18 2026");
  });

  it("serializes with `<` escaped so a value cannot close the script", () => {
    const s = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
