/*
---
id: schedule-web-012
name: "schedule-web-012: ?view=cards renders one card per event with the same data"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - app/(public)/events/page.tsx
  - components/ (EventsView, shared EventRow/EventCard)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures on `/events` (List view).

## When
The visitor clicks `events-view-cards` in the view switcher (or loads `/events?view=cards`).

## Then
The URL carries `view=cards`; `events-view-cards` is aria-current="true" and List is not. Exactly
one `event-card` renders per fixture event (no `event-row`s), each an `<a href="/events/{slug}">`
with the same `data-slug` / `data-usvi` and the same child testids as rows (time, away/home or
title, status). Switching back to List removes `view=cards` and restores rows.
*/

import { test, expect, type Page } from "@playwright/test";
import { formatEventTime, teamDisplayName } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_EVENT_SLUGS,
  SFX_TEAMS,
  SFX_TZ,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

function card(page: Page, slug: string) {
  return page.locator(`[data-testid="event-card"][data-slug="${slug}"]`);
}
function row(page: Page, slug: string) {
  return page.locator(`[data-testid="event-row"][data-slug="${slug}"]`);
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-012 — cards view", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("the switcher moves List → Cards → List via ?view=", async ({ page }) => {
    await page.goto("/events");
    await page.getByTestId("events-view-switcher").getByTestId("events-view-cards").click();
    await expect(page).toHaveURL(/[?&]view=cards(&|$)/);
    await expect(page.getByTestId("events-view-cards")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("events-view-list")).not.toHaveAttribute("aria-current", "true");
    for (const slug of SFX_EVENT_SLUGS) await expect(card(page, slug)).toHaveCount(1);

    await page.getByTestId("events-view-switcher").getByTestId("events-view-list").click();
    await expect(page).not.toHaveURL(/[?&]view=cards/);
    await expect(page.getByTestId("events-view-list")).toHaveAttribute("aria-current", "true");
    for (const slug of SFX_EVENT_SLUGS) await expect(row(page, slug)).toHaveCount(1);
    await expect(page.getByTestId("event-card")).toHaveCount(0);
  });

  test("one card per fixture event, carrying the same data as the row", async ({ page }) => {
    const res = await page.goto("/events?view=cards");
    expect(res!.status()).toBe(200);
    await expect(page.getByTestId("events-view")).toBeVisible();
    await expect(page.getByTestId("event-row")).toHaveCount(0);

    for (const ev of Object.values(SFX_EVENTS)) {
      const c = card(page, ev.slug);
      await expect(c, ev.slug).toHaveCount(1);
      await expect(c).toHaveAttribute("href", `/events/${ev.slug}`);
      await expect(c).toHaveAttribute("data-usvi", ev.usvi ? "true" : "false");
      await expect(c.getByTestId("event-row-time")).toContainText(
        formatEventTime(ev.startsAt, SFX_TZ, "en"),
      );
      if (ev.game) {
        await expect(c.getByTestId("event-row-away")).toContainText(
          teamDisplayName(SFX_TEAMS[ev.game.away], "en"),
        );
        await expect(c.getByTestId("event-row-home")).toContainText(
          teamDisplayName(SFX_TEAMS[ev.game.home], "en"),
        );
        await expect(c.getByTestId("event-row-status")).toHaveCount(1);
      } else {
        await expect(c.getByTestId("event-row-title")).toContainText(ev.title);
        await expect(c.getByTestId("event-row-away")).toHaveCount(0);
      }
    }
  });
});
