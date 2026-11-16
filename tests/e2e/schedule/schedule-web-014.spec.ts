/*
---
id: schedule-web-014
name: "schedule-web-014: a direct load of /events/[slug] renders the full page; unknown slug 404s"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S3
references:
  - app/(public)/events/[slug]/page.tsx
  - components/ (EventDetail shared component)
  - lib/schedule.ts (getEventBySlug)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures.

## When
A visitor loads `/events/{slug}` directly (no in-site navigation), and `/events/{unknown}`.

## Then
The page returns 200 and renders `event-detail[data-presentation="page"]` — no `event-modal`, no
`event-drawer`, no dialog — with the same sections as the overlay (header, both teams, when &
where). An unknown slug returns HTTP 404 with no `event-detail`.
*/

import { test, expect } from "@playwright/test";
import { teamDisplayName } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-014 — direct load renders the full event page", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("direct load → presentation 'page', not an overlay", async ({ page }) => {
    const ev = SFX_EVENTS.usviPregame;
    const res = await page.goto(`/events/${ev.slug}`);
    expect(res, "no response").not.toBeNull();
    expect(res!.status()).toBe(200);

    const detail = page.getByTestId("event-detail");
    await expect(detail).toHaveCount(1);
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("data-presentation", "page");
    await expect(page.getByTestId("event-modal")).toHaveCount(0);
    await expect(page.getByTestId("event-drawer")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(detail.getByTestId("event-detail-header")).toBeVisible();
    await expect(detail.getByTestId("event-team-away")).toContainText(
      teamDisplayName(SFX_TEAMS.colombia, "en"),
    );
    await expect(detail.getByTestId("event-team-home")).toContainText(
      teamDisplayName(SFX_TEAMS.usvi, "en"),
    );
    await expect(detail.getByTestId("event-time-local")).toBeVisible();
    await expect(detail.getByTestId("event-detail-venue")).toContainText(ev.venue);
  });

  test("a ceremony page renders with its title and no game sections", async ({ page }) => {
    const ev = SFX_EVENTS.ceremony;
    const res = await page.goto(`/events/${ev.slug}`);
    expect(res!.status()).toBe(200);
    const detail = page.getByTestId("event-detail");
    await expect(detail).toHaveAttribute("data-presentation", "page");
    await expect(detail.getByTestId("event-detail-header")).toContainText(ev.title);
    await expect(detail.getByTestId("event-detail-venue")).toContainText(ev.venue);
    await expect(detail.getByTestId("linescore")).toHaveCount(0);
    await expect(detail.getByTestId("roster")).toHaveCount(0);
    await expect(detail.getByTestId("boxscore")).toHaveCount(0);
  });

  test("an unknown slug returns 404 and no event-detail", async ({ page }) => {
    const res = await page.goto("/events/e2e-does-not-exist-2099");
    expect(res, "no response").not.toBeNull();
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("event-detail")).toHaveCount(0);
  });
});
