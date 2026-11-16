/*
---
id: schedule-web-022
name: "schedule-web-022: ?view=calendar month grid + the list's ?date= day filter"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S5
references:
  - app/(public)/events/page.tsx (?view=calendar, ?month=, ?date=)
  - components/ui/events-view.tsx (switcher link events-view-calendar, events-date-clear)
  - lib/schedule-view.ts (calendarMonthGrid, defaultCalendarMonth, localDateKey)
  - lib/i18n/ (es month names, Monday week start)
  - tests/support/schedule-fixtures.ts (firstUpcomingLocalDate)
---

## Given
The schedule fixtures: 2099-03-14 has 2 events (ceremony + CO–MX, no USVI); 2099-03-15 has 3 USVI
games (America/El_Salvador venue-local days). Real Pan Am rows may also render.

## When
A visitor opens the Calendar view (`events-view-calendar` → `?view=calendar`), pages months with
`calendar-prev`/`calendar-next` (`?month=YYYY-MM`), and follows a day's link; and separately loads
`/events?view=list&date=YYYY-MM-DD`.

## Then
`events-calendar` renders a `calendar-month-heading` (localized month + year) and a full grid of
`calendar-day[data-date]` cells — whole weeks incl. leading/trailing days, starting Sunday (en) /
Monday (es). With no `month` the month shown is the month of the first upcoming event. Days with
events show `calendar-day-count` and link to `?view=list&date=YYYY-MM-DD`; days with a USVI game
are `data-usvi="true"`. The list `date` filter shows only that venue-local day (one `events-day`)
plus `events-date-clear`, a link back to the unfiltered list. `/es/events?view=calendar` names the
month in Spanish.
*/

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  SFX_EVENTS,
  cleanupScheduleFixtures,
  firstUpcomingLocalDate,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

function cell(page: Page, date: string): Locator {
  return page.getByTestId("calendar-day").and(page.locator(`[data-date="${date}"]`));
}

function monthLabel(month: string, locale: "en" | "es"): { name: string; year: string } {
  const [y, m] = month.split("-").map(Number);
  const name = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
  return { name, year: String(y) };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
}

async function cellDates(page: Page): Promise<string[]> {
  return page
    .getByTestId("calendar-day")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-date") ?? ""));
}

async function goto(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res, `no response for ${path}`).not.toBeNull();
  expect(res!.status()).toBe(200);
}

// The whole grid: contiguous days, whole weeks, starting on `weekStart`, covering the month.
function expectFullGrid(dates: string[], month: string, weekStart: 0 | 1) {
  expect(dates.length % 7, `cell count ${dates.length} not whole weeks`).toBe(0);
  expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), `bad data-date in ${dates}`).toBe(true);
  for (let i = 1; i < dates.length; i++) expect(dates[i]).toBe(addDays(dates[i - 1], 1));
  expect(weekday(dates[0]), "first cell weekday").toBe(weekStart);
  expect(weekday(dates[dates.length - 1]), "last cell weekday").toBe((weekStart + 6) % 7);
  const first = `${month}-01`;
  expect(dates).toContain(first);
  expect(dates.indexOf(first), "no full leading week").toBeLessThan(7);
  const inMonth = dates.filter((d) => d.startsWith(month));
  const [y, m] = month.split("-").map(Number);
  expect(inMonth.length).toBe(new Date(Date.UTC(y, m, 0)).getUTCDate());
  expect(dates.length - 1 - dates.lastIndexOf(inMonth[inMonth.length - 1])).toBeLessThan(7);
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-022 — calendar view + list date filter", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("the switcher's Calendar link opens the month of the first upcoming event", async ({
    page,
  }) => {
    const first = await firstUpcomingLocalDate();
    expect(first, "fixtures guarantee at least one upcoming event").not.toBeNull();
    const month = first!.slice(0, 7);

    await goto(page, "/events");
    await page.getByTestId("events-view-switcher").getByTestId("events-view-calendar").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("calendar");
    await expect(page.getByTestId("events-view-calendar")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("events-calendar")).toBeVisible();
    await expect(page.getByTestId("event-row")).toHaveCount(0);

    const { name, year } = monthLabel(month, "en");
    const heading = page.getByTestId("calendar-month-heading");
    await expect(heading).toContainText(name);
    await expect(heading).toContainText(year);
    await expect(cell(page, first!)).toHaveCount(1);
  });

  test("?month= renders the full Sunday-first grid with localized heading (en)", async ({
    page,
  }) => {
    await goto(page, "/events?view=calendar&month=2099-03");
    await expect(page.getByTestId("calendar-month-heading")).toContainText("March 2099");
    const dates = await cellDates(page);
    expectFullGrid(dates, "2099-03", 0);
    // 2099-03-01 is a Sunday → no leading days; 03-31 is a Tuesday → trailing through 04-04.
    expect(dates[0]).toBe("2099-03-01");
    expect(dates[dates.length - 1]).toBe("2099-04-04");
  });

  test("days with events show a count, link to the list for that date, and flag USVI", async ({
    page,
  }) => {
    await goto(page, "/events?view=calendar&month=2099-03");

    const d14 = cell(page, "2099-03-14");
    const d15 = cell(page, "2099-03-15");
    await expect(d14.getByTestId("calendar-day-count")).toContainText("2");
    await expect(d15.getByTestId("calendar-day-count")).toContainText("3");
    await expect(d15).toHaveAttribute("data-usvi", "true");
    await expect(d14).not.toHaveAttribute("data-usvi", "true");
    // A day with no events has no count and no day link.
    await expect(cell(page, "2099-03-10").getByTestId("calendar-day-count")).toHaveCount(0);

    for (const date of ["2099-03-14", "2099-03-15"]) {
      const link = cell(page, date).locator(`a[href*="date=${date}"]`);
      await expect(link, `day link for ${date}`).toHaveCount(1);
      const href = new URL((await link.getAttribute("href"))!, "http://x");
      expect(href.pathname).toBe("/events");
      expect(href.searchParams.get("view")).toBe("list");
      expect(href.searchParams.get("date")).toBe(date);
    }

    await cell(page, "2099-03-15").locator('a[href*="date=2099-03-15"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe("2099-03-15");
    await expect(page.getByTestId("events-day")).toHaveCount(1);
    await expect(page.getByTestId("events-day")).toHaveAttribute("data-date", "2099-03-15");
  });

  test("calendar-prev / calendar-next page months via ?month=", async ({ page }) => {
    await goto(page, "/events?view=calendar&month=2099-03");

    for (const [id, month] of [
      ["calendar-next", "2099-04"],
      ["calendar-prev", "2099-02"],
    ] as const) {
      const href = new URL((await page.getByTestId(id).getAttribute("href"))!, "http://x");
      expect(href.searchParams.get("view"), id).toBe("calendar");
      expect(href.searchParams.get("month"), id).toBe(month);
    }

    await page.getByTestId("calendar-next").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2099-04");
    await expect(page.getByTestId("calendar-month-heading")).toContainText("April 2099");
    await expect(cell(page, "2099-04-15")).toHaveCount(1);

    await page.getByTestId("calendar-prev").click();
    await page.getByTestId("calendar-prev").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2099-02");
    await expect(page.getByTestId("calendar-month-heading")).toContainText("February 2099");
  });

  test("Spanish: month heading in Spanish and weeks start on Monday", async ({ page }) => {
    await goto(page, "/es/events?view=calendar&month=2099-03");
    const heading = page.getByTestId("calendar-month-heading");
    await expect(heading).toContainText("marzo");
    await expect(heading).toContainText("2099");
    await expect(heading).not.toContainText("March");

    const dates = await cellDates(page);
    expectFullGrid(dates, "2099-03", 1);
    expect(dates[0]).toBe("2099-02-23");
    expect(dates[dates.length - 1]).toBe("2099-04-05");

    // Day links stay under /es.
    const href = new URL(
      (await cell(page, "2099-03-15").locator('a[href*="date=2099-03-15"]').getAttribute("href"))!,
      "http://x",
    );
    expect(href.pathname).toBe("/es/events");
  });

  test("Spanish: the default month heading is the first upcoming event's month in Spanish", async ({
    page,
  }) => {
    const first = await firstUpcomingLocalDate();
    expect(first).not.toBeNull();
    const { name, year } = monthLabel(first!.slice(0, 7), "es");
    await goto(page, "/es/events?view=calendar");
    const heading = page.getByTestId("calendar-month-heading");
    await expect(heading).toContainText(name);
    await expect(heading).toContainText(year);
  });

  test("list ?date= shows only that venue-local day, with a clear link back", async ({ page }) => {
    await goto(page, "/events?view=list&date=2099-03-14");

    const days = page.getByTestId("events-day");
    await expect(days).toHaveCount(1);
    await expect(days).toHaveAttribute("data-date", "2099-03-14");
    await expect(page.getByTestId("events-past-day")).toHaveCount(0);

    // Venue-local grouping: both 03-14 events (which start 03-15 UTC) are shown, no 03-15 event.
    for (const ev of Object.values(SFX_EVENTS)) {
      await expect(
        page.getByTestId("event-row").and(page.locator(`[data-slug="${ev.slug}"]`)),
        ev.slug,
      ).toHaveCount(ev.localDate === "2099-03-14" ? 1 : 0);
    }

    const clear = page.getByTestId("events-date-clear");
    await expect(clear).toBeVisible();
    const href = new URL((await clear.getAttribute("href"))!, "http://x");
    expect(href.pathname).toBe("/events");
    expect(href.searchParams.get("date")).toBeNull();

    await clear.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBeNull();
    await expect(page.getByTestId("events-date-clear")).toHaveCount(0);
    await expect(
      page.getByTestId("events-day").and(page.locator('[data-date="2099-03-15"]')),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("events-day").and(page.locator('[data-date="2099-03-14"]')),
    ).toHaveCount(1);
  });
});
