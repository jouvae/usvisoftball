/*
---
id: teams-web-001
name: "teams-web-001: Public visitor reads the teams directory"
feature: softball/teams
stack: web
priority: P0
status: green
group: A
references:
  - supabase/migrations/0013_teams.sql
  - app/(public)/teams/page.tsx
  - components/ui/teams-directory.tsx
  - lib/teams.ts
  - lib/teams-view.ts
---

## Given
The shared e2e fixtures (tests/support/sports-fixtures.ts) are seeded: 5 "E2E …" member
clubs across the 3 islands, public-read RLS. Real rows (national teams, real clubs) may
also exist; assertions are scoped to the fixture clubs. An unauthenticated visitor opens
`/teams`.

## When
The teams directory loads.

## Then
The `teams-directory` renders exactly 3 island groups — "St. Thomas", "St. John",
"St. Croix", in that order — holding the 5 fixture club cards: St. Thomas holds
"E2E Frenchtown Sluggers" then "E2E Charlotte Amalie Storm"; St. John holds "E2E Cruz Bay
Waves"; St. Croix holds "E2E Christiansted Crushers" then "E2E Frederiksted Fire". Every
fixture card shows a division and a description. Fixtures are removed in afterAll.
*/

import { test, expect, type Locator } from "@playwright/test";
import { ISLAND_LABELS, ISLAND_ORDER } from "@/lib/teams-view";
import {
  FX_NAME_PREFIX,
  FX_TEAMS,
  FX_TEAM_COUNT,
  cleanupSportsFixtures,
  seedSportsFixtures,
} from "../../support/sports-fixtures";

// Expected fixture clubs per island, in display order (sort_order, then name) — mirrors
// lib/teams' groupTeamsByIsland + listTeams ordering.
const EXPECTED = ISLAND_ORDER.map((island) => ({
  label: ISLAND_LABELS[island],
  names: Object.values(FX_TEAMS)
    .filter((t) => t.island === island)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((t) => t.name),
}));

// Fixture team names (DOM order) inside a container — real rows are filtered out.
async function fixtureNames(container: Locator): Promise<string[]> {
  const all = await container.getByTestId("team-name").allTextContents();
  return all.filter((n) => n.startsWith(FX_NAME_PREFIX));
}

// The Teams section is flag-gated (lib/flags.ts); with the flag unset every Teams route
// returns 404. Skip unless NEXT_PUBLIC_TEAMS_ENABLED=true.
test.beforeEach(() => {
  test.skip(
    process.env.NEXT_PUBLIC_TEAMS_ENABLED !== "true",
    "Teams feature flag is OFF",
  );
});

test.describe("teams-web-001 — public teams directory renders the fixture clubs", () => {
  test.beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_TEAMS_ENABLED !== "true") return;
    await seedSportsFixtures();
  });
  test.afterAll(async () => {
    await cleanupSportsFixtures();
  });

  test.beforeEach(async ({ page }) => {
    const res = await page.goto("/teams");
    expect(res, "no response for /teams").not.toBeNull();
    expect(res!.status()).toBe(200);
  });

  test("directory renders (not the empty state)", async ({ page }) => {
    await expect(page.getByTestId("teams-directory")).toBeVisible();
    await expect(page.getByTestId("teams-empty")).toHaveCount(0);
  });

  test("exactly 3 island groups, labelled in display order", async ({ page }) => {
    await expect(page.getByTestId("team-island-group")).toHaveCount(3);
    // Scoped to the island groups — the national-teams group reuses the heading testid.
    await expect(
      page.getByTestId("team-island-group").getByTestId("team-island-name"),
    ).toHaveText([
      "St. Thomas",
      "St. John",
      "St. Croix",
    ]);
  });

  test("all 5 fixture clubs render", async ({ page }) => {
    expect(await fixtureNames(page.getByTestId("teams-directory"))).toHaveLength(
      FX_TEAM_COUNT,
    );
  });

  test("each island group holds its fixture clubs, in order", async ({ page }) => {
    for (let i = 0; i < EXPECTED.length; i++) {
      const container = page.getByTestId("team-island-group").nth(i);
      await expect(container.getByTestId("team-island-name")).toHaveText(
        EXPECTED[i].label,
      );
      expect(await fixtureNames(container)).toEqual(EXPECTED[i].names);
    }
  });

  test("every fixture card shows a division and a description", async ({ page }) => {
    const cards = page
      .getByTestId("team-card")
      .filter({ hasText: FX_NAME_PREFIX });
    await expect(cards).toHaveCount(FX_TEAM_COUNT);
    for (let i = 0; i < FX_TEAM_COUNT; i++) {
      const card = cards.nth(i);
      await expect(card.getByTestId("team-division")).not.toBeEmpty();
      await expect(card.getByTestId("team-description")).not.toBeEmpty();
    }
  });
});
