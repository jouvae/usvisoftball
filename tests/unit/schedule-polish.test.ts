// Feature softball/schedule — polish pass (status.md "Polish backlog", 2026-11-15).
// Pure helpers behind: status chips (no chip for pregame, score on Final), "local" time-zone
// wording, the OG share image's time line, and the scorekeeper stat-sheet field order.
// Whitespace is normalized because ICU may emit U+202F/U+2009.

import { describe, expect, it } from "vitest";
import {
  ATLANTIC_TZ,
  localTimeCaption,
  ogWhenLine,
  venueZoneLabel,
  type GameWithTeams,
  type ScheduleTeam,
} from "@/lib/schedule-view";
import { BATTING_FIELDS } from "@/lib/scoring-view";
import { eventState } from "@/components/ui/event-state-chip";

const SV_TZ = "America/El_Salvador";
const T = "2026-11-21T21:00:00Z"; // 3:00 PM El Salvador, 5:00 PM Atlantic
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
const CO = team({ id: "co", countryCode: "CO" });
const MX = team({ id: "mx", countryCode: "MX" });

function game(o: Partial<GameWithTeams> = {}): GameWithTeams {
  return {
    id: "g",
    eventId: "e",
    awayTeamId: CO.id,
    homeTeamId: MX.id,
    state: "pregame",
    currentInning: null,
    awayHits: 0,
    awayErrors: 0,
    homeHits: 0,
    homeErrors: 0,
    away: CO,
    home: MX,
    innings: [],
    ...o,
  };
}

describe("polish: status chips", () => {
  it("pregame is the 'upcoming' tone (rendered visually hidden), label kept for a11y", () => {
    const s = eventState({ status: "scheduled", game: game() }, "en");
    expect(s.tone).toBe("upcoming");
    expect(s.label).toBe("Upcoming");
  });

  it("final carries the score, away–home: 'Final · 3–1'", () => {
    const g = game({
      state: "final",
      innings: [
        { inning: 1, side: "away", runs: 3 },
        { inning: 1, side: "home", runs: 1 },
      ],
    });
    expect(eventState({ status: "scheduled", game: g }, "en")).toEqual({
      label: "Final · 3–1",
      tone: "final",
    });
    expect(eventState({ status: "scheduled", game: g }, "es").label).toBe("Final · 3–1");
  });

  it("live / postponed / cancelled keep their chips", () => {
    expect(eventState({ status: "scheduled", game: game({ state: "live", currentInning: 4 }) }, "en"))
      .toEqual({ label: "Live · Inning 4", tone: "live" });
    expect(eventState({ status: "postponed", game: game() }, "en").tone).toBe("alert");
    expect(eventState({ status: "cancelled", game: null }, "es").label).toBe("Cancelado");
  });
});

describe("polish: time-zone wording", () => {
  it("venue-local times say 'local' instead of a bare abbreviation (CST reads as US Central)", () => {
    expect(venueZoneLabel(SV_TZ, "en")).toBe("local");
    expect(venueZoneLabel(SV_TZ, "es")).toBe("local");
  });

  it("Atlantic (USVI) times keep AST", () => {
    expect(venueZoneLabel(ATLANTIC_TZ, "en")).toBe("AST");
    expect(venueZoneLabel(ATLANTIC_TZ, "es")).toBe("AST"); // not Intl's "GMT-4"
  });

  it("detail caption names the venue country: 'Local time · El Salvador' / 'Hora local · El Salvador'", () => {
    expect(localTimeCaption(SV_TZ, "SV", "en")).toBe("Local time · El Salvador");
    expect(localTimeCaption(SV_TZ, "SV", "es")).toBe("Hora local · El Salvador");
    expect(localTimeCaption(SV_TZ, null, "en")).toBe("Local time");
  });

  it("an Atlantic venue's caption is 'AST · USVI time' / 'AST · hora de USVI'", () => {
    expect(localTimeCaption(ATLANTIC_TZ, "VI", "en")).toBe("AST · USVI time");
    expect(localTimeCaption(ATLANTIC_TZ, "VI", "es")).toBe("AST · hora de USVI");
  });
});

describe("polish: OG share image time line", () => {
  it("shows venue-local time AND Atlantic time", () => {
    expect(norm(ogWhenLine(T, SV_TZ))).toBe("Saturday, November 21 · 3:00 PM local · 5:00 PM AST");
  });

  it("an Atlantic venue shows its time once, with AST", () => {
    expect(norm(ogWhenLine(T, ATLANTIC_TZ))).toBe("Saturday, November 21 · 5:00 PM AST");
  });
});

describe("polish: scorekeeper stat sheet order", () => {
  it("AB, H, R, RBI, BB, SO, then 2B, 3B, HR, SB", () => {
    expect(BATTING_FIELDS.map((f) => f.key)).toEqual([
      "ab", "h", "r", "rbi", "bb", "so", "doubles", "triples", "hr", "sb",
    ]);
  });
});
