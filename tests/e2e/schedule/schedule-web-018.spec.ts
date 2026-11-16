/*
---
id: schedule-web-018
name: "schedule-web-018: /tournaments/[slug] shows derived dates and only its events"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - app/(public)/tournaments/[slug]/page.tsx
  - lib/schedule.ts (getTournamentBySlug, listEvents tournamentId)
  - lib/schedule-view.ts (tournamentWindow)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixture tournament `e2e-cup` (America/El_Salvador): first event 2099-03-15T00:30Z
(= Mar 14 venue-local), last 2099-03-15T21:00Z (= Mar 15). No announced dates. The real Pan Am
tournament also exists.

## When
A visitor loads `/tournaments/e2e-cup`.

## Then
`tournament-detail` renders the name; `tournament-dates` shows the derived venue-local window
(Mar 14 … 15, 2099); the shared `events-view` lists exactly the 5 fixture events and no others
(no Pan Am rows). An unknown tournament slug returns 404.
*/

import { test, expect } from "@playwright/test";
import {
  SFX_EVENT_SLUGS,
  SFX_TOURNAMENT,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-018 — tournament page", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("shows the tournament, its derived venue-local dates, and only its events", async ({
    page,
  }) => {
    const res = await page.goto(`/tournaments/${SFX_TOURNAMENT.slug}`);
    expect(res, "no response").not.toBeNull();
    expect(res!.status()).toBe(200);

    const detail = page.getByTestId("tournament-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(SFX_TOURNAMENT.name);

    const dates = detail.getByTestId("tournament-dates");
    await expect(dates).toContainText("2099");
    await expect(dates).toContainText(/Mar(ch)?\.?\s+14/);
    await expect(dates).toContainText("15");

    const view = page.getByTestId("events-view");
    await expect(view).toBeVisible();
    const slugs = await view
      .getByTestId("event-row")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-slug") ?? ""));
    expect([...slugs].sort()).toEqual([...SFX_EVENT_SLUGS].sort());
  });

  test("an unknown tournament slug returns 404", async ({ page }) => {
    const res = await page.goto("/tournaments/e2e-no-such-tournament");
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("tournament-detail")).toHaveCount(0);
  });
});
