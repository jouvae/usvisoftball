// Feature softball/schedule — the 2026 Central American and Caribbean Games (Santo Domingo)
// results seed (scenario schedule-db-003). The fixture is transcribed from the WBSC Americas
// daily report NR. 6; these checks pin it to the report's own totals so a transcription slip
// fails here, not on the public site.
import { describe, expect, it } from "vitest";
import { validateStatLine } from "@/lib/schedule-view";
import {
  CACG_GAMES,
  CACG_GUEST_COUNTRIES,
  CACG_TOURNAMENT,
  CACG_USVI_ROSTER,
} from "@/lib/seed/cacg-fixtures";
import { localToUtcIso } from "@/lib/seed/panam-fixtures";

const played = CACG_GAMES.filter((g) => g.result);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const usviLines = played.flatMap((g) => g.usvi);

describe("schedule-db-003 support: CAC Games fixture shape", () => {
  it("22 games, 8 teams, 20 with results; medal games pending", () => {
    expect(CACG_GAMES).toHaveLength(22);
    expect(played).toHaveLength(20);
    const teams = new Set(CACG_GAMES.flatMap((g) => [g.away, g.home]));
    expect(teams).toEqual(new Set([...CACG_GUEST_COUNTRIES, "VI"]));
    expect(teams.size).toBe(8);
    const medal = CACG_GAMES.filter((g) => !g.result);
    expect(medal.map((g) => [g.no, g.round, g.away, g.home])).toEqual([
      [21, "bronze", "MX", "DO"],
      [22, "gold", "VI", "PR"],
    ]);
  });

  it("USVI plays 6 games (5 with results), every one with a box score", () => {
    const usvi = CACG_GAMES.filter((g) => g.away === "VI" || g.home === "VI");
    expect(usvi.map((g) => g.no)).toEqual([2, 5, 9, 15, 20, 22]);
    for (const g of usvi.filter((x) => x.result)) expect(g.usvi.length).toBeGreaterThan(0);
    for (const g of CACG_GAMES.filter((x) => x.away !== "VI" && x.home !== "VI")) {
      expect(g.usvi).toEqual([]);
    }
  });

  it("Santo Domingo is UTC−4: game 1 at 12:00 local = 16:00Z", () => {
    expect(CACG_TOURNAMENT.timezone).toBe("America/Santo_Domingo");
    const g1 = CACG_GAMES[0];
    expect(localToUtcIso(g1.date, g1.time, CACG_TOURNAMENT.timezone)).toBe("2026-07-26T16:00:00.000Z");
  });
});

describe("schedule-db-003 support: matches the report's totals", () => {
  it("line scores: 200 runs and 279 hits in games 1–20 (team stats page)", () => {
    const runs = sum(played.map((g) => sum(g.result!.awayInnings) + sum(g.result!.homeInnings)));
    const hits = sum(played.map((g) => g.result!.awayHits + g.result!.homeHits));
    expect(runs).toBe(200);
    expect(hits).toBe(279);
  });

  it("schedule page scores (e.g. game 15 USVI 9 – Puerto Rico 10 in 8)", () => {
    const g15 = CACG_GAMES.find((g) => g.no === 15)!.result!;
    expect([sum(g15.awayInnings), sum(g15.homeInnings), g15.awayInnings.length]).toEqual([9, 10, 8]);
  });

  it("USVI box scores sum to the team page: AB 144, R 47, H 59, RBI 41, 30⅓ IP", () => {
    expect(sum(usviLines.map((l) => l.ab))).toBe(144);
    expect(sum(usviLines.map((l) => l.r))).toBe(47);
    expect(sum(usviLines.map((l) => l.h))).toBe(59);
    expect(sum(usviLines.map((l) => l.rbi))).toBe(41);
    expect(sum(usviLines.map((l) => l.hr))).toBe(5);
    expect(sum(usviLines.map((l) => l.pitching?.outsPitched ?? 0))).toBe(91);
  });

  it("each USVI game's batting runs/hits equal its line score", () => {
    for (const g of played.filter((x) => x.usvi.length)) {
      const side = g.away === "VI" ? "away" : "home";
      const r = g.result!;
      expect(sum(g.usvi.map((l) => l.r))).toBe(sum(side === "away" ? r.awayInnings : r.homeInnings));
      expect(sum(g.usvi.map((l) => l.h))).toBe(side === "away" ? r.awayHits : r.homeHits);
    }
  });

  it("leaders: Legette 12-for-19, 11 RBI; Hastings 6 SB", () => {
    const of = (name: string) => usviLines.filter((l) => l.player === name);
    expect(sum(of("Emily Legette").map((l) => l.h))).toBe(12);
    expect(sum(of("Emily Legette").map((l) => l.ab))).toBe(19);
    expect(sum(of("Emily Legette").map((l) => l.rbi))).toBe(11);
    expect(sum(of("Alexis Hastings").map((l) => l.sb))).toBe(6);
  });

  it("every USVI line is valid and names a rostered player", () => {
    const names = new Set(CACG_USVI_ROSTER.map((p) => p.name));
    for (const l of usviLines) {
      expect(validateStatLine(l)).toEqual({ ok: true });
      expect(names.has(l.player)).toBe(true);
    }
  });

  it("roster: 15 players, unique names and jersey numbers", () => {
    expect(CACG_USVI_ROSTER).toHaveLength(15);
    expect(new Set(CACG_USVI_ROSTER.map((p) => p.name)).size).toBe(15);
    expect(new Set(CACG_USVI_ROSTER.map((p) => p.jersey)).size).toBe(15);
  });
});
