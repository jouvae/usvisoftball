/*
---
id: schedule-web-030
name: "schedule-web-030: event detail sections are in the same order in page, modal and drawer"
feature: softball/schedule
stack: web
priority: P1
status: red
group: polish
references:
  - docs/features/softball/schedule/overview.md §5 (event sections, top to bottom)
  - docs/features/softball/schedule/status.md "Polish backlog"
  - components/ui/event-detail.tsx
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures: the PREGAME USVI game (stream URL, roster, empty line score) and the FINAL
USVI game (line score, box score, roster).

## When
A visitor opens each event in-site (modal on desktop, drawer on mobile) and by direct load (page).

## Then
Every `[data-section]` in `event-detail` appears in this order, both in the DOM and on screen
(top → bottom): header → when-where → watch-live → linescore → boxscore → roster. Sections that
don't apply are absent, never reordered. "Add to calendar" and "Share" live inside when-where;
the stream link lives inside watch-live.
*/

import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  SFX_EVENTS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
const ORDER = ["header", "when-where", "watch-live", "linescore", "boxscore", "roster"];

const isMobile = (info: TestInfo) => info.project.name === "mobile";

async function openInSite(page: Page, info: TestInfo, slug: string): Promise<Locator> {
  const res = await page.goto("/events");
  expect(res!.status()).toBe(200);
  await page.locator(`[data-testid="event-row"][data-slug="${slug}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/events/${slug}$`));
  const ov = page.getByTestId(isMobile(info) ? "event-drawer" : "event-modal");
  await expect(ov).toBeVisible();
  const detail = ov.getByTestId("event-detail");
  await expect(detail).toHaveAttribute("data-presentation", isMobile(info) ? "drawer" : "modal");
  return detail;
}

async function openPage(page: Page, slug: string): Promise<Locator> {
  const res = await page.goto(`/events/${slug}`);
  expect(res!.status()).toBe(200);
  const detail = page.getByTestId("event-detail");
  await expect(detail).toHaveAttribute("data-presentation", "page");
  return detail;
}

// DOM order AND on-screen order (CSS `order`/grid can reorder visually without moving the DOM).
async function expectSectionOrder(detail: Locator, expected: string[]) {
  // The expectation itself must be a subsequence of the canonical order.
  expect(expected).toEqual(ORDER.filter((n) => expected.includes(n)));
  const sections = await detail.locator("[data-section]").evaluateAll((els) =>
    els.map((e) => ({
      name: e.getAttribute("data-section") ?? "",
      top: e.getBoundingClientRect().top,
    })),
  );
  expect(sections.map((s) => s.name), "DOM order").toEqual(expected);
  const byTop = [...sections].sort((a, b) => a.top - b.top).map((s) => s.name);
  expect(byTop, "visual (top → bottom) order").toEqual(expected);
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-030 — one section order in every presentation", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  const PREGAME = ["header", "when-where", "watch-live", "linescore", "roster"];
  const FINAL = ["header", "when-where", "linescore", "boxscore", "roster"];

  test("pregame USVI game — in-site overlay (modal desktop / drawer mobile)", async ({
    page,
  }, info) => {
    const detail = await openInSite(page, info, SFX_EVENTS.usviPregame.slug);
    await expectSectionOrder(detail, PREGAME);
    const when = detail.locator('[data-section="when-where"]');
    await expect(when.getByTestId("event-detail-ics")).toHaveCount(1);
    await expect(when.getByTestId("event-share")).toHaveCount(1);
    await expect(
      detail.locator('[data-section="watch-live"]').getByTestId("event-detail-stream"),
    ).toHaveCount(1);
  });

  test("final USVI game — in-site overlay (modal desktop / drawer mobile)", async ({
    page,
  }, info) => {
    const detail = await openInSite(page, info, SFX_EVENTS.usviFinal.slug);
    await expectSectionOrder(detail, FINAL);
  });

  test("direct load (page) uses the same order", async ({ page }) => {
    await expectSectionOrder(await openPage(page, SFX_EVENTS.usviPregame.slug), PREGAME);
    await expectSectionOrder(await openPage(page, SFX_EVENTS.usviFinal.slug), FINAL);
  });
});
