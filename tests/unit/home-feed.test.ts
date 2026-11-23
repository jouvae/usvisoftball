// Feature softball/home-feed — pure helpers behind the ESPN-style home feed (Phase A) and the
// Phase B fixes. Scenarios: docs/features/softball/home-feed/scenarios.md.
import { describe, expect, it } from "vitest";
import {
  decodeFeedCursor,
  encodeFeedCursor,
  finalHighlightLine,
  isAllowedHighlightLink,
  pickLead,
  relativeTimeLabel,
} from "@/lib/feed-view";
import { needsScore, type GameWithTeams, type ScheduleTeam } from "@/lib/schedule-view";
import { showBatsThrows } from "@/lib/teams-view";
import { eventState } from "@/components/ui/event-state-chip";

const ID = "3f2a3c1e-8a4b-4c55-9d2e-0b1c2d3e4f50";

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

function game(o: Partial<GameWithTeams> = {}): GameWithTeams {
  return {
    id: "g",
    eventId: "e",
    awayTeamId: "a",
    homeTeamId: "h",
    state: "pregame",
    currentInning: null,
    awayHits: 0,
    awayErrors: 0,
    homeHits: 0,
    homeErrors: 0,
    away: team({ id: "a", kind: "national", countryCode: "VI", name: "Women's National Team" }),
    home: team({ id: "h", countryCode: "PR", name: "Puerto Rico Women" }),
    innings: [],
    ...o,
  };
}

describe("home-feed-unit-001 feed cursor", () => {
  it("round-trips and rejects garbage", () => {
    const c = { publishedAt: "2026-08-14T16:00:00.000Z", id: ID };
    expect(decodeFeedCursor(encodeFeedCursor(c))).toEqual(c);
    expect(decodeFeedCursor("not-a-cursor")).toBeNull();
    expect(decodeFeedCursor(encodeFeedCursor({ publishedAt: "nope", id: ID }))).toBeNull();
    expect(decodeFeedCursor(encodeFeedCursor({ publishedAt: c.publishedAt, id: "1 or 1=1" }))).toBeNull();
    expect(decodeFeedCursor(null)).toBeNull();
  });
});

describe("home-feed-unit-002 lead pick", () => {
  const a = (id: string, isHighlight: boolean) => ({ id, isHighlight });
  it("newest featured story, else newest", () => {
    expect(pickLead([a("1", false), a("2", true), a("3", true)])?.id).toBe("2");
    expect(pickLead([a("1", false), a("2", false)])?.id).toBe("1");
    expect(pickLead([])).toBeNull();
  });
});

describe("home-feed-unit-003 final highlight line", () => {
  const innings = (away: number[], home: number[]) => [
    ...away.map((runs, i) => ({ inning: i + 1, side: "away" as const, runs })),
    ...home.map((runs, i) => ({ inning: i + 1, side: "home" as const, runs })),
  ];
  it("winner first, localized names, extra innings only when > 7", () => {
    const g = game({ state: "final", innings: innings([0, 0, 0, 0, 0, 4, 0, 5], [2, 0, 0, 4, 0, 0, 0, 4]) });
    expect(finalHighlightLine(g, "en")).toEqual({
      winner: "Puerto Rico",
      winnerRuns: 10,
      loser: "U.S. Virgin Islands",
      loserRuns: 9,
      innings: 8,
      usviWon: false,
    });
    expect(finalHighlightLine(g, "es").loser).toBe("Islas Vírgenes de EE. UU.");
    const reg = game({ state: "final", innings: innings([3, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0]) });
    expect(finalHighlightLine(reg, "en")).toMatchObject({ winner: "U.S. Virgin Islands", winnerRuns: 3, innings: null, usviWon: true });
  });
});

describe("home-feed-unit-004 relative time", () => {
  const now = new Date("2026-11-23T01:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  it("minutes, hours, then a short AST date", () => {
    expect(relativeTimeLabel(ago(40), now, "en")).toBe("40 minutes ago");
    expect(relativeTimeLabel(ago(40), now, "es")).toBe("hace 40 minutos");
    expect(relativeTimeLabel(ago(180), now, "en")).toBe("3 hours ago");
    expect(relativeTimeLabel(ago(180), now, "es")).toBe("hace 3 horas");
    expect(relativeTimeLabel("2026-11-21T22:00:00Z", now, "en")).toBe("Nov 21");
    expect(relativeTimeLabel("2026-11-21T22:00:00Z", now, "es")).toBe("21 nov");
    expect(relativeTimeLabel("2025-04-22T16:00:00Z", now, "en")).toBe("Apr 22, 2025");
  });
});

describe("home-feed-unit-005 highlight link", () => {
  it("https or a site path only", () => {
    expect(isAllowedHighlightLink("https://wbsc.org/x")).toBe(true);
    expect(isAllowedHighlightLink("/events/x")).toBe(true);
    for (const bad of ["//evil.com", "javascript:alert(1)", "http://x.org", "", "events/x"]) {
      expect(isAllowedHighlightLink(bad)).toBe(false);
    }
  });
});

describe("home-feed-unit-010 past pregame state", () => {
  const start = "2026-11-21T21:00:00Z";
  const ev = (o: object = {}) => ({ type: "game" as const, status: "scheduled" as const, game: game(), startsAt: start, endsAt: null, ...o });
  it("upcoming before start, in progress during the slot, score pending after", () => {
    expect(eventState(ev(), "en", new Date("2026-11-21T20:00:00Z")).tone).toBe("upcoming");
    expect(eventState(ev(), "en", new Date("2026-11-21T22:00:00Z"))).toEqual({ label: "In progress", tone: "pending" });
    expect(eventState(ev(), "es", new Date("2026-11-21T22:00:00Z")).label).toBe("En curso");
    expect(eventState(ev(), "en", new Date("2026-11-22T01:00:00Z"))).toEqual({ label: "Final · score pending", tone: "pending" });
    expect(eventState(ev(), "es", new Date("2026-11-22T01:00:00Z")).label).toBe("Final · resultado pendiente");
    // ends_at wins over the 3 h default
    expect(eventState(ev({ endsAt: "2026-11-21T22:30:00Z" }), "en", new Date("2026-11-21T23:00:00Z")).label).toBe("Final · score pending");
  });
  it("postponed still wins; a past ceremony is hidden as Past", () => {
    expect(eventState(ev({ status: "postponed" }), "en", new Date("2026-11-22T01:00:00Z")).tone).toBe("alert");
    expect(eventState({ type: "ceremony", status: "scheduled", game: null, startsAt: start, endsAt: null }, "en", new Date("2026-11-23T00:00:00Z")))
      .toEqual({ label: "Past", tone: "upcoming" });
  });
});

describe("home-feed-unit-011 needs score", () => {
  const ev = (state: GameWithTeams["state"]) => ({ type: "game" as const, status: "scheduled" as const, game: game({ state }), startsAt: "2026-11-21T21:00:00Z", endsAt: null });
  it("only an unfinished game whose slot has ended", () => {
    const after = new Date("2026-11-22T01:00:00Z");
    expect(needsScore(ev("pregame"), after)).toBe(true);
    expect(needsScore(ev("live"), after)).toBe(true);
    expect(needsScore(ev("final"), after)).toBe(false);
    expect(needsScore(ev("pregame"), new Date("2026-11-21T22:00:00Z"))).toBe(false);
  });
});

describe("home-feed-unit-012 roster columns", () => {
  it("hides B/T when nobody has it", () => {
    expect(showBatsThrows([{ batsThrows: "" }, { batsThrows: " " }])).toBe(false);
    expect(showBatsThrows([{ batsThrows: "" }, { batsThrows: "R/R" }])).toBe(true);
  });
});
