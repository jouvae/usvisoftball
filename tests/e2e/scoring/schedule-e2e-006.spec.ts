/*
---
id: schedule-e2e-006
name: "schedule-e2e-006: final — confirmed Final sets state final; the public page shows Final"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6 (2), §6.1 (scoring-final, scoring-final-confirm, scoring-reopen)
  - docs/features/softball/schedule/scenarios.md S4
  - app/admin/(protected)/scoring/actions.ts (setGameState: reopen is editor-only)
  - tests/support/scoring-fixtures.ts
---

## Given
A signed-in `scorekeeper` on the fixture guest game (reset), started, with away 1 run in inning 1.

## When
They tap `scoring-final`; nothing changes until they confirm with `scoring-final-confirm`.

## Then
Before confirming, `scoring-state` is still "Live". After confirming, `scoring-state` shows
"Final", the pill is `saved`, and a reload still shows "Final". `scoring-reopen` is NOT shown to
a scorekeeper (editor only). The public event page shows `event-state` "Final" with away R 1 and
the away line-score row `data-winner="true"`.
*/

import { test, expect } from "@playwright/test";
import {
  SCX_GAMES,
  cleanupScoringFixtures,
  expectPublicEvent,
  expectSaved,
  openScoringGame,
  resetScoringGame,
  seedScoringFixtures,
  signIn,
  type ScoringFixtures,
} from "../../support/scoring-fixtures";

let fx: ScoringFixtures;

test.describe("schedule-e2e-006 — final", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    fx = await seedScoringFixtures();
  });
  test.afterAll(async () => {
    await cleanupScoringFixtures();
  });
  test.beforeEach(async () => {
    await resetScoringGame(fx.gameIds.guest);
  });

  test("anon cannot open the game screen", async ({ page }) => {
    await page.goto(`/admin/scoring/${SCX_GAMES.guest.slug}`);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("scoring-final")).toHaveCount(0);
  });

  test("confirmed Final sets the game final, publicly", async ({ page }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");

    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await page.getByTestId("scoring-run-plus-away").click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("1");
    await expectSaved(page);

    // Cancelling the confirm leaves the game live (gap fix §6.1: scoring-final-cancel).
    await page.getByTestId("scoring-final").click();
    await expect(page.getByTestId("scoring-final-confirm")).toBeVisible();
    await page.getByTestId("scoring-final-cancel").click();
    await expect(page.getByTestId("scoring-final-confirm")).toHaveCount(0);
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);

    // Final asks for confirmation first.
    await page.getByTestId("scoring-final").click();
    const confirm = page.getByTestId("scoring-final-confirm");
    await expect(confirm).toBeVisible();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);

    await confirm.click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Final/);
    await expectSaved(page);
    await expect(page.getByTestId("scoring-reopen")).toHaveCount(0); // editor only

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-state")).toHaveText(/Final/);
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("1");
    await expect(page.getByTestId("scoring-reopen")).toHaveCount(0);

    await expectPublicEvent(page, "guest", async (detail) => {
      await expect(detail.getByTestId("event-state")).toHaveText(/Final/, { timeout: 1_000 });
      const away = detail.getByTestId("linescore").getByTestId("linescore-row-away");
      await expect(away.getByTestId("linescore-r")).toHaveText("1", { timeout: 1_000 });
      await expect(away).toHaveAttribute("data-winner", "true", { timeout: 1_000 });
    });
  });
});
