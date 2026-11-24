// Feature softball/scoreboard — pure helpers. Scenarios: docs/features/softball/scoreboard/scenarios.md.
import { describe, expect, it } from "vitest";
import { gameRunTotals, gameWinner } from "@/lib/schedule-view";

describe("scoreboard-unit-001: run totals prefer the line score, else the stored result", () => {
  it("derives runs from innings when the game has any (stored totals ignored)", () => {
    const g = {
      innings: [
        { inning: 1, side: "away" as const, runs: 2 },
        { inning: 1, side: "home" as const, runs: 1 },
      ],
      awayRuns: 9,
      homeRuns: 9,
    };
    expect(gameRunTotals(g)).toEqual({ away: 2, home: 1 });
  });

  it("uses the total-only result when there are no innings", () => {
    expect(gameRunTotals({ innings: [], awayRuns: 5, homeRuns: 8 })).toEqual({ away: 5, home: 8 });
  });

  it("is 0–0 with neither (a pregame game) and picks the winner of a total-only final", () => {
    expect(gameRunTotals({ innings: [] })).toEqual({ away: 0, home: 0 });
    const t = gameRunTotals({ innings: [], awayRuns: 5, homeRuns: 8 });
    expect(gameWinner({ state: "final" }, t)).toBe("home");
  });
});
