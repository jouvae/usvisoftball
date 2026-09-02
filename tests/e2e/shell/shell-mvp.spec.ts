/*
---
id: shell-mvp
name: "shell-mvp: MVP shell — nav, routing, redirects, feature flags"
feature: softball/shell
stack: web
priority: P0
status: green
group: A
references:
  - components/client/primary-nav.tsx
  - components/ui/nav-link.tsx
  - lib/flags.ts
  - next.config.ts
---

## Given
An anonymous visitor and the MVP shell: the nav is rebuilt to exactly Articles ·
About · Donate (Donate is an external PayPal CTA); the old /news feed moved to
/articles with permanent redirects; and Teams/Events are feature-flagged OFF, so
their routes return 404.

## When
The visitor loads `/`, browses articles, follows old /news links, and probes the
dormant Teams/Events routes.

## Then
The nav shows only the three MVP items and none of the removed ones; /articles
renders the feed and its detail pages; /news* redirects to /articles*; and the
flag-off Teams/Events routes return HTTP 404.
*/

import { test, expect } from "@playwright/test";
import { PAYPAL_DONATE_URL } from "@/lib/flags";

// The nav links are always attached, but they collapse behind the mobile toggle
// below the md breakpoint — so composition (count/href/attributes) is asserted
// on the attached elements, which holds at every viewport.
const PRESENT = ["nav-link-articles", "nav-link-about", "nav-link-donate"];
const REMOVED = [
  "nav-link-news",
  "nav-link-teams",
  "nav-link-events",
  "nav-link-shop",
];

// ---------------------------------------------------------------------------
// Nav composition on `/`.
// ---------------------------------------------------------------------------
test.describe("shell-mvp — primary nav", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows exactly Articles · About · Donate and none of the removed items", async ({
    page,
  }) => {
    for (const testId of PRESENT) {
      await expect(page.getByTestId(testId)).toHaveCount(1);
    }
    for (const testId of REMOVED) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }
  });

  test("internal nav links point at their routes; brand links home", async ({
    page,
  }) => {
    await expect(page.getByTestId("site-brand")).toHaveAttribute("href", "/");
    await expect(page.getByTestId("nav-link-articles")).toHaveAttribute(
      "href",
      "/articles",
    );
    await expect(page.getByTestId("nav-link-about")).toHaveAttribute(
      "href",
      "/about",
    );
  });

  test("Donate is an external new-tab anchor to PayPal", async ({ page }) => {
    const donate = page.getByTestId("nav-link-donate");
    await expect(donate).toHaveAttribute("href", PAYPAL_DONATE_URL);
    await expect(donate).toHaveAttribute("href", "https://www.paypal.com/donate");
    await expect(donate).toHaveAttribute("target", "_blank");
    // rel must include noopener (may also carry noreferrer) so the opened tab
    // cannot reach back through window.opener.
    await expect(donate).toHaveAttribute("rel", /noopener/);
  });
});

// ---------------------------------------------------------------------------
// Articles route — the relocated news feed + detail.
// ---------------------------------------------------------------------------
test.describe("shell-mvp — articles route", () => {
  test("/articles responds 200 and renders the feed", async ({ page }) => {
    const res = await page.goto("/articles");
    expect(res, "no response for /articles").not.toBeNull();
    expect(res!.status()).toBe(200);
    // Two published fixtures exist; the feed shows at least one card.
    await expect(page.getByTestId("article-card").first()).toBeVisible();
    expect(await page.getByTestId("article-card").count()).toBeGreaterThanOrEqual(
      1,
    );
  });

  test("clicking a card opens its /articles/<slug> detail page", async ({
    page,
  }) => {
    await page.goto("/articles");
    const firstCard = page.getByTestId("article-card").first();
    await expect(firstCard).toBeVisible();
    const slug = await firstCard.getAttribute("data-slug");
    expect(slug, "first card must expose a data-slug").toBeTruthy();

    await firstCard.getByTestId("article-card-link").click();

    await expect(page).toHaveURL(new RegExp(`/articles/${slug}$`));
    await expect(page.getByTestId("article-hero")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("/articles/does-not-exist returns 404", async ({ page }) => {
    const res = await page.goto("/articles/does-not-exist");
    expect(res, "no response for /articles/does-not-exist").not.toBeNull();
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("article-not-found")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Permanent redirects from the old /news* paths (next.config.ts).
// ---------------------------------------------------------------------------
test.describe("shell-mvp — legacy /news redirects", () => {
  test("/news redirects to /articles", async ({ page }) => {
    await page.goto("/news");
    await expect(page).toHaveURL(/\/articles$/);
    await expect(page.getByTestId("article-card").first()).toBeVisible();
  });

  test("/news/<slug> redirects to /articles/<slug>", async ({ page }) => {
    // Derive a real published slug from the live feed (first card).
    await page.goto("/articles");
    const slug = await page
      .getByTestId("article-card")
      .first()
      .getAttribute("data-slug");
    expect(slug, "first card must expose a data-slug").toBeTruthy();

    await page.goto(`/news/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/articles/${slug}$`));
    await expect(page.getByTestId("article-hero")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature flags OFF (default): the dormant sections 404.
// ---------------------------------------------------------------------------
test.describe("shell-mvp — dormant Teams/Events 404 (flags off)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      process.env.NEXT_PUBLIC_TEAMS_ENABLED === "true" ||
        process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true",
      "asserts the flag-OFF 404 behavior; a flag is enabled in this run",
    );
  });

  test("/teams returns 404 while TEAMS_ENABLED is off", async ({ page }) => {
    const res = await page.goto("/teams");
    expect(res, "no response for /teams").not.toBeNull();
    expect(res!.status()).toBe(404);
  });

  test("/events returns 404 while EVENTS_ENABLED is off", async ({ page }) => {
    const res = await page.goto("/events");
    expect(res, "no response for /events").not.toBeNull();
    expect(res!.status()).toBe(404);
  });
});
