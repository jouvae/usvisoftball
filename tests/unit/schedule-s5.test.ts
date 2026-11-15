// Feature softball/schedule — slice S5 unit tests (scenarios schedule-unit-011 … 014): the pure
// helpers behind the Timeline (schedule-web-021) and Calendar (schedule-web-022) views.
// Spec: docs/features/softball/schedule/scenarios.md §S5, overview.md §5.
// Contracts (new exports in lib/schedule-view.ts):
//   calendarMonthGrid(year, month /* 1–12 */, weekStartsOn: 0 | 1): string[][]
//   timelineRange(events, timeZone): { startHour, endHour }
//   timelinePosition(iso, range, timeZone): number in [0, 1]
//   defaultCalendarMonth(events, nowIso, timeZone): "YYYY-MM"

import { describe, expect, it } from "vitest";
import {
  calendarMonthGrid,
  defaultCalendarMonth,
  timelinePosition,
  timelineRange,
} from "@/lib/schedule-view";

const SV_TZ = "America/El_Salvador"; // UTC−6, no DST
const flat = (weeks: string[][]) => weeks.flat();
const ev = (startsAt: string, endsAt: string | null = null) => ({ startsAt, endsAt });

// schedule-unit-011
describe("calendarMonthGrid — whole weeks of ISO dates incl. leading/trailing days", () => {
  it("2099-03, Sunday start: Mar 1 is a Sunday → 5 weeks, Mar 1 … Apr 4", () => {
    const weeks = calendarMonthGrid(2099, 3, 0);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([
      "2099-03-01", "2099-03-02", "2099-03-03", "2099-03-04",
      "2099-03-05", "2099-03-06", "2099-03-07",
    ]);
    expect(weeks[4][6]).toBe("2099-04-04");
  });

  it("2099-03, Monday start: leading Feb 23 … trailing Apr 5 → 6 weeks", () => {
    const weeks = calendarMonthGrid(2099, 3, 1);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toBe("2099-02-23");
    expect(weeks[0][6]).toBe("2099-03-01");
    expect(weeks[5][6]).toBe("2099-04-05");
  });

  it("2026-11 (Pan Am month): en 5 weeks Nov 1 … Dec 5; es 6 weeks Oct 26 … Dec 6", () => {
    const en = flat(calendarMonthGrid(2026, 11, 0));
    expect(en[0]).toBe("2026-11-01");
    expect(en.at(-1)).toBe("2026-12-05");
    expect(en).toHaveLength(35);
    const es = flat(calendarMonthGrid(2026, 11, 1));
    expect(es[0]).toBe("2026-10-26");
    expect(es.at(-1)).toBe("2026-12-06");
    expect(es).toHaveLength(42);
  });

  it("a month that fits exactly has no leading/trailing days (Feb 2026 Sun-start, Feb 2027 Mon-start)", () => {
    const a = flat(calendarMonthGrid(2026, 2, 0));
    expect(a).toHaveLength(28);
    expect([a[0], a.at(-1)]).toEqual(["2026-02-01", "2026-02-28"]);
    const b = flat(calendarMonthGrid(2027, 2, 1));
    expect(b).toHaveLength(28);
    expect([b[0], b.at(-1)]).toEqual(["2027-02-01", "2027-02-28"]);
  });

  it("dates are contiguous, cover every day of the month, and handle leap years", () => {
    const days = flat(calendarMonthGrid(2028, 2, 0));
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T12:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() + 1);
      expect(days[i]).toBe(prev.toISOString().slice(0, 10));
    }
    expect(days.filter((d) => d.startsWith("2028-02"))).toHaveLength(29);
    expect(days).toContain("2028-02-29");
  });

  it("year boundaries roll over (Dec 2026 → Jan 2027 trailing days)", () => {
    const days = flat(calendarMonthGrid(2026, 12, 0));
    expect(days[0]).toBe("2026-11-29");
    expect(days.at(-1)).toBe("2027-01-02");
  });
});

// schedule-unit-012
describe("timelineRange — venue-local hour window padded to whole hours", () => {
  it("floors the earliest start and pads the last start by the 2-hour default duration", () => {
    // Fixture 2099-03-15: 09:00, 12:00, 15:00 local → 9 … 17.
    expect(
      timelineRange(
        [ev("2099-03-15T15:00:00Z"), ev("2099-03-15T18:00:00Z"), ev("2099-03-15T21:00:00Z")],
        SV_TZ,
      ),
    ).toEqual({ startHour: 9, endHour: 17 });
  });

  it("partial hours round outward: 18:30 + 19:00 local → 18 … 21", () => {
    expect(
      timelineRange([ev("2099-03-15T00:30:00Z"), ev("2099-03-15T01:00:00Z")], SV_TZ),
    ).toEqual({ startHour: 18, endHour: 21 });
  });

  it("an explicit endsAt is used instead of the default duration (ceil to the hour)", () => {
    // 09:00 → 22:15 local
    expect(
      timelineRange([ev("2099-03-15T15:00:00Z", "2099-03-16T04:15:00Z")], SV_TZ),
    ).toEqual({ startHour: 9, endHour: 23 });
  });

  it("is computed in the given zone, not UTC, and caps at 24", () => {
    // 21:00 and 23:00 El Salvador (= 03:00 / 05:00 UTC next day).
    expect(
      timelineRange([ev("2026-11-22T03:00:00Z"), ev("2026-11-22T05:00:00Z")], SV_TZ),
    ).toEqual({ startHour: 21, endHour: 24 });
  });

  it("is order-independent", () => {
    const a = [ev("2099-03-15T21:00:00Z"), ev("2099-03-15T15:00:00Z")];
    expect(timelineRange(a, SV_TZ)).toEqual(timelineRange([...a].reverse(), SV_TZ));
  });
});

// schedule-unit-013
describe("timelinePosition — fraction 0..1 of a venue-local time within the range", () => {
  const range = { startHour: 9, endHour: 17 };

  it("maps the range edges to 0 and 1 and interpolates linearly", () => {
    expect(timelinePosition("2099-03-15T15:00:00Z", range, SV_TZ)).toBe(0); // 09:00
    expect(timelinePosition("2099-03-15T19:00:00Z", range, SV_TZ)).toBe(0.5); // 13:00
    expect(timelinePosition("2099-03-15T23:00:00Z", range, SV_TZ)).toBe(1); // 17:00
    expect(timelinePosition("2099-03-15T18:00:00Z", range, SV_TZ)).toBeCloseTo(3 / 8); // 12:00
    expect(timelinePosition("2099-03-15T18:30:00Z", range, SV_TZ)).toBeCloseTo(3.5 / 8); // 12:30
  });

  it("clamps times outside the range", () => {
    expect(timelinePosition("2099-03-15T14:00:00Z", range, SV_TZ)).toBe(0); // 08:00
    expect(timelinePosition("2099-03-16T01:00:00Z", range, SV_TZ)).toBe(1); // 19:00
  });

  it("preserves start order (left→right placement)", () => {
    const r = { startHour: 18, endHour: 21 };
    const cer = timelinePosition("2099-03-15T00:30:00Z", r, SV_TZ); // 18:30
    const fin = timelinePosition("2099-03-15T01:00:00Z", r, SV_TZ); // 19:00
    expect(cer).toBeCloseTo(0.5 / 3);
    expect(fin).toBeCloseTo(1 / 3);
    expect(cer).toBeLessThan(fin);
  });
});

// schedule-unit-014
describe("defaultCalendarMonth — month of the first upcoming event (venue-local)", () => {
  const panAm = [
    { startsAt: "2026-11-21T00:30:00Z" }, // Nov 20 18:30 local
    { startsAt: "2026-11-23T18:00:00Z" },
    { startsAt: "2099-03-15T15:00:00Z" },
  ];

  it("before the tournament → the first event's month", () => {
    expect(defaultCalendarMonth(panAm, "2026-11-15T12:00:00Z", SV_TZ)).toBe("2026-11");
  });

  it("uses the venue-local date: an event at 00:30Z on Dec 1 is Nov 30 local", () => {
    const evs = [{ startsAt: "2026-12-01T00:30:00Z" }];
    expect(defaultCalendarMonth(evs, "2026-11-15T12:00:00Z", SV_TZ)).toBe("2026-11");
  });

  it("an event earlier today (venue-local) still counts as upcoming", () => {
    // now = Nov 23 22:00 local; the 12:00 local game that day is still "today".
    expect(defaultCalendarMonth(panAm, "2026-11-24T04:00:00Z", SV_TZ)).toBe("2026-11");
  });

  it("skips past events → the next upcoming event's month", () => {
    expect(defaultCalendarMonth(panAm, "2026-12-01T12:00:00Z", SV_TZ)).toBe("2099-03");
  });

  it("is order-independent", () => {
    expect(defaultCalendarMonth([...panAm].reverse(), "2026-11-15T12:00:00Z", SV_TZ)).toBe(
      "2026-11",
    );
  });

  it("no upcoming events → the month of the latest event", () => {
    expect(defaultCalendarMonth(panAm.slice(0, 2), "2027-05-01T12:00:00Z", SV_TZ)).toBe("2026-11");
  });

  it("no events at all → the current venue-local month", () => {
    expect(defaultCalendarMonth([], "2027-05-01T03:00:00Z", SV_TZ)).toBe("2027-04");
  });
});
