/*
---
id: scoreboard-web
name: "scoreboard-web-001..004: the game Scoreboard on a linked article"
feature: softball/scoreboard
stack: web
priority: P0
references:
  - components/ui/scoreboard.tsx
  - app/(public)/articles/[slug]/page.tsx
---

Scenarios: docs/features/softball/scoreboard/scenarios.md.

READ-ONLY against real data (the shared DB is production): seeds and writes nothing. Uses the
real USVI–Mexico recap (Pan Am 2026, total-only final 5–8, with standouts).
*/

import { test, expect } from "@playwright/test";

const RECAP = "/articles/team-usvi-battles-mexico-in-group-c-finale-falls-8-5";

test.describe("scoreboard-web", () => {
  test("scoreboard-web-001: a linked recap opens with the final score, winner marked", async ({ page }) => {
    await page.goto(RECAP);
    const board = page.getByTestId("scoreboard");
    await expect(board).toHaveAttribute("data-status", "final");
    await expect(page.getByTestId("scoreboard-summary")).toHaveText(
      "Final: U.S. Virgin Islands 5, Mexico 8.",
    );
    // Above the cover photo: the result is the first thing after the byline.
    const boardBox = await board.boundingBox();
    const heroBox = await page.locator("article img").first().boundingBox();
    expect(boardBox!.y).toBeLessThan(heroBox!.y);
  });

  test("scoreboard-web-002: by the numbers — only recorded stats, as a real table", async ({ page }) => {
    await page.goto(RECAP);
    const table = page.getByTestId("scoreboard-comparison");
    await expect(table.locator("tbody tr")).toHaveCount(4); // runs, hits, walks, strikeouts — no 0–0 errors
    const row = (k: string) => table.locator(`tr[data-stat="${k}"] td`);
    await expect(row("runs")).toHaveText(["5", "8"]);
    await expect(row("hits")).toHaveText(["10", "9"]);
    await expect(row("walks")).toHaveText(["3", "8"]);
    await expect(row("strikeouts")).toHaveText(["7", "6"]);
    await expect(table.locator('tr[data-stat="errors"]')).toHaveCount(0);
    // No inning breakdown recorded → no line score.
    await expect(page.getByTestId("linescore")).toHaveCount(0);
  });

  test("scoreboard-web-003: standouts — the two awards, then the rest", async ({ page }) => {
    await page.goto(RECAP);
    const awards = page.getByTestId("standout-award");
    await expect(awards).toHaveCount(2);
    await expect(awards.nth(0)).toHaveAttribute("data-kind", "player_of_game");
    await expect(awards.nth(0)).toContainText("Avery Houseton");
    await expect(awards.nth(1)).toContainText("Amanda Thompson");
    await expect(page.getByTestId("standout")).toHaveCount(4);
  });

  test("scoreboard-web-004: Spanish, and no sideways scroll", async ({ page }) => {
    await page.goto(`/es${RECAP}`);
    await expect(page.getByTestId("scoreboard-summary")).toHaveText(
      "Final: Islas Vírgenes de EE. UU. 5, México 8.",
    );
    await expect(page.getByTestId("scoreboard-details")).toContainText("En números");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
