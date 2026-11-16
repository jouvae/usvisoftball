/*
---
id: schedule-e2e-005
name: "schedule-e2e-005: lineup + box score — checklist creates lines; AB 3 / H 1 / RBI 1 shows publicly; H > AB blocked"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S4
references:
  - docs/features/softball/schedule/overview.md §6 (3–5), §6.1 (Lineup, Box score testids)
  - docs/features/softball/schedule/scenarios.md S4
  - lib/schedule-view.ts (validateStatLine messages)
  - app/(public)/events/[slug]/page.tsx (BoxScore)
  - tests/support/scoring-fixtures.ts
---

## Given
A signed-in `scorekeeper` on the PREGAME fixture USVI game (Colombia @ E2E Scoring USVI; USVI has
2 ACTIVE players + 1 inactive), reset to no stat lines.

## When
They open `scoring-tab-lineup`: the checklist lists only the active players, all pre-checked
(no lines yet). They `lineup-save` (two zero lines), then uncheck Player Two (a zero line — a
scorekeeper may remove it since 0028, no `lineup-error`) and `lineup-save` again. On `scoring-tab-boxscore` they open
Player One (`boxscore-edit-player` → `stat-sheet`), first try `stat-h-plus` at AB 0, then tap
AB +3, H +1, RBI +1.

## Then
Only Player One has a box-score row (after a reload). The stat sheet lists batting steppers
AB, H, R, RBI, BB, SO, 2B, 3B, HR, SB in that order. The H tap at AB 0 is refused: `stat-h-value` stays 0 and
`stat-error` says "Hits can't be more than at-bats." Afterwards AB 3 / H 1 / RBI 1 are shown,
saved, and survive a reload. With the USVI scoreboard at 0 hits, `scoring-hits-mismatch` is
shown; one `scoring-hits-plus-home` tap clears it. Unchecking Player One (who has stats) is
refused with `lineup-error`. The public event page's `boxscore` lists
Player One and not Player Two.
*/

import { test, expect, type Page } from "@playwright/test";
import {
  SCX_GAMES,
  SCX_PLAYERS,
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

const byPlayer = (page: Page, testId: string, playerId: string) =>
  page.getByTestId(testId).and(page.locator(`[data-player-id="${playerId}"]`));

async function openPlayerSheet(page: Page, playerId: string) {
  await page.getByTestId("scoring-tab-boxscore").click();
  await byPlayer(page, "boxscore-edit-player", playerId).click();
  const sheet = page.getByTestId("stat-sheet");
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("schedule-e2e-005 — lineup + box score", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    fx = await seedScoringFixtures();
  });
  test.afterAll(async () => {
    await cleanupScoringFixtures();
  });
  test.beforeEach(async () => {
    await resetScoringGame(fx.gameIds.usvi);
  });

  test("anon cannot open the USVI game screen", async ({ page }) => {
    await page.goto(`/admin/scoring/${SCX_GAMES.usvi.slug}`);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("lineup-player")).toHaveCount(0);
  });

  test("lineup creates lines for checked players; box score entry shows publicly; H > AB is blocked", async ({
    page,
  }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "usvi");

    // ── Lineup ────────────────────────────────────────────────────────────────
    await page.getByTestId("scoring-tab-lineup").click();
    const players = page.getByTestId("lineup-player");
    await expect(players).toHaveCount(2); // active roster only
    await expect(byPlayer(page, "lineup-player", fx.playerIds.one)).toBeChecked();
    await expect(byPlayer(page, "lineup-player", fx.playerIds.two)).toBeChecked();
    await expect(byPlayer(page, "lineup-player", fx.playerIds.benched)).toHaveCount(0);

    // Save both (two zero lines), then take Player Two off again. Polish (0028): a
    // SCOREKEEPER may now remove a saved all-zero line (was editor-only, refused with
    // lineup-error); a line with stats is still refused (asserted further down).
    await page.getByTestId("lineup-save").click();
    await expectSaved(page);
    await page.getByTestId("scoring-tab-boxscore").click();
    await expect(page.getByTestId("boxscore-edit-player")).toHaveCount(2);

    await page.getByTestId("scoring-tab-lineup").click();
    await expect(byPlayer(page, "lineup-player", fx.playerIds.two)).toBeChecked();
    await byPlayer(page, "lineup-player", fx.playerIds.two).uncheck();
    await expect(page.getByTestId("lineup-error")).toHaveCount(0);
    await expect(byPlayer(page, "lineup-player", fx.playerIds.two)).not.toBeChecked();
    await page.getByTestId("lineup-save").click();
    await expectSaved(page);

    // ── Box score: only the checked player has a line (persisted server-side) ──
    await page.reload();
    await expectSaved(page);
    await page.getByTestId("scoring-tab-boxscore").click();
    await expect(page.getByTestId("boxscore-edit-player")).toHaveCount(1);
    await expect(byPlayer(page, "boxscore-edit-player", fx.playerIds.one)).toBeVisible();

    const sheet = await openPlayerSheet(page, fx.playerIds.one);
    await expect(sheet.getByTestId("stat-ab-value")).toHaveText("0");

    // Polish: batting steppers in scorebook order — AB H R RBI BB SO, then 2B 3B HR SB.
    const batting = ["ab", "h", "r", "rbi", "bb", "so", "doubles", "triples", "hr", "sb"];
    const valueIds = await sheet
      .locator('[data-testid^="stat-"][data-testid$="-value"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
    expect(valueIds.filter((id) => batting.some((k) => id === `stat-${k}-value`))).toEqual(
      batting.map((k) => `stat-${k}-value`),
    );

    // H above AB is refused with a plain-language hint.
    await sheet.getByTestId("stat-h-plus").click();
    await expect(sheet.getByTestId("stat-h-value")).toHaveText("0");
    await expect(sheet.getByTestId("stat-error")).toBeVisible();
    await expect(sheet.getByTestId("stat-error")).toContainText("Hits can't be more than at-bats.");

    for (let i = 0; i < 3; i++) await sheet.getByTestId("stat-ab-plus").click();
    await sheet.getByTestId("stat-h-plus").click();
    await sheet.getByTestId("stat-rbi-plus").click();
    await expect(sheet.getByTestId("stat-ab-value")).toHaveText("3");
    await expect(sheet.getByTestId("stat-h-value")).toHaveText("1");
    await expect(sheet.getByTestId("stat-rbi-value")).toHaveText("1");
    await expectSaved(page);

    // ── Persisted: reload and reopen the sheet ────────────────────────────────
    await page.reload();
    await expectSaved(page);
    const sheet2 = await openPlayerSheet(page, fx.playerIds.one);
    await expect(sheet2.getByTestId("stat-ab-value")).toHaveText("3");
    await expect(sheet2.getByTestId("stat-h-value")).toHaveText("1");
    await expect(sheet2.getByTestId("stat-rbi-value")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("stat-sheet")).toHaveCount(0);

    // ── Consistency hint: scoreboard USVI hits (0) ≠ box-score H (1) ──────────
    await page.getByTestId("scoring-tab-scoreboard").click();
    await expect(page.getByTestId("scoring-hits-mismatch")).toBeVisible();
    await page.getByTestId("scoring-hits-plus-home").click(); // USVI is home
    await expect(page.getByTestId("scoring-hits-home")).toHaveText("1");
    await expect(page.getByTestId("scoring-hits-mismatch")).toHaveCount(0);
    await expectSaved(page);

    // ── Lineup: a player with stats can't be unchecked (lineup-error hint) ──────
    await page.getByTestId("scoring-tab-lineup").click();
    await byPlayer(page, "lineup-player", fx.playerIds.one).click();
    await expect(page.getByTestId("lineup-error")).toBeVisible();
    await expect(byPlayer(page, "lineup-player", fx.playerIds.one)).toBeChecked();

    // ── Public box score ─────────────────────────────────────────────────────
    await expectPublicEvent(page, "usvi", async (detail) => {
      const box = detail.getByTestId("boxscore");
      await expect(box).toBeVisible({ timeout: 1_000 });
      await expect(box).toContainText(SCX_PLAYERS.one.name, { timeout: 1_000 });
      await expect(box).not.toContainText(SCX_PLAYERS.two.name, { timeout: 1_000 });
      // Gap fix (§6.1): rows are boxscore-row[data-player-id] with per-stat cells.
      const rowOne = box
        .getByTestId("boxscore-row")
        .and(detail.locator(`[data-player-id="${fx.playerIds.one}"]`));
      await expect(rowOne).toHaveCount(1, { timeout: 1_000 });
      await expect(rowOne.getByTestId("boxscore-ab")).toHaveText("3", { timeout: 1_000 });
      await expect(rowOne.getByTestId("boxscore-h")).toHaveText("1", { timeout: 1_000 });
      await expect(rowOne.getByTestId("boxscore-rbi")).toHaveText("1", { timeout: 1_000 });
      await expect(
        box.getByTestId("boxscore-row").and(detail.locator(`[data-player-id="${fx.playerIds.two}"]`)),
      ).toHaveCount(0, { timeout: 1_000 });
    });
  });

  test("pitching section records outs as innings pitched", async ({ page }) => {
    await signIn(page, fx.users.scorekeeper, /\/admin\/scoring$/);
    await openScoringGame(page, "usvi");
    await page.getByTestId("scoring-tab-lineup").click();
    await page.getByTestId("lineup-save").click(); // both pre-checked → two zero lines
    await expectSaved(page);

    const sheet = await openPlayerSheet(page, fx.playerIds.two);
    await sheet.getByTestId("stat-pitching-toggle").click();
    for (let i = 0; i < 4; i++) await sheet.getByTestId("stat-outs-plus").click();
    // 4 outs → "1⅓" IP via formatInningsPitched.
    await expect(sheet.getByTestId("stat-outs-value")).toContainText("1⅓");
    await expectSaved(page);

    await page.reload();
    await expectSaved(page);
    const sheet2 = await openPlayerSheet(page, fx.playerIds.two);
    await expect(sheet2.getByTestId("stat-outs-value")).toContainText("1⅓");
  });
});
