/*
---
id: teams-web-002
name: "teams-web-002: Public visitor reads a team detail page"
feature: softball/teams
stack: web
priority: P0
status: green
group: A
references:
  - supabase/migrations/0014_team_players.sql
  - app/(public)/teams/[slug]/page.tsx
  - components/ui/team-roster.tsx
  - components/ui/teams-directory.tsx
  - lib/teams.ts
  - lib/teams-view.ts
---

## Given
The 0013 + 0014 seed exists (5 teams, 17 roster players across them, public-read
RLS) and an unauthenticated visitor is on `/teams`.

## When
They click a team card's name link, landing on `/teams/[slug]`; and they request a
detail page for a slug that does not exist.

## Then
The link navigates to the team's detail page, which renders `team-detail` with the
correct name/island/division/description and a `team-roster` whose rows match the
seeded `team_players` for that team, in `sort_order`. An unknown slug returns HTTP
404 and renders no `team-detail`. READ-ONLY: no writes, no teardown.
*/

import { test, expect, type Page } from "@playwright/test";

// Service-key read of the SAME `team_players`/`teams` rows the page renders, so the
// spec tracks the seed rather than hard-coding it. `lib/supabase/admin` is
// `server-only`-fenced; the Playwright transform aliases `server-only` to a no-op via
// tests/tsconfig.json (see playwright.config.ts). READ (SELECT) only — never a write.
import { createAdminClient } from "@/lib/supabase/admin";

type SeedPlayer = {
  jersey_number: number | null;
  name: string;
  position: string;
  sort_order: number;
};

// Read a team + its roster (ordered by sort_order, then name — mirrors getTeamBySlug)
// directly from Supabase so assertions track the actual seeded rows.
async function readRoster(slug: string): Promise<SeedPlayer[]> {
  const supabase = createAdminClient();
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (teamErr) throw teamErr;
  expect(team, `seed read: no team for slug ${slug}`).not.toBeNull();

  const { data, error } = await supabase
    .from("team_players")
    .select("jersey_number,name,position,sort_order")
    .eq("team_id", (team as { id: string }).id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as SeedPlayer[] | null) ?? [];
}

test.describe("teams-web-002 — public team detail renders from seed", () => {
  let frenchtown: SeedPlayer[];
  let crushers: SeedPlayer[];

  test.beforeAll(async () => {
    // GIVEN: the 0014 seed. Read the two rosters under test once, via the service
    // key, so every assertion below tracks the actual seeded rows (no out-of-band writes).
    frenchtown = await readRoster("frenchtown-sluggers");
    crushers = await readRoster("christiansted-crushers");
    // Guard against a silently-empty read masquerading as a pass.
    expect(frenchtown.length, "frenchtown roster empty").toBe(4);
    expect(crushers.length, "crushers roster empty").toBe(4);
  });

  test("clicking a directory team name navigates to its detail page", async ({
    page,
  }) => {
    // WHEN: an anonymous visitor opens /teams and clicks the Frenchtown link.
    const res = await page.goto("/teams");
    expect(res?.status()).toBe(200);

    const link = page
      .getByTestId("team-name")
      .filter({ hasText: "Frenchtown Sluggers" });
    await expect(link).toHaveAttribute("href", "/teams/frenchtown-sluggers");
    await link.click();

    // THEN: we land on the detail route and it renders.
    await expect(page).toHaveURL(/\/teams\/frenchtown-sluggers$/);
    await expect(page.getByTestId("team-detail")).toBeVisible();
  });

  test("detail header + roster match the seed for Frenchtown Sluggers", async ({
    page,
  }) => {
    const res = await page.goto("/teams/frenchtown-sluggers");
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId("team-detail")).toBeVisible();
    await expect(page.getByTestId("team-detail-name")).toHaveText(
      "Frenchtown Sluggers",
    );
    await expect(page.getByTestId("team-detail-island")).toHaveText("St. Thomas");
    await expect(page.getByTestId("team-detail-division")).not.toBeEmpty();
    await expect(page.getByTestId("team-detail-description")).not.toBeEmpty();

    // Roster: exactly the seeded rows, in sort_order.
    const rows = page.getByTestId("team-roster-row");
    await expect(rows).toHaveCount(frenchtown.length);
    await assertRosterMatches(page, frenchtown);

    // Explicit first-row spot check called out by the scenario.
    const first = rows.first();
    await expect(first.getByTestId("player-number")).toHaveText("7");
    await expect(first.getByTestId("player-name")).toHaveText("Malik Prince");
    await expect(first.getByTestId("player-position")).toHaveText("SS");
  });

  test("a second team (Christiansted Crushers) also renders its seeded roster", async ({
    page,
  }) => {
    const res = await page.goto("/teams/christiansted-crushers");
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId("team-detail-name")).toHaveText(
      "Christiansted Crushers",
    );
    const rows = page.getByTestId("team-roster-row");
    await expect(rows).toHaveCount(crushers.length);
    await assertRosterMatches(page, crushers);
    // Rueben Santos is present in this roster.
    await expect(
      page.getByTestId("player-name").filter({ hasText: "Rueben Santos" }),
    ).toHaveCount(1);
  });

  test("an unknown slug returns HTTP 404 and renders no team-detail", async ({
    page,
  }) => {
    const res = await page.goto("/teams/does-not-exist");
    expect(res, "no response for unknown slug").not.toBeNull();
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("team-detail")).toHaveCount(0);
  });
});

// Assert the rendered roster rows equal the seeded players in order (number/name/position).
// The page renders jersey_number as its digits, or an em-dash when null.
async function assertRosterMatches(page: Page, seed: SeedPlayer[]): Promise<void> {
  await expect(page.getByTestId("player-number")).toHaveText(
    seed.map((p) => (p.jersey_number === null ? "—" : String(p.jersey_number))),
  );
  await expect(page.getByTestId("player-name")).toHaveText(
    seed.map((p) => p.name),
  );
  await expect(page.getByTestId("player-position")).toHaveText(
    seed.map((p) => p.position || "—"),
  );
}
