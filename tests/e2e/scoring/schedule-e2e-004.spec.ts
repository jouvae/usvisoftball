/*
---
id: schedule-e2e-004
name: "schedule-e2e-004: offline queue — taps show 'Offline — will sync', replay in order when back online"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6.1 (localStorage FIFO queue, seq, absolute set ops)
  - docs/features/softball/schedule/scenarios.md S4
  - lib/scoring-view.ts (createOpQueue, applyOp)
  - tests/support/scoring-fixtures.ts
---

## Given
A signed-in `scorekeeper` on the fixture guest game (reset), started while online (live,
inning 1) and fully saved.

## When
The browser context goes offline (`context.setOffline(true)`); they tap +1 run away three
times, −1 run away once, and +1 hit away; then the context goes back online.

## Then
While offline the taps apply optimistically (`scoring-runs-away` 2, `scoring-hits-away` 1) and
`scoring-sync-status` has `data-state="offline"` with "Offline — will sync". Back online the
queue replays IN ORDER (set 1, 2, 3, 2 — any reordering that ends on "3" is caught) and the pill
returns to `saved`. A reload shows away R 2, H 1; the public event page shows away R 2, H 1.
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

test.describe("schedule-e2e-004 — offline queue", () => {
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
    await expect(page.getByTestId("scoring-sync-status")).toHaveCount(0);
  });

  test("offline taps queue, then sync in order when back online", async ({ page, context }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");

    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expectSaved(page);

    const pill = page.getByTestId("scoring-sync-status");
    try {
      await context.setOffline(true);

      await page.getByTestId("scoring-run-plus-away").click();
      await page.getByTestId("scoring-run-plus-away").click();
      await page.getByTestId("scoring-run-plus-away").click();
      await page.getByTestId("scoring-run-minus-away").click();
      await page.getByTestId("scoring-hits-plus-away").click();

      // Optimistic local state while offline.
      await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");
      await expect(page.getByTestId("scoring-hits-away")).toHaveText("1");
      await expect(pill).toHaveAttribute("data-state", "offline", { timeout: 15_000 });
      await expect(pill).toContainText("Offline — will sync");
    } finally {
      await context.setOffline(false);
    }

    await expectSaved(page, 30_000);
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");
    await expect(page.getByTestId("scoring-hits-away")).toHaveText("1");

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");
    await expect(page.getByTestId("scoring-hits-away")).toHaveText("1");
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("0");

    await expectPublicEvent(page, "guest", async (detail) => {
      const away = detail.getByTestId("linescore").getByTestId("linescore-row-away");
      await expect(away.getByTestId("linescore-r")).toHaveText("2", { timeout: 1_000 });
      await expect(away.getByTestId("linescore-h")).toHaveText("1", { timeout: 1_000 });
    });
  });

  test("taps queued offline survive a reload and replay once online", async ({ page, context }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");
    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expectSaved(page);

    try {
      await context.setOffline(true);
      await page.getByTestId("scoring-run-plus-home").click();
      await expect(page.getByTestId("scoring-runs-home")).toHaveText("1");
      await expect(page.getByTestId("scoring-sync-status")).toHaveAttribute(
        "data-state",
        "offline",
        { timeout: 15_000 },
      );
    } finally {
      await context.setOffline(false);
    }
    // Reload immediately: the pending op lives in localStorage and must replay on load.
    await page.reload();
    await expectSaved(page, 30_000);
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("1");

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("1");
  });
});
