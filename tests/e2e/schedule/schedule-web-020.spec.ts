/*
---
id: schedule-web-020
name: "schedule-web-020: /es/events/[slug] shows Spanish country names and date/time labels"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - proxy.ts (/es rewrite + x-locale)
  - app/(public)/events/[slug]/page.tsx
  - app/(public)/events/page.tsx
  - lib/schedule-view.ts (teamDisplayName, formatEventDate, formatEventTime)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures; the USVI pregame game (CO @ USVI, 2099-03-15 09:00 venue-local).

## When
A visitor loads `/es/events/{slug}` and `/es/events`.

## Then
The event page has `<html lang="es">`; `event-team-away` reads "Colombia" and `event-team-home`
reads "Islas Vírgenes de EE. UU." (Intl es); the page shows the Spanish date label (es weekday +
month, e.g. "martes, 15 de marzo") and `event-time-local` the Spanish time ("9:00 a. m."), and no
English date label. On `/es/events`, fixture rows link to `/es/events/{slug}` and show Spanish
team names.
*/

import { test, expect } from "@playwright/test";
import {
  formatEventDate,
  formatEventTime,
  teamDisplayName,
} from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  SFX_TZ,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
const EV = SFX_EVENTS.usviPregame;

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-020 — Spanish event page", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("/es/events/[slug] renders Spanish team names and date/time labels", async ({ page }) => {
    const res = await page.goto(`/es/events/${EV.slug}`);
    expect(res, "no response").not.toBeNull();
    expect(res!.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(`/es/events/${EV.slug}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    const detail = page.getByTestId("event-detail");
    await expect(detail).toBeVisible();
    // Sanity on the expected strings themselves (Intl es).
    expect(teamDisplayName(SFX_TEAMS.usvi, "es")).toBe("Islas Vírgenes de EE. UU.");

    await expect(detail.getByTestId("event-team-away")).toContainText(
      teamDisplayName(SFX_TEAMS.colombia, "es"),
    );
    await expect(detail.getByTestId("event-team-home")).toContainText(
      "Islas Vírgenes de EE. UU.",
    );
    await expect(detail.getByTestId("event-team-home")).not.toContainText("U.S. Virgin Islands");

    const esDate = formatEventDate(EV.startsAt, SFX_TZ, "es");
    await expect(detail).toContainText(esDate);
    await expect(detail).not.toContainText(formatEventDate(EV.startsAt, SFX_TZ, "en"));
    await expect(detail.getByTestId("event-time-local")).toContainText(
      formatEventTime(EV.startsAt, SFX_TZ, "es"),
    );
  });

  test("/es/events rows link to /es/events/[slug] with Spanish names", async ({ page }) => {
    const res = await page.goto("/es/events");
    expect(res!.status()).toBe(200);
    const row = page.locator(`[data-testid="event-row"][data-slug="${EV.slug}"]`);
    await expect(row).toHaveAttribute("href", `/es/events/${EV.slug}`);
    await expect(row.getByTestId("event-row-home")).toContainText("Islas Vírgenes de EE. UU.");
  });
});
