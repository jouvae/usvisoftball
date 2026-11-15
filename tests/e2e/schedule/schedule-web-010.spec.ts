/*
---
id: schedule-web-010
name: "schedule-web-010: /events list is grouped by day → venue, like the flyer"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S3
references:
  - app/(public)/events/page.tsx
  - components/ (EventsView, EventRow — shared with cards)
  - lib/schedule.ts (listEvents)
  - lib/schedule-view.ts (localDateKey, formatEventDate, formatEventTime, teamDisplayName)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures: tournament `e2e-cup` (America/El_Salvador) with a ceremony + 4 games on
two venue-local days (2099-03-14, 2099-03-15) at two venues (E2E Field Alpha, E2E Field Bravo).
Real Pan Am rows may also render; assertions are scoped to fixture `data-slug`s.

## When
An anonymous visitor opens `/events` (List is the default view).

## Then
`events-view` renders; `events-view-list` is the active view (aria-current="true"). Day groups
`events-day[data-date]` are in ascending date order and keyed by VENUE-LOCAL date (the ceremony +
CO–MX final start 2099-03-15 UTC but sit under 2099-03-14). Each day heading names the date.
Within 2099-03-15, venue groups appear Alpha then Bravo. Each fixture row is an
`<a href="/events/{slug}">` with time, away + home names (localized), state chip, and
`data-usvi` ("true" only for USVI games). The ceremony row shows its title, not teams.
*/

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  formatEventDate,
  formatEventTime,
  teamDisplayName,
} from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_EVENT_SLUGS,
  SFX_TEAMS,
  SFX_TZ,
  SFX_VENUES,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

function row(scope: Page | Locator, slug: string): Locator {
  return scope.locator(`[data-testid="event-row"][data-slug="${slug}"]`);
}

function day(page: Page, date: string): Locator {
  return page.locator(`[data-testid="events-day"][data-date="${date}"]`);
}

function venueGroup(dayLoc: Locator, venue: string): Locator {
  return dayLoc
    .getByTestId("events-venue")
    .filter({ has: dayLoc.page().getByTestId("events-venue-name").filter({ hasText: venue }) });
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-010 — /events list grouped by day → venue", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test.beforeEach(async ({ page }) => {
    const res = await page.goto("/events");
    expect(res, "no response for /events").not.toBeNull();
    expect(res!.status()).toBe(200);
  });

  test("events-view renders with List as the default, active view", async ({ page }) => {
    await expect(page.getByTestId("events-view")).toBeVisible();
    const switcher = page.getByTestId("events-view-switcher");
    await expect(switcher.getByTestId("events-view-list")).toHaveAttribute("aria-current", "true");
    await expect(switcher.getByTestId("events-view-cards")).not.toHaveAttribute(
      "aria-current",
      "true",
    );
    // List view → rows, not cards.
    for (const slug of SFX_EVENT_SLUGS) await expect(row(page, slug)).toHaveCount(1);
    await expect(page.getByTestId("event-card")).toHaveCount(0);
  });

  test("day groups are keyed by venue-local date and ordered ascending", async ({ page }) => {
    await expect(day(page, "2099-03-14")).toHaveCount(1);
    await expect(day(page, "2099-03-15")).toHaveCount(1);

    const dates = await page
      .getByTestId("events-day")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-date") ?? ""));
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), `bad data-date in ${dates}`).toBe(
      true,
    );
    expect(dates).toEqual([...dates].sort());
    expect(dates.indexOf("2099-03-14")).toBeLessThan(dates.indexOf("2099-03-15"));

    // Ceremony + CO–MX final start on 2099-03-15 UTC but are 2099-03-14 venue-local.
    for (const ev of Object.values(SFX_EVENTS)) {
      await expect(row(day(page, ev.localDate), ev.slug), `${ev.slug} under ${ev.localDate}`)
        .toHaveCount(1);
    }
  });

  test("each fixture day heading names its venue-local date", async ({ page }) => {
    await expect(day(page, "2099-03-14").getByTestId("events-day-heading")).toContainText(
      formatEventDate(SFX_EVENTS.ceremony.startsAt, SFX_TZ, "en"),
    );
    await expect(day(page, "2099-03-15").getByTestId("events-day-heading")).toContainText(
      formatEventDate(SFX_EVENTS.usviPregame.startsAt, SFX_TZ, "en"),
    );
  });

  test("within a day, venues group their rows (Alpha before Bravo)", async ({ page }) => {
    const d15 = day(page, "2099-03-15");
    const venueNames = (await d15.getByTestId("events-venue-name").allTextContents())
      .map((v) => v.trim())
      .filter((v) => v.startsWith("E2E "));
    expect(venueNames).toEqual([SFX_VENUES.alpha, SFX_VENUES.bravo]);

    for (const ev of Object.values(SFX_EVENTS)) {
      await expect(
        row(venueGroup(day(page, ev.localDate), ev.venue), ev.slug),
        `${ev.slug} under ${ev.venue}`,
      ).toHaveCount(1);
    }

    // Rows inside the Bravo group are in start-time order.
    const bravoSlugs = await venueGroup(d15, SFX_VENUES.bravo)
      .getByTestId("event-row")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));
    expect(bravoSlugs).toEqual([SFX_EVENTS.usviEmpty.slug, SFX_EVENTS.usviFinal.slug]);
  });

  test("a game row links to its event and shows time, both teams and a state chip", async ({
    page,
  }) => {
    const ev = SFX_EVENTS.usviPregame;
    const r = row(page, ev.slug);
    await expect(r).toHaveAttribute("href", `/events/${ev.slug}`);
    await expect(r.getByTestId("event-row-time")).toContainText(
      formatEventTime(ev.startsAt, SFX_TZ, "en"),
    );
    await expect(r.getByTestId("event-row-away")).toContainText(
      teamDisplayName(SFX_TEAMS.colombia, "en"),
    );
    await expect(r.getByTestId("event-row-home")).toContainText(
      teamDisplayName(SFX_TEAMS.usvi, "en"),
    );
    await expect(r.getByTestId("event-row-status")).toHaveCount(1);
    await expect(r.getByTestId("event-row-title")).toHaveCount(0);

    const fin = row(page, SFX_EVENTS.finalCoMx.slug);
    await expect(fin.getByTestId("event-row-status")).toContainText("Final");
  });

  test("the ceremony row shows its title instead of teams", async ({ page }) => {
    const ev = SFX_EVENTS.ceremony;
    const r = row(page, ev.slug);
    await expect(r).toHaveAttribute("href", `/events/${ev.slug}`);
    await expect(r.getByTestId("event-row-title")).toContainText(ev.title);
    await expect(r.getByTestId("event-row-away")).toHaveCount(0);
    await expect(r.getByTestId("event-row-home")).toHaveCount(0);
    await expect(r.getByTestId("event-row-time")).toContainText(
      formatEventTime(ev.startsAt, SFX_TZ, "en"),
    );
  });

  test("USVI rows are marked data-usvi=true, all others false", async ({ page }) => {
    for (const ev of Object.values(SFX_EVENTS)) {
      await expect(row(page, ev.slug), ev.slug).toHaveAttribute(
        "data-usvi",
        ev.usvi ? "true" : "false",
      );
    }
  });
});
