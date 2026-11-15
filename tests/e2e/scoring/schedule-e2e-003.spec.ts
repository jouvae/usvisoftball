/*
---
id: schedule-e2e-003
name: "schedule-e2e-003: undo — after two +1 taps, Undo leaves one run saved (reload confirms)"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6.1 (Undo = push a set op restoring the previous value)
  - docs/features/softball/schedule/scenarios.md S4
  - app/admin/(protected)/scoring/[slug]/page.tsx
  - tests/support/scoring-fixtures.ts
---

## Given
A signed-in `scorekeeper` on the fixture guest game (reset to pregame), game started (live,
inning 1). `scoring-undo` is disabled before any tap.

## When
They tap `scoring-run-plus-away` twice, then `scoring-undo` once.

## Then
`scoring-runs-away` shows 1, the pill returns to `data-state="saved"`, and after a reload the
scoring screen still shows 1 (the undo was persisted as a set op, not just a local rollback).
The public event page shows away R 1.
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

test.describe("schedule-e2e-003 — undo", () => {
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
    await expect(page.getByTestId("scoring-undo")).toHaveCount(0);
  });

  test("undo after two +1 taps leaves one run, persisted", async ({ page }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");

    const undo = page.getByTestId("scoring-undo");
    await expect(undo).toBeDisabled();

    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expect(undo).toBeEnabled();

    await page.getByTestId("scoring-run-plus-away").click();
    await page.getByTestId("scoring-run-plus-away").click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");

    await undo.click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("1");
    // Undo only reverts the last tap — the game is still live.
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expectSaved(page);

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("1");
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);

    await expectPublicEvent(page, "guest", async (detail) => {
      await expect(
        detail.getByTestId("linescore").getByTestId("linescore-row-away").getByTestId("linescore-r"),
      ).toHaveText("1", { timeout: 1_000 });
    });
  });

  test("undo also reverts an H/E stepper tap", async ({ page }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");
    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);

    await page.getByTestId("scoring-hits-plus-home").click();
    await page.getByTestId("scoring-errors-plus-home").click();
    await expect(page.getByTestId("scoring-hits-home")).toHaveText("1");
    await expect(page.getByTestId("scoring-errors-home")).toHaveText("1");

    await page.getByTestId("scoring-undo").click();
    await expect(page.getByTestId("scoring-errors-home")).toHaveText("0");
    await expect(page.getByTestId("scoring-hits-home")).toHaveText("1");
    await expectSaved(page);

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-hits-home")).toHaveText("1");
    await expect(page.getByTestId("scoring-errors-home")).toHaveText("0");
  });
});
