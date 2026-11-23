/*
---
id: home-feed-web
name: "home-feed-web-001..005, 010..012: ESPN-style home feed + Phase B fixes"
feature: softball/home-feed
stack: web
priority: P0
references:
  - app/(public)/page.tsx
  - components/client/home-feed-list.tsx
  - components/ui/feed-story.tsx
  - components/ui/highlights-rail.tsx
  - app/api/feed/route.ts
  - components/ui/nav-link.tsx
  - app/(public)/about/page.tsx
  - app/(public)/teams/[slug]/page.tsx
---

Scenarios: docs/features/softball/home-feed/scenarios.md.

READ-ONLY against real data: these specs seed nothing and write nothing (the shared DB is
production). They derive counts from the DOM/API instead of hardcoding them, except where a
scenario names real content (the two national teams). Teams pages need
NEXT_PUBLIC_TEAMS_ENABLED=true; those cases skip otherwise.
*/

import { test, expect, type Page } from "@playwright/test";

const TEAMS_ON = process.env.NEXT_PUBLIC_TEAMS_ENABLED === "true";

async function scrollFeedToEnd(page: Page) {
  // Scroll in steps until the feed reports its end (auto-load is capped, so click the button
  // whenever it is the only way on).
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId("feed-end").isVisible()) return;
    const more = page.getByTestId("feed-load-more");
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(250);
    if ((await more.count()) && (await more.isEnabled()) && i > 4) await more.click();
  }
}

test.describe("home-feed-web-001 layout (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop layout");

  test("no hero; lead first; rail to the right and sticky", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toHaveCount(0);
    const lead = page.getByTestId("home-lead");
    await expect(lead).toBeVisible();
    await expect(lead.getByTestId("home-lead-link")).toHaveCount(1);

    const rail = page.getByTestId("home-highlights");
    await expect(rail).toBeVisible();
    const [l, r] = [await lead.boundingBox(), await rail.boundingBox()];
    expect(r!.x).toBeGreaterThan(l!.x + l!.width - 1);

    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(300);
    const after = await rail.boundingBox();
    expect(after!.y).toBeGreaterThanOrEqual(0);
    expect(after!.y).toBeLessThan(200);
    const leadAfter = await lead.boundingBox();
    expect(leadAfter!.y + leadAfter!.height).toBeLessThan(0);
  });
});

test.describe("home-feed-web-002 infinite scroll", () => {
  test("first page of 8, more on scroll, each story once, then the end", async ({ page, request }) => {
    await page.goto("/");
    const rows = page.getByTestId("feed-story");
    const first = await rows.count();
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(8);

    await scrollFeedToEnd(page);
    await expect(page.getByTestId("feed-end")).toBeVisible();
    await expect(page.getByTestId("feed-load-more")).toHaveCount(0);

    const slugs = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));
    expect(new Set(slugs).size).toBe(slugs.length);
    const lead = await page.getByTestId("home-lead").getAttribute("data-slug");
    expect(slugs).not.toContain(lead);
    if (first === 8) expect(slugs.length).toBeGreaterThan(8);

    // Every published story is on the page exactly once (lead + feed). The API's "newer than
    // the epoch" read returns up to 20 published stories — enough for today's catalogue.
    const res = await request.get(`/api/feed?since=${encodeURIComponent("1970-01-01T00:00:00Z")}`);
    const { stories } = (await res.json()) as { stories: { slug: string }[] };
    if (stories.length < 20) expect(slugs.length + 1).toBe(stories.length);
  });

  test("the load-more control is a real button", async ({ page }) => {
    await page.goto("/");
    const more = page.getByTestId("feed-load-more");
    if (await more.count()) {
      await expect(more).toHaveJSProperty("tagName", "BUTTON");
      await expect(more).toHaveAttribute("type", "button");
    }
  });

  test("the API rejects a forged cursor", async ({ request }) => {
    expect((await request.get("/api/feed?cursor=bogus")).status()).toBe(400);
    expect((await request.get("/api/feed?cursor=MTk3MHwx&exclude=x")).status()).toBe(400);
  });
});

test.describe("home-feed-web-003 mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");

  test("lead, then a horizontal highlights strip, then stories; no page overflow", async ({ page }) => {
    await page.goto("/");
    const lead = await page.getByTestId("home-lead").boundingBox();
    const rail = await page.getByTestId("home-highlights").boundingBox();
    const feed = await page.getByTestId("home-feed").boundingBox();
    expect(rail!.y).toBeGreaterThan(lead!.y);
    expect(feed!.y).toBeGreaterThan(rail!.y);

    const list = page.getByTestId("home-highlights-list");
    const [sw, cw] = await list.evaluate((el) => [el.scrollWidth, el.clientWidth]);
    if ((await page.getByTestId("highlight-item").count()) > 1) expect(sw).toBeGreaterThan(cw);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("home-feed-web-004 Spanish", () => {
  test("/es is Spanish with /es links and no English section headings", async ({ page }) => {
    await page.goto("/es");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator("#home-latest-heading")).toHaveText("Lo último");
    await expect(page.locator("#home-highlights-heading")).toHaveText("Destacados");

    const storyHrefs = await page
      .getByTestId("feed-story-link")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    for (const href of storyHrefs) expect(href).toMatch(/^\/es\/articles\//);
    await expect(page.getByTestId("home-lead-link")).toHaveAttribute("href", /^\/es\/articles\//);

    const teamHrefs = await page
      .getByTestId("home-team-link")
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    for (const href of teamHrefs) expect(href).toMatch(/^\/es\/teams\//);

    const main = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const english of ["Latest", "Highlights", "Our Teams", "Get Involved", "Load more"]) {
      expect(main).not.toContain(english);
    }
  });
});

test.describe("home-feed-web-005 highlights", () => {
  test("a final shows the result and links to its game", async ({ page, isMobile }) => {
    test.skip(isMobile, "same markup on phones");
    await page.goto("/");
    const items = page.getByTestId("highlight-item");
    expect(await items.count()).toBeGreaterThan(0);
    const final = page.locator('[data-testid="highlight-item"][data-kind="game_final"]').first();
    await expect(final).toContainText("Final");
    await expect(final.getByTestId("highlight-score")).toHaveText(/\D+ \d+, \D+ \d+/);
    await expect(final.getByTestId("highlight-link")).toHaveAttribute("href", /^\/events\/[a-z0-9-]+$/);
  });
});

test.describe("home-feed Phase B", () => {
  test("home-feed-web-010: the Spanish Support link reads its label once", async ({ page }) => {
    await page.goto("/es");
    const text = await page.getByTestId("nav-link-donate").evaluate((el) => el.textContent?.trim());
    expect(text).toBe("Apoya a la Federación");
  });

  test("home-feed-web-011: no placeholder FAQ on /about", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByTestId("about-faq")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Placeholder answer");
  });

  test("home-feed-web-012: empty roster block hidden; blank B/T column hidden", async ({ page }) => {
    test.skip(!TEAMS_ON, "teams flag off");
    await page.goto("/teams/u18-girls-national-team");
    await expect(page.getByRole("heading", { name: "Roster" })).toHaveCount(0);
    await expect(page.getByTestId("team-roster")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Roster coming soon");

    await page.goto("/teams/womens-national-team");
    await expect(page.getByTestId("team-roster")).toBeVisible();
    await expect(page.getByTestId("player-bt")).toHaveCount(0);
    await expect(page.getByTestId("team-roster").locator("th", { hasText: "B/T" })).toHaveCount(0);
  });
});
