/*
---
id: schedule-e2e-002
name: "schedule-e2e-002: live line score — start, +1 away twice in inning 1, next inning, +1 home"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6, §6.1 (set ops, testids)
  - docs/features/softball/schedule/scenarios.md S4
  - app/admin/(protected)/scoring/[slug]/page.tsx, app/admin/(protected)/scoring/actions.ts
  - app/(public)/events/[slug]/page.tsx (LineScore, event-state)
  - tests/support/scoring-fixtures.ts
---

## Given
A signed-in `scorekeeper` and the PREGAME fixture guest game (Colombia @ Mexico, 2099), reset to
no innings / zero H-E before each run.

## When
They open `/admin/scoring/{slug}`, tap `scoring-start`, tap `scoring-run-plus-away` twice
(inning 1), tap `scoring-next-inning`, then `scoring-run-plus-home` once (inning 2).

## Then
The scoreboard shows `scoring-state` "Live", `scoring-inning` 2, `scoring-runs-away` 2,
`scoring-runs-home` 1, and `scoring-sync-status` returns to `data-state="saved"` ("Saved ✓").
A reload of the scoring screen shows the same values (persisted, not just optimistic).
The public `/events/{slug}` shows `event-state` "Live", `linescore-row-away` `linescore-r` 2 and
`linescore-row-home` `linescore-r` 1.
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

test.describe("schedule-e2e-002 — live line score", () => {
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
    await expect(page.getByTestId("scoring-start")).toHaveCount(0);
  });

  test("start, score both sides across two innings, public page shows live 2–1", async ({
    page,
  }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");

    await expect(page.getByTestId("scoring-state")).toHaveText(/Pregame/);
    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expect(page.getByTestId("scoring-inning")).toContainText("1");

    await page.getByTestId("scoring-run-plus-away").click();
    await page.getByTestId("scoring-run-plus-away").click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("0");

    await page.getByTestId("scoring-next-inning").click();
    await expect(page.getByTestId("scoring-inning")).toContainText("2");
    await page.getByTestId("scoring-run-plus-home").click();
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("1");
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");

    await expectSaved(page);

    // Persisted, not just optimistic.
    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);
    await expect(page.getByTestId("scoring-inning")).toContainText("2");
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("2");
    await expect(page.getByTestId("scoring-runs-home")).toHaveText("1");

    await expectPublicEvent(page, "guest", async (detail) => {
      await expect(detail.getByTestId("event-state")).toHaveText(/Live/, { timeout: 1_000 });
      const ls = detail.getByTestId("linescore");
      await expect(
        ls.getByTestId("linescore-row-away").getByTestId("linescore-r"),
      ).toHaveText("2", { timeout: 1_000 });
      await expect(
        ls.getByTestId("linescore-row-home").getByTestId("linescore-r"),
      ).toHaveText("1", { timeout: 1_000 });
      // Gap fix (§6.1): per-inning cells are linescore-inning[data-inning].
      await expect(
        ls.getByTestId("linescore-row-away").locator('[data-testid="linescore-inning"][data-inning="1"]'),
      ).toHaveText("2", { timeout: 1_000 });
      await expect(
        ls.getByTestId("linescore-row-home").locator('[data-testid="linescore-inning"][data-inning="2"]'),
      ).toHaveText("1", { timeout: 1_000 });
    });
  });

  test("minus never goes below zero", async ({ page }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "guest");
    await page.getByTestId("scoring-start").click();
    await expect(page.getByTestId("scoring-state")).toHaveText(/Live/);

    await page.getByTestId("scoring-run-plus-away").click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("1");
    await page.getByTestId("scoring-run-minus-away").click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("0");
    // At zero the minus is a no-op (disabled or ignored) — never negative.
    const minus = page.getByTestId("scoring-run-minus-away");
    if (await minus.isEnabled()) await minus.click();
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("0");
    await expectSaved(page);

    await page.reload();
    await expectSaved(page);
    await expect(page.getByTestId("scoring-runs-away")).toHaveText("0");
  });
});
