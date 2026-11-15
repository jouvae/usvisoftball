/*
---
id: schedule-web-011
name: "schedule-web-011: the USVI games toggle filters /events to USVI rows (?team=usvi)"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S3
references:
  - app/(public)/events/page.tsx
  - lib/schedule.ts (listEvents teamCountry)
  - lib/schedule-view.ts (isUsviGame, USVI_COUNTRY)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures (3 USVI games, 1 non-USVI game, 1 ceremony) on `/events`.

## When
The visitor clicks the "USVI games" toggle (`events-filter-usvi`, a link), then clicks it again.

## Then
On: the URL carries `team=usvi`, the toggle has aria-pressed="true", every rendered row is
`data-usvi="true"`, the 3 USVI fixture rows remain and the CO–MX final + ceremony are gone.
Off: `team=usvi` leaves the URL, aria-pressed is no longer "true", all 5 fixture rows return.
A direct load of `/events?team=usvi` renders the filtered state.
*/

import { test, expect, type Page } from "@playwright/test";
import {
  SFX_EVENTS,
  SFX_EVENT_SLUGS,
  SFX_USVI_EVENT_SLUGS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
const NON_USVI = SFX_EVENT_SLUGS.filter((s) => !SFX_USVI_EVENT_SLUGS.includes(s));

function row(page: Page, slug: string) {
  return page.locator(`[data-testid="event-row"][data-slug="${slug}"]`);
}

async function expectFiltered(page: Page) {
  expect(new URL(page.url()).searchParams.get("team")).toBe("usvi");
  await expect(page.getByTestId("events-filter-usvi")).toHaveAttribute("aria-pressed", "true");
  for (const slug of SFX_USVI_EVENT_SLUGS) await expect(row(page, slug), slug).toHaveCount(1);
  for (const slug of NON_USVI) await expect(row(page, slug), slug).toHaveCount(0);
  // Every row on the page — fixture or real — is a USVI row.
  const flags = await page
    .getByTestId("event-row")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-usvi")));
  expect(flags.length).toBeGreaterThanOrEqual(SFX_USVI_EVENT_SLUGS.length);
  expect(flags.every((f) => f === "true"), `non-USVI row present: ${flags}`).toBe(true);
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-011 — USVI games filter", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("toggling USVI games on and off filters rows and drives ?team=usvi", async ({ page }) => {
    await page.goto("/events");
    const toggle = page.getByTestId("events-filter-usvi");
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toHaveAttribute("aria-pressed", "true");
    for (const slug of SFX_EVENT_SLUGS) await expect(row(page, slug)).toHaveCount(1);

    // WHEN: toggle on.
    await toggle.click();
    await expect(page).toHaveURL(/[?&]team=usvi(&|$)/);
    await expectFiltered(page);

    // WHEN: toggle off.
    await page.getByTestId("events-filter-usvi").click();
    await expect(page).not.toHaveURL(/[?&]team=usvi/);
    await expect(page.getByTestId("events-filter-usvi")).not.toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const slug of SFX_EVENT_SLUGS) await expect(row(page, slug)).toHaveCount(1);
  });

  test("a direct load of /events?team=usvi is filtered", async ({ page }) => {
    const res = await page.goto("/events?team=usvi");
    expect(res!.status()).toBe(200);
    await expectFiltered(page);
    await expect(row(page, SFX_EVENTS.finalCoMx.slug)).toHaveCount(0);
  });
});
