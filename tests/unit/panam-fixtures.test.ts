// Feature softball/schedule — slice S1: the Pan Am seed's pure helpers + data shape
// (supports scenario schedule-db-002).
import { describe, expect, it } from "vitest";
import {
  PANAM_GAMES,
  PANAM_GUEST_COUNTRIES,
  localToUtcIso,
} from "@/lib/seed/panam-fixtures";

describe("schedule-db-002 support: venue-local → UTC", () => {
  it("El Salvador (UTC−6, no DST)", () => {
    expect(localToUtcIso("2026-11-21", "15:00", "America/El_Salvador")).toBe("2026-11-21T21:00:00.000Z");
    expect(localToUtcIso("2026-11-22", "21:00", "America/El_Salvador")).toBe("2026-11-23T03:00:00.000Z");
    expect(localToUtcIso("2026-11-20", "18:30", "America/El_Salvador")).toBe("2026-11-21T00:30:00.000Z");
  });

  it("Atlantic (UTC−4) and a DST zone", () => {
    expect(localToUtcIso("2026-11-21", "17:00", "America/St_Thomas")).toBe("2026-11-21T21:00:00.000Z");
    expect(localToUtcIso("2026-07-04", "12:00", "America/New_York")).toBe("2026-07-04T16:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => localToUtcIso("2026-11-21", "3pm", "America/El_Salvador")).toThrow();
  });
});

describe("schedule-db-002 support: fixture shape", () => {
  it("32 games, 18 distinct teams, USVI plays 3", () => {
    expect(PANAM_GAMES).toHaveLength(32);
    const teams = new Set(PANAM_GAMES.flatMap((g) => [g.away, g.home]));
    expect(teams.size).toBe(18);
    expect(new Set([...PANAM_GUEST_COUNTRIES, "VI"])).toEqual(teams);
    expect(PANAM_GAMES.filter((g) => g.away === "VI" || g.home === "VI")).toHaveLength(3);
  });
});
