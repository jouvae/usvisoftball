/*
---
id: schedule-e2e-001
name: "schedule-e2e-001: role gate — scorekeeper reaches scoring only; anon → login; contributor denied"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6, §6.1
  - docs/features/softball/schedule/scenarios.md S4
  - app/admin/(protected)/scoring/ (page.tsx, [slug]/page.tsx)
  - lib/roles.ts (requireAnyRole), lib/roles-view.ts (homeForRoles)
  - tests/support/scoring-fixtures.ts
---

## Given
The scoring fixtures: a pregame guest game TODAY (venue-local), a pregame guest game and a
pregame USVI game in 2099; a fresh `scorekeeper` user and a fresh `contributor` user (real
auth users, per-run passwords, signed in through the real /admin/login form).

## When
An anonymous visitor, the scorekeeper, and the contributor each try the scoring area and the
other admin sections.

## Then
Anon: `/admin/scoring` and `/admin/scoring/{slug}` redirect to `/admin/login`.
Scorekeeper: sign-in lands on `/admin/scoring` (`/admin` redirects there); `scoring-games` lists
`scoring-game-link` rows for the fixtures (data-slug), today's game before the 2099 games; the
editor/contributor sections (`/admin/teams`, `/admin/board`) bounce back to `/admin/scoring`, and
no article/board/teams admin controls render. A guest game has only `scoring-tab-scoreboard`; a
USVI game also has `scoring-tab-lineup` and `scoring-tab-boxscore`.
Contributor: `/admin/scoring` and `/admin/scoring/{slug}` redirect to `/admin`; the scoring list
never renders.
*/

import { test, expect } from "@playwright/test";
import {
  SCX_GAMES,
  cleanupScoringFixtures,
  seedScoringFixtures,
  signIn,
  type ScoringFixtures,
} from "../../support/scoring-fixtures";

let fx: ScoringFixtures;

test.describe("schedule-e2e-001 — scoring role gate", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    fx = await seedScoringFixtures();
  });
  test.afterAll(async () => {
    await cleanupScoringFixtures();
  });

  test("anon is redirected to the login page", async ({ page }) => {
    await page.goto("/admin/scoring");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("scoring-games")).toHaveCount(0);

    await page.goto(`/admin/scoring/${SCX_GAMES.guest.slug}`);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("scoring-tab-scoreboard")).toHaveCount(0);
  });

  test("scorekeeper lands on /admin/scoring and sees the fixture games, today first", async ({
    page,
  }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);

    const list = page.getByTestId("scoring-games");
    await expect(list).toBeVisible();
    const links = list.getByTestId("scoring-game-link");
    for (const g of Object.values(SCX_GAMES)) {
      await expect(links.and(page.locator(`[data-slug="${g.slug}"]`))).toHaveCount(1);
    }

    const slugs = await links.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));
    const iToday = slugs.indexOf(SCX_GAMES.today.slug);
    const iGuest = slugs.indexOf(SCX_GAMES.guest.slug);
    const iUsvi = slugs.indexOf(SCX_GAMES.usvi.slug);
    expect(iToday, "today's game is listed").toBeGreaterThanOrEqual(0);
    expect(iToday, "today's game precedes upcoming games").toBeLessThan(iGuest);
    expect(iToday, "today's game precedes upcoming games").toBeLessThan(iUsvi);
    // Same day (2099-04-01 venue-local): USVI first even though it starts later.
    expect(iUsvi, "USVI first within a day").toBeLessThan(iGuest);
  });

  test("scorekeeper is bounced from the dashboard and editor sections back to scoring", async ({
    page,
  }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/scoring$/);
    await expect(page.getByTestId("admin-new-article-link")).toHaveCount(0);
    await expect(page.getByTestId("admin-board-link")).toHaveCount(0);
    await expect(page.getByTestId("admin-teams-link")).toHaveCount(0);

    for (const path of ["/admin/teams", "/admin/board"]) {
      await page.goto(path);
      await expect(page, `${path} bounces a scorekeeper`).toHaveURL(/\/admin\/scoring$/);
    }
    await expect(page.getByTestId("teams-admin")).toHaveCount(0);
    await expect(page.getByTestId("board-admin")).toHaveCount(0);
  });

  test("scorekeeper opens a guest game (scoreboard only) and a USVI game (all tabs)", async ({
    page,
  }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);

    await page
      .getByTestId("scoring-game-link")
      .and(page.locator(`[data-slug="${SCX_GAMES.guest.slug}"]`))
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/scoring/${SCX_GAMES.guest.slug}$`));
    await expect(page.getByTestId("scoring-tab-scoreboard")).toBeVisible();
    await expect(page.getByTestId("scoring-tab-lineup")).toHaveCount(0);
    await expect(page.getByTestId("scoring-tab-boxscore")).toHaveCount(0);
    await expect(page.getByTestId("scoring-state")).toHaveText(/Pregame/);
    await expect(page.getByTestId("scoring-sync-status")).toHaveAttribute("data-state", "saved");
    await expect(page.getByTestId("scoring-undo")).toBeDisabled();

    await page.goto(`/admin/scoring/${SCX_GAMES.usvi.slug}`);
    await expect(page.getByTestId("scoring-tab-scoreboard")).toBeVisible();
    await expect(page.getByTestId("scoring-tab-lineup")).toBeVisible();
    await expect(page.getByTestId("scoring-tab-boxscore")).toBeVisible();
  });

  test("contributor is denied the scoring area", async ({ page }) => {
    await signIn(page, fx.users.contributor, /\/admin$/);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    // The Scoring nav link (admin-nav-scoring) is for scorekeeper/editor only.
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    await expect(page.getByTestId("admin-nav-scoring")).toHaveCount(0);

    await page.goto("/admin/scoring");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("scoring-games")).toHaveCount(0);

    await page.goto(`/admin/scoring/${SCX_GAMES.guest.slug}`);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("scoring-tab-scoreboard")).toHaveCount(0);
  });
});
