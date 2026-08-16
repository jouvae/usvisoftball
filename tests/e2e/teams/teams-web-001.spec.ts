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
The 0013 seed exists (5 member clubs across 3 islands, public-read RLS) and an
unauthenticated visitor opens `/teams`.

## When
The teams directory loads.

## Then
The `teams-directory` renders exactly 3 island groups — "St. Thomas", "St. John",
"St. Croix", in that order — and exactly 5 team cards. St. Thomas holds
"Frenchtown Sluggers" and "Charlotte Amalie Storm"; St. John holds "Cruz Bay
Waves"; St. Croix holds "Christiansted Crushers" and "Frederiksted Fire". Every
card shows a division and a description. READ-ONLY: no writes, no teardown.
*/

import { test, expect, type Page } from "@playwright/test";

// Service-key read of the SAME `teams` table the page renders, so the spec tracks
// the seed rather than hard-coding it. `lib/supabase/admin` is `server-only`-fenced;
// the Playwright transform aliases `server-only` to a no-op via tests/tsconfig.json
// (see playwright.config.ts), so this resolves under a plain-Node worker. This is a
// READ (SELECT) only — never a write.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type Island,
  ISLAND_ORDER,
  ISLAND_LABELS,
} from "@/lib/teams-view";

type SeedRow = { name: string; island: Island; division: string; description: string; sort_order: number };

// Expected groups derived from the live seed, ordered by island (display order)
// then sort_order — mirrors lib/teams' groupTeamsByIsland + listTeams ordering.
type ExpectedGroup = { island: Island; label: string; names: string[] };

async function readSeed(): Promise<{ groups: ExpectedGroup[]; totalCards: number }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("teams")
    .select("name,island,division,description,sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data as SeedRow[] | null) ?? [];

  const groups = ISLAND_ORDER.map((island) => ({
    island,
    label: ISLAND_LABELS[island],
    names: rows.filter((r) => r.island === island).map((r) => r.name),
  })).filter((g) => g.names.length > 0);

  return { groups, totalCards: rows.length };
}

// Read `team-name` text in DOM order, scoped to the nth island group.
function groupCardNames(page: Page, groupIndex: number): Promise<string[]> {
  return page
    .getByTestId("team-island-group")
    .nth(groupIndex)
    .getByTestId("team-name")
    .allTextContents();
}

test.describe("teams-web-001 — public teams directory renders from seed", () => {
  let seed: { groups: ExpectedGroup[]; totalCards: number };

  test.beforeAll(async () => {
    // GIVEN: the 0013 seed. Read it once via the service key so every assertion
    // below tracks the actual seeded rows (no out-of-band writes).
    seed = await readSeed();
    // Guard against a silently-empty read masquerading as a pass.
    expect(seed.totalCards, "seed read returned no teams").toBe(5);
    expect(seed.groups.map((g) => g.label)).toEqual([
      "St. Thomas",
      "St. John",
      "St. Croix",
    ]);
  });

  test.beforeEach(async ({ page }) => {
    // WHEN: an anonymous visitor opens /teams and the directory loads.
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
    await expect(page.getByTestId("team-island-name")).toHaveText([
      "St. Thomas",
      "St. John",
      "St. Croix",
    ]);
  });

  test("exactly 5 team cards total", async ({ page }) => {
    await expect(page.getByTestId("team-card")).toHaveCount(seed.totalCards);
    await expect(page.getByTestId("team-card")).toHaveCount(5);
  });

  test("each island group holds exactly its seeded teams, in order", async ({
    page,
  }) => {
    await expect(page.getByTestId("team-island-group")).toHaveCount(
      seed.groups.length,
    );
    for (let i = 0; i < seed.groups.length; i++) {
      const group = seed.groups[i];
      const container = page.getByTestId("team-island-group").nth(i);
      // Group label matches the seeded island.
      await expect(container.getByTestId("team-island-name")).toHaveText(
        group.label,
      );
      // Card count + names (DOM order) match the seed for this island.
      await expect(container.getByTestId("team-card")).toHaveCount(
        group.names.length,
      );
      expect(await groupCardNames(page, i)).toEqual(group.names);
    }
  });

  test("every card shows a division and a description", async ({ page }) => {
    const cards = page.getByTestId("team-card");
    const count = await cards.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Scope inner testids to the card — they repeat per card.
      await expect(card.getByTestId("team-division")).toHaveCount(1);
      await expect(card.getByTestId("team-division")).not.toBeEmpty();
      await expect(card.getByTestId("team-description")).toHaveCount(1);
      await expect(card.getByTestId("team-description")).not.toBeEmpty();
    }
  });
});
