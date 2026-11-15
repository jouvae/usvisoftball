/*
---
id: schedule-web-021
name: "schedule-web-021: ?view=timeline shows one day with a lane per venue, items placed by start time"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S5
references:
  - app/(public)/events/page.tsx (?view=timeline, ?date=)
  - components/ui/events-view.tsx (switcher link events-view-timeline)
  - lib/schedule-view.ts (timelineRange, timelinePosition, localDateKey)
  - tests/support/schedule-fixtures.ts (firstUpcomingLocalDate)
---

## Given
The schedule fixtures: 2099-03-14 Alpha 18:30 ceremony + 19:00 CO–MX final; 2099-03-15 Alpha 09:00
CO @ USVI, Bravo 12:00 USVI-empty @ MX and 15:00 USVI @ MX (America/El_Salvador). Real Pan Am rows
may also render; assertions are scoped to fixture slugs / venues.

## When
A visitor switches to the Timeline view (`events-view-timeline` → `?view=timeline`) and picks a day
(`timeline-day` → `?view=timeline&date=YYYY-MM-DD`).

## Then
`events-timeline` renders with an hour axis `timeline-axis`. Day selector entries `timeline-day`
carry `data-date`; the selected one is aria-current; with no `date` the selected day is the first
upcoming day that has events. One `timeline-lane[data-venue]` per venue that day, labelled with the
venue name. Items `timeline-item` (`data-slug`, `data-usvi`) are `<a href="/events/{slug}">`, sit
in their venue's lane, and are placed left→right by venue-local start time. Clicking an item opens
the event modal (desktop) / drawer (mobile) like a list row does. On mobile the timeline scrolls
horizontally inside its own container while the page itself never overflows horizontally.
*/

import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { teamDisplayName } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  SFX_VENUES,
  cleanupScheduleFixtures,
  firstUpcomingLocalDate,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

const isMobile = (info: TestInfo) => info.project.name === "mobile";

function lane(page: Page, venue: string): Locator {
  return page.getByTestId("timeline-lane").and(page.locator(`[data-venue="${venue}"]`));
}
function item(scope: Page | Locator, slug: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope.getByTestId("timeline-item").and(page.locator(`[data-slug="${slug}"]`));
}
function dayLink(page: Page, date: string): Locator {
  return page.getByTestId("timeline-day").and(page.locator(`[data-date="${date}"]`));
}

async function gotoTimeline(page: Page, date?: string) {
  const qs = new URLSearchParams({ view: "timeline" });
  if (date) qs.set("date", date);
  const res = await page.goto(`/events?${qs}`);
  expect(res, "no response").not.toBeNull();
  expect(res!.status()).toBe(200);
  await expect(page.getByTestId("events-timeline")).toBeVisible();
}

async function left(loc: Locator): Promise<number> {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  expect(box, "item has no bounding box").not.toBeNull();
  return box!.x;
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-021 — timeline view", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("the switcher's Timeline link sets ?view=timeline and renders the timeline", async ({
    page,
  }) => {
    const res = await page.goto("/events");
    expect(res!.status()).toBe(200);
    await page.getByTestId("events-view-switcher").getByTestId("events-view-timeline").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("timeline");
    await expect(page.getByTestId("events-view-timeline")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("events-view-list")).not.toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("events-timeline")).toBeVisible();
    await expect(page.getByTestId("timeline-axis")).toHaveCount(1);
    // Timeline replaces list rows / cards.
    await expect(page.getByTestId("event-row")).toHaveCount(0);
    await expect(page.getByTestId("event-card")).toHaveCount(0);
  });

  test("with no date, the first upcoming day with events is selected", async ({ page }) => {
    const expected = await firstUpcomingLocalDate();
    expect(expected, "fixtures guarantee at least one upcoming day").not.toBeNull();
    await gotoTimeline(page);

    const selected = page.getByTestId("timeline-day").and(page.locator('[aria-current="true"], [aria-current="date"], [aria-current="page"]'));
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAttribute("data-date", expected!);

    // Every day entry is a real date and links to its own ?view=timeline&date=… URL.
    const days = page.getByTestId("timeline-day");
    const n = await days.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const d = days.nth(i);
      const date = await d.getAttribute("data-date");
      expect(date ?? "").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    await expect(dayLink(page, "2099-03-14")).toHaveCount(1);
    await expect(dayLink(page, "2099-03-15")).toHaveCount(1);
  });

  test("picking a day sets ?date= and marks it current", async ({ page }) => {
    await gotoTimeline(page);
    await dayLink(page, "2099-03-15").click();
    await expect
      .poll(() => {
        const u = new URL(page.url());
        return `${u.searchParams.get("view")}|${u.searchParams.get("date")}`;
      })
      .toBe("timeline|2099-03-15");
    await expect(dayLink(page, "2099-03-15")).toHaveAttribute("aria-current", /^(true|date|page)$/);
    await expect(dayLink(page, "2099-03-14")).not.toHaveAttribute(
      "aria-current",
      /^(true|date|page)$/,
    );
  });

  test("one labelled lane per venue; items sit in their venue's lane and link to the event", async ({
    page,
  }) => {
    await gotoTimeline(page, "2099-03-15");

    const venues = await page
      .getByTestId("timeline-lane")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-venue") ?? ""));
    expect(venues.filter((v) => v.startsWith("E2E "))).toEqual([SFX_VENUES.alpha, SFX_VENUES.bravo]);
    expect(new Set(venues).size, "one lane per venue").toBe(venues.length);
    await expect(lane(page, SFX_VENUES.alpha)).toContainText(SFX_VENUES.alpha);
    await expect(lane(page, SFX_VENUES.bravo)).toContainText(SFX_VENUES.bravo);

    const day15 = Object.values(SFX_EVENTS).filter((e) => e.localDate === "2099-03-15");
    for (const ev of day15) {
      const it = item(lane(page, ev.venue), ev.slug);
      await expect(it, `${ev.slug} in ${ev.venue}`).toHaveCount(1);
      await expect(it).toHaveAttribute("href", `/events/${ev.slug}`);
      await expect(it).toHaveAttribute("data-usvi", ev.usvi ? "true" : "false");
    }
    // The other day's events are not on this day's timeline.
    await expect(item(page, SFX_EVENTS.ceremony.slug)).toHaveCount(0);
    await expect(item(page, SFX_EVENTS.finalCoMx.slug)).toHaveCount(0);

    // A game item names its teams.
    await expect(item(page, SFX_EVENTS.usviFinal.slug)).toContainText(
      teamDisplayName(SFX_TEAMS.usvi, "en"),
    );
  });

  test("items are placed left→right by venue-local start time", async ({ page }) => {
    await gotoTimeline(page, "2099-03-15");
    const bravo = lane(page, SFX_VENUES.bravo);
    const noon = await left(item(bravo, SFX_EVENTS.usviEmpty.slug)); // 12:00
    const three = await left(item(bravo, SFX_EVENTS.usviFinal.slug)); // 15:00
    expect(noon, "12:00 item left of 15:00 item").toBeLessThan(three);

    await gotoTimeline(page, "2099-03-14");
    const alpha = lane(page, SFX_VENUES.alpha);
    const cer = await left(item(alpha, SFX_EVENTS.ceremony.slug)); // 18:30
    const fin = await left(item(alpha, SFX_EVENTS.finalCoMx.slug)); // 19:00
    expect(cer, "18:30 item left of 19:00 item").toBeLessThan(fin);
  });

  test("clicking an item opens the event in the modal (desktop) / drawer (mobile)", async ({
    page,
  }, info) => {
    await gotoTimeline(page, "2099-03-15");
    const ev = SFX_EVENTS.usviPregame;
    await item(page, ev.slug).click();
    await expect(page).toHaveURL(new RegExp(`/events/${ev.slug}$`));
    const overlay = isMobile(info) ? page.getByTestId("event-drawer") : page.getByTestId("event-modal");
    await expect(overlay).toBeVisible();
    await expect(overlay.getByTestId("event-team-home")).toContainText(
      teamDisplayName(SFX_TEAMS.usvi, "en"),
    );
  });

  test("the page never overflows horizontally; on mobile the timeline scrolls inside its container", async ({
    page,
  }, info) => {
    await gotoTimeline(page, "2099-03-15");

    const pageOverflow = await page.evaluate(() => ({
      scrollWidth: document.scrollingElement!.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      pageOverflow.scrollWidth,
      `document scrollWidth ${pageOverflow.scrollWidth} > innerWidth ${pageOverflow.innerWidth}`,
    ).toBeLessThanOrEqual(pageOverflow.innerWidth);

    if (!isMobile(info)) return;
    // Some element at or inside events-timeline is a horizontal scroller with overflowing content.
    const scrolls = await page.getByTestId("events-timeline").evaluate((root) => {
      const els = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
      return els.some((el) => {
        const ox = getComputedStyle(el).overflowX;
        return (ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1;
      });
    });
    expect(scrolls, "no horizontally scrolling container inside events-timeline").toBe(true);
  });
});
