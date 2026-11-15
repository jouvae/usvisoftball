/*
---
id: schedule-web-013
name: "schedule-web-013: an in-site row click opens the event as a modal (desktop) / drawer (mobile)"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S3
references:
  - app/(public)/events/@modal/(.)[slug]/ (intercepting route)
  - components/ (EventDetail shared component; Modal/Drawer wrapper — Base UI)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures on `/events` (List view).

## When
The visitor clicks the USVI pregame row.

## Then
The URL becomes `/events/{slug}` and the SAME `event-detail` component renders inside an overlay:
desktop project → `role="dialog"` with `data-testid="event-modal"` and
`event-detail[data-presentation="modal"]`; mobile project → `data-testid="event-drawer"` with
`event-detail[data-presentation="drawer"]`. The overlay shows the event (both team names).
Escape (desktop) closes it and the URL returns to `/events`; browser Back (both projects) closes
it and returns to `/events`, with the list still rendered underneath.
*/

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { teamDisplayName } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
const EV = SFX_EVENTS.usviPregame;

const isMobile = (info: TestInfo) => info.project.name === "mobile";

function overlay(page: Page, info: TestInfo) {
  return isMobile(info) ? page.getByTestId("event-drawer") : page.getByTestId("event-modal");
}

async function openFromList(page: Page, info: TestInfo) {
  const res = await page.goto("/events");
  expect(res!.status()).toBe(200);
  await page.locator(`[data-testid="event-row"][data-slug="${EV.slug}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/events/${EV.slug}$`));
  await expect(overlay(page, info)).toBeVisible();
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-013 — event modal / drawer on in-site click", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("clicking a row opens the shared event detail in the right overlay", async ({
    page,
  }, info) => {
    await openFromList(page, info);
    const ov = overlay(page, info);

    if (isMobile(info)) {
      await expect(page.getByTestId("event-modal")).toHaveCount(0);
    } else {
      await expect(page.getByRole("dialog").and(page.getByTestId("event-modal"))).toBeVisible();
      await expect(page.getByTestId("event-drawer")).toHaveCount(0);
    }

    const detail = ov.getByTestId("event-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute(
      "data-presentation",
      isMobile(info) ? "drawer" : "modal",
    );
    await expect(detail.getByTestId("event-team-away")).toContainText(
      teamDisplayName(SFX_TEAMS.colombia, "en"),
    );
    await expect(detail.getByTestId("event-team-home")).toContainText(
      teamDisplayName(SFX_TEAMS.usvi, "en"),
    );
  });

  test("Escape closes the modal and restores /events (desktop)", async ({ page }, info) => {
    test.skip(isMobile(info), "Escape-to-close is the desktop modal contract");
    await openFromList(page, info);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("event-modal")).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/events");
    await expect(page.getByTestId("events-view")).toBeVisible();
  });

  test("browser Back closes the overlay and restores /events", async ({ page }, info) => {
    await openFromList(page, info);
    await page.goBack();
    await expect(overlay(page, info)).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/events");
    await expect(page.getByTestId("events-view")).toBeVisible();
    await expect(
      page.locator(`[data-testid="event-row"][data-slug="${EV.slug}"]`),
    ).toHaveCount(1);
  });
});
