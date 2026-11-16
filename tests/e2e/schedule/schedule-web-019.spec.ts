/*
---
id: schedule-web-019
name: "schedule-web-019: guest teams get a light /teams/[slug] page and stay out of /teams"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - app/(public)/teams/[slug]/page.tsx
  - app/(public)/teams/page.tsx
  - lib/schedule.ts (listGamesForTeam)
  - lib/schedule-view.ts (flagEmoji, countryName)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures: guest team `e2e-colombia` (CO, division "E2E U18 Women") plays the CO–MX
final and the CO @ USVI pregame.

## When
A visitor loads `/teams/e2e-colombia`, and the `/teams` directory.

## Then
The guest page returns 200 with `team-flag` (🇨🇴), `team-country` ("Colombia"), the division, and
`team-games` containing exactly its 2 fixture games as `event-row`s linking to `/events/{slug}`.
There is no `team-roster`. The `/teams` directory lists no guest fixture (no link to
`/teams/e2e-colombia` or `/teams/e2e-mexico`, no "E2E Colombia" card).
*/

import { test, expect } from "@playwright/test";
import { countryName, flagEmoji } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const TEAMS_ON = process.env.NEXT_PUBLIC_TEAMS_ENABLED === "true";
const CO = SFX_TEAMS.colombia;

test.beforeEach(() => {
  test.skip(!TEAMS_ON, "Teams feature flag is OFF");
});

test.describe("schedule-web-019 — guest team page", () => {
  test.beforeAll(async () => {
    if (!TEAMS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!TEAMS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("a guest team page shows flag, country, division and its games — no roster", async ({
    page,
  }) => {
    const res = await page.goto(`/teams/${CO.slug}`);
    expect(res, "no response").not.toBeNull();
    expect(res!.status()).toBe(200);

    await expect(page.getByTestId("team-flag")).toContainText(flagEmoji(CO.countryCode));
    await expect(page.getByTestId("team-country")).toContainText(countryName(CO.countryCode, "en"));
    await expect(page.locator("body")).toContainText(CO.division);
    await expect(page.getByTestId("team-roster")).toHaveCount(0);

    const games = page.getByTestId("team-games");
    await expect(games).toBeVisible();
    const expected = [SFX_EVENTS.finalCoMx.slug, SFX_EVENTS.usviPregame.slug];
    const slugs = await games
      .getByTestId("event-row")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-slug") ?? ""));
    expect([...slugs].sort()).toEqual([...expected].sort());
    for (const slug of expected) {
      await expect(
        games.locator(`[data-testid="event-row"][data-slug="${slug}"]`),
      ).toHaveAttribute("href", `/events/${slug}`);
    }
  });

  test("the /teams directory does not list guest teams", async ({ page }) => {
    const res = await page.goto("/teams");
    expect(res!.status()).toBe(200);
    for (const t of [SFX_TEAMS.colombia, SFX_TEAMS.mexico]) {
      await expect(page.locator(`a[href="/teams/${t.slug}"]`)).toHaveCount(0);
      await expect(page.getByTestId("team-name").filter({ hasText: t.name })).toHaveCount(0);
    }
  });
});
