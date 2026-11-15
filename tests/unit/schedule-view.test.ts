// Feature softball/schedule — slice S1 unit tests (scenarios schedule-unit-001 … 009).
// Spec: docs/features/softball/schedule/scenarios.md §S1, overview.md.
// Pure helpers in lib/schedule-view.ts. Intl-formatted expectations were verified against
// Node's ICU in this environment; whitespace is normalized because ICU may emit U+202F/U+00A0.

import { describe, expect, it } from "vitest";
import {
  ATLANTIC_TZ,
  SOFTBALL_INNINGS,
  battingAverage,
  countryName,
  era,
  eventDisplayTitle,
  eventSlug,
  flagEmoji,
  formatEventDate,
  formatEventTime,
  formatInningsPitched,
  gameWinner,
  isUsviGame,
  isUsviTeam,
  lineScoreInningCount,
  localDateKey,
  onBasePct,
  runTotals,
  slugify,
  teamDisplayName,
  timeZoneLabel,
  tournamentWindow,
  validateStatLine,
  type EventWithGame,
  type GameWithTeams,
  type Inning,
  type ScheduleTeam,
  type StatLineInput,
} from "@/lib/schedule-view";

const SV_TZ = "America/El_Salvador";
const DASH = "–"; // U+2013 en dash — the "no value" placeholder
const norm = (s: string) => s.replace(/\s/g, " ");

function team(overrides: Partial<ScheduleTeam>): ScheduleTeam {
  return {
    id: "t",
    name: "Team",
    slug: "team",
    kind: "guest",
    shortName: "",
    countryCode: null,
    division: "",
    logoUrl: "",
    ...overrides,
  };
}

const USVI = team({ id: "vi", name: "USVI U18 Women", kind: "national", countryCode: "VI" });
const COLOMBIA = team({ id: "co", name: "Colombia", kind: "guest", countryCode: "CO" });
const DOMINICAN = team({ id: "do", name: "Dominican Republic", kind: "guest", countryCode: "DO" });

function gameWithTeams(away: ScheduleTeam, home: ScheduleTeam): GameWithTeams {
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
  };
}

const VALID_LINE: StatLineInput = {
  ab: 4,
  r: 1,
  h: 2,
  doubles: 1,
  triples: 0,
  hr: 1,
  rbi: 2,
  bb: 1,
  so: 1,
  sb: 0,
  pitching: { outsPitched: 9, h: 3, r: 2, er: 1, bb: 1, so: 4 },
};

// ── schedule-unit-001 ────────────────────────────────────────────────────────────
describe("schedule-unit-001: run totals are derived from innings", () => {
  it("schedule-unit-001: sums runs per side", () => {
    const innings: Inning[] = [
      { inning: 1, side: "away", runs: 2 },
      { inning: 1, side: "home", runs: 0 },
      { inning: 2, side: "away", runs: 1 },
    ];
    expect(runTotals(innings)).toEqual({ away: 3, home: 0 });
  });

  it("schedule-unit-001: no innings → both 0", () => {
    expect(runTotals([])).toEqual({ away: 0, home: 0 });
  });

  it("schedule-unit-001: line score shows at least the 7 regulation innings", () => {
    expect(SOFTBALL_INNINGS).toBe(7);
    expect(lineScoreInningCount([], null)).toBe(7);
    expect(lineScoreInningCount([{ inning: 3, side: "away", runs: 1 }], 3)).toBe(7);
  });

  it("schedule-unit-001: line score extends for extra innings (cells or current inning)", () => {
    expect(lineScoreInningCount([{ inning: 9, side: "home", runs: 1 }], null)).toBe(9);
    expect(lineScoreInningCount([{ inning: 7, side: "away", runs: 0 }], 8)).toBe(8);
  });

  it("schedule-unit-001: gameWinner — only a final game has a winner", () => {
    expect(gameWinner({ state: "final" }, { away: 3, home: 0 })).toBe("away");
    expect(gameWinner({ state: "final" }, { away: 1, home: 4 })).toBe("home");
  });

  it("schedule-unit-001: gameWinner — null on a tie or when not final", () => {
    expect(gameWinner({ state: "final" }, { away: 2, home: 2 })).toBeNull();
    expect(gameWinner({ state: "live" }, { away: 5, home: 0 })).toBeNull();
    expect(gameWinner({ state: "pregame" }, { away: 0, home: 0 })).toBeNull();
  });
});

// ── schedule-unit-002 ────────────────────────────────────────────────────────────
describe("schedule-unit-002: tournament window (D2)", () => {
  const noAnnounced = { announcedStart: null, announcedEnd: null };
  const announced = { announcedStart: "2026-11-20", announcedEnd: "2026-11-23" };

  it("schedule-unit-002: events → first start to latest coalesce(ends_at, starts_at)", () => {
    const w = tournamentWindow(
      [
        { startsAt: "2026-11-24T03:00:00Z", endsAt: "2026-11-24T05:00:00Z" },
        { startsAt: "2026-11-21T00:30:00Z", endsAt: null },
      ],
      noAnnounced,
    );
    expect(w).not.toBeNull();
    expect(w!.source).toBe("events");
    expect(Date.parse(w!.start)).toBe(Date.parse("2026-11-21T00:30:00Z"));
    expect(Date.parse(w!.end)).toBe(Date.parse("2026-11-24T05:00:00Z"));
  });

  it("schedule-unit-002: end falls back to the latest start when no event has ends_at", () => {
    const w = tournamentWindow(
      [
        { startsAt: "2026-11-21T00:30:00Z", endsAt: null },
        { startsAt: "2026-11-24T03:00:00Z", endsAt: null },
      ],
      noAnnounced,
    );
    expect(w!.source).toBe("events");
    expect(Date.parse(w!.end)).toBe(Date.parse("2026-11-24T03:00:00Z"));
  });

  it("schedule-unit-002: events win over announced dates", () => {
    const w = tournamentWindow([{ startsAt: "2026-11-21T00:30:00Z", endsAt: null }], announced);
    expect(w!.source).toBe("events");
    expect(Date.parse(w!.start)).toBe(Date.parse("2026-11-21T00:30:00Z"));
  });

  it("schedule-unit-002: no events → announced dates", () => {
    expect(tournamentWindow([], announced)).toEqual({
      start: "2026-11-20",
      end: "2026-11-23",
      source: "announced",
    });
  });

  it("schedule-unit-002: neither → null (Dates to be announced)", () => {
    expect(tournamentWindow([], noAnnounced)).toBeNull();
  });
});

// ── schedule-unit-003 ────────────────────────────────────────────────────────────
describe("schedule-unit-003: localized team names", () => {
  it("schedule-unit-003: countryName VI en/es", () => {
    expect(countryName("VI", "en")).toBe("U.S. Virgin Islands");
    expect(countryName("VI", "es")).toBe("Islas Vírgenes de EE. UU.");
  });

  it("schedule-unit-003: countryName DO en/es", () => {
    expect(countryName("DO", "en")).toBe("Dominican Republic");
    expect(countryName("DO", "es")).toBe("República Dominicana");
  });

  it("schedule-unit-003: national team with a country → localized country name", () => {
    expect(teamDisplayName(USVI, "en")).toBe("U.S. Virgin Islands");
    expect(teamDisplayName(USVI, "es")).toBe("Islas Vírgenes de EE. UU.");
  });

  it("schedule-unit-003: guest team with a country → localized country name", () => {
    expect(teamDisplayName(DOMINICAN, "es")).toBe("República Dominicana");
  });

  it("schedule-unit-003: club with no country → its name", () => {
    const club = team({ name: "St. Croix Sluggers", kind: "club", countryCode: null });
    expect(teamDisplayName(club, "en")).toBe("St. Croix Sluggers");
    expect(teamDisplayName(club, "es")).toBe("St. Croix Sluggers");
  });

  it("schedule-unit-003: club keeps its name even with a country", () => {
    const club = team({ name: "St. Thomas Stars", kind: "club", countryCode: "VI" });
    expect(teamDisplayName(club, "es")).toBe("St. Thomas Stars");
  });

  it("schedule-unit-003: game title is '{away} vs {home}' in the locale", () => {
    const ev: Pick<EventWithGame, "type" | "title" | "titleEs" | "game"> = {
      type: "game",
      title: "",
      titleEs: "",
      game: gameWithTeams(DOMINICAN, USVI),
    };
    expect(eventDisplayTitle(ev, "en")).toBe("Dominican Republic vs U.S. Virgin Islands");
    expect(eventDisplayTitle(ev, "es")).toBe("República Dominicana vs Islas Vírgenes de EE. UU.");
  });

  it("schedule-unit-003: non-game title uses titleEs in es, falling back to title", () => {
    const withEs = { type: "ceremony" as const, title: "Opening Ceremony", titleEs: "Ceremonia de Apertura", game: null };
    expect(eventDisplayTitle(withEs, "en")).toBe("Opening Ceremony");
    expect(eventDisplayTitle(withEs, "es")).toBe("Ceremonia de Apertura");
    expect(eventDisplayTitle({ ...withEs, titleEs: "" }, "es")).toBe("Opening Ceremony");
  });
});

// ── schedule-unit-004 ────────────────────────────────────────────────────────────
describe("schedule-unit-004: times and dates are zone-explicit", () => {
  const T = "2026-11-21T21:00:00Z";

  it("schedule-unit-004: venue-local time (El Salvador) en", () => {
    expect(norm(formatEventTime(T, SV_TZ, "en"))).toBe("3:00 PM");
  });

  it("schedule-unit-004: venue-local time (El Salvador) es — 12-hour, Intl 'p. m.'", () => {
    // Intl 'es' defaults to 24h ("15:00"); the scenario requires the 12-hour form.
    expect(norm(formatEventTime(T, SV_TZ, "es"))).toBe("3:00 p. m.");
  });

  it("schedule-unit-004: Atlantic time (USVI)", () => {
    expect(ATLANTIC_TZ).toBe("America/St_Thomas");
    expect(norm(formatEventTime(T, ATLANTIC_TZ, "en"))).toBe("5:00 PM");
    expect(norm(formatEventTime(T, ATLANTIC_TZ, "es"))).toBe("5:00 p. m.");
  });

  it("schedule-unit-004: date label en/es", () => {
    expect(norm(formatEventDate(T, SV_TZ, "en"))).toBe("Saturday, November 21");
    expect(norm(formatEventDate(T, SV_TZ, "es"))).toBe("sábado, 21 de noviembre");
  });

  it("schedule-unit-004: date label uses the zone's calendar day", () => {
    // 03:00Z on the 23rd is still the evening of the 22nd in El Salvador (UTC−6).
    expect(norm(formatEventDate("2026-11-23T03:00:00Z", SV_TZ, "en"))).toBe("Sunday, November 22");
  });

  it("schedule-unit-004: labels name their zone", () => {
    expect(timeZoneLabel(T, ATLANTIC_TZ, "en")).toBe("AST");
    expect(timeZoneLabel(T, SV_TZ, "en")).toBe("CST");
    expect(timeZoneLabel(T, ATLANTIC_TZ, "es").trim()).not.toBe("");
  });

  it("schedule-unit-004: localDateKey is the venue-local calendar date", () => {
    expect(localDateKey("2026-11-23T03:00:00Z", SV_TZ)).toBe("2026-11-22");
    expect(localDateKey(T, SV_TZ)).toBe("2026-11-21");
    expect(localDateKey("2026-11-23T03:00:00Z", ATLANTIC_TZ)).toBe("2026-11-22");
    expect(localDateKey("2026-11-23T05:00:00Z", ATLANTIC_TZ)).toBe("2026-11-23");
  });
});

// ── schedule-unit-005 ────────────────────────────────────────────────────────────
describe("schedule-unit-005: innings pitched from outs", () => {
  it.each([
    [14, "4⅔"],
    [0, "0"],
    [3, "1"],
    [10, "3⅓"],
    [1, "⅓"],
    [21, "7"],
  ])("schedule-unit-005: %i outs → %s", (outs, expected) => {
    expect(formatInningsPitched(outs)).toBe(expected);
  });
});

// ── schedule-unit-006 ────────────────────────────────────────────────────────────
describe("schedule-unit-006: rate stats", () => {
  it("schedule-unit-006: AVG = H/AB as .333", () => {
    expect(battingAverage({ ab: 3, h: 1 })).toBe(".333");
    expect(battingAverage({ ab: 4, h: 0 })).toBe(".000");
    expect(battingAverage({ ab: 3, h: 3 })).toBe("1.000");
  });

  it("schedule-unit-006: AVG is '–' when AB is 0", () => {
    expect(battingAverage({ ab: 0, h: 0 })).toBe(DASH);
  });

  it("schedule-unit-006: OBP = (H+BB)/(AB+BB)", () => {
    expect(onBasePct({ ab: 4, h: 1, bb: 1 })).toBe(".400");
  });

  it("schedule-unit-006: OBP is '–' when AB+BB is 0", () => {
    expect(onBasePct({ ab: 0, h: 0, bb: 0 })).toBe(DASH);
  });

  it("schedule-unit-006: OBP with walks only (AB 0)", () => {
    expect(onBasePct({ ab: 0, h: 0, bb: 2 })).toBe("1.000");
  });

  it("schedule-unit-006: ERA = ER × 7 / IP", () => {
    expect(era({ outsPitched: 9, er: 1 })).toBe("2.33"); // 1 × 7 / 3
    expect(era({ outsPitched: 21, er: 0 })).toBe("0.00");
    expect(era({ outsPitched: 14, er: 2 })).toBe("3.00"); // 2 × 7 / (14/3)
  });

  it("schedule-unit-006: ERA is '–' when 0 outs", () => {
    expect(era({ outsPitched: 0, er: 0 })).toBe(DASH);
    expect(era({ outsPitched: 0, er: 3 })).toBe(DASH);
  });
});

// ── schedule-unit-007 ────────────────────────────────────────────────────────────
describe("schedule-unit-007: slugs", () => {
  it("schedule-unit-007: game slug from English country names + venue-local date", () => {
    expect(
      eventSlug({ type: "game", awayCountryCode: "CO", homeCountryCode: "VI", localDate: "2026-11-21" }),
    ).toBe("colombia-vs-us-virgin-islands-2026-11-21");
  });

  it("schedule-unit-007: game slug is English regardless of accents/spaces", () => {
    expect(
      eventSlug({ type: "game", awayCountryCode: "DO", homeCountryCode: "SV", localDate: "2026-11-22" }),
    ).toBe("dominican-republic-vs-el-salvador-2026-11-22");
  });

  it("schedule-unit-007: ceremony slug = tournament slug + title", () => {
    expect(eventSlug({ type: "ceremony", tournamentSlug: "t", title: "Opening Ceremony" })).toBe(
      "t-opening-ceremony",
    );
  });

  it("schedule-unit-007: ceremony without a tournament → title slug only", () => {
    expect(eventSlug({ type: "other", tournamentSlug: null, title: "Team Meeting" })).toBe("team-meeting");
  });

  it("schedule-unit-007: slugify lowercases, strips accents, collapses separators", () => {
    expect(slugify("Opening Ceremony")).toBe("opening-ceremony");
    expect(slugify("República Dominicana")).toBe("republica-dominicana");
    expect(slugify("  Islas Vírgenes de EE. UU.  ")).toBe("islas-virgenes-de-ee-uu");
  });
});

// ── schedule-unit-008 ────────────────────────────────────────────────────────────
describe("schedule-unit-008: stat line validation", () => {
  function expectRejected(line: StatLineInput, field?: string) {
    const v = validateStatLine(line);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.message.trim().length).toBeGreaterThan(0);
    expect(v.message).toMatch(/\s/); // plain-language sentence, not a bare code
    if (field) expect(v.field).toBe(field);
  }

  it("schedule-unit-008: a valid line passes", () => {
    expect(validateStatLine(VALID_LINE)).toEqual({ ok: true });
  });

  it("schedule-unit-008: a valid non-pitcher line passes", () => {
    expect(validateStatLine({ ...VALID_LINE, pitching: null })).toEqual({ ok: true });
  });

  it("schedule-unit-008: H > AB rejected", () => {
    expectRejected({ ...VALID_LINE, ab: 1, h: 2, doubles: 0, hr: 0 }, "h");
  });

  it("schedule-unit-008: 2B+3B+HR > H rejected", () => {
    expectRejected({ ...VALID_LINE, h: 2, doubles: 1, triples: 1, hr: 1 });
  });

  it("schedule-unit-008: pitching ER > R rejected", () => {
    expectRejected(
      { ...VALID_LINE, pitching: { ...VALID_LINE.pitching!, r: 1, er: 2 } },
      "pitching.er",
    );
  });

  it("schedule-unit-008: negative batting value rejected", () => {
    expectRejected({ ...VALID_LINE, bb: -1 }, "bb");
  });

  it("schedule-unit-008: negative pitching value rejected", () => {
    expectRejected(
      { ...VALID_LINE, pitching: { ...VALID_LINE.pitching!, outsPitched: -3 } },
      "pitching.outsPitched",
    );
  });
});

// ── schedule-unit-009 ────────────────────────────────────────────────────────────
describe("schedule-unit-009: flags and USVI detection", () => {
  it("schedule-unit-009: VI → 🇻🇮", () => {
    expect(flagEmoji("VI")).toBe("\u{1F1FB}\u{1F1EE}");
    expect(flagEmoji("CO")).toBe("\u{1F1E8}\u{1F1F4}");
  });

  it.each([[""], ["V"], ["VIR"], ["1A"], ["V!"], [null], [undefined]])(
    "schedule-unit-009: invalid code %j → ''",
    (code) => {
      expect(flagEmoji(code as string | null | undefined)).toBe("");
    },
  );

  it("schedule-unit-009: isUsviTeam", () => {
    expect(isUsviTeam(USVI)).toBe(true);
    expect(isUsviTeam(COLOMBIA)).toBe(false);
    expect(isUsviTeam(team({ countryCode: null }))).toBe(false);
  });

  it("schedule-unit-009: isUsviGame — either side is USVI", () => {
    expect(isUsviGame(gameWithTeams(COLOMBIA, USVI))).toBe(true);
    expect(isUsviGame(gameWithTeams(USVI, DOMINICAN))).toBe(true);
    expect(isUsviGame(gameWithTeams(COLOMBIA, DOMINICAN))).toBe(false);
    expect(isUsviGame(null)).toBe(false);
  });
});
