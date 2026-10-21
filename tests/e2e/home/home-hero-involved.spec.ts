/*
---
id: home-hero-involved
name: "home-hero-involved: home hero, Get Involved section, /get-involved page, crest overhang (home-layout slice 2)"
feature: softball/home-layout
stack: web
priority: P0
group: A
references:
  - app/(public)/page.tsx
  - app/(public)/get-involved/page.tsx
  - components/ui/home-hero.tsx
  - components/ui/get-involved.tsx
  - components/client/sticky-header.tsx
  - components/ui/site-brand.tsx
  - docs/features/softball/home-layout/design-guide.md
---

## Given
The home renders <HomeHero> (data-testid home-hero) and <GetInvolvedSection>
(home-involved). The hero has one <h1> whose accessible name is the full federation name
(visible "SOFTBALL / FEDERATION" + sr-only "U.S. Virgin Islands"), the tagline, and at most
two CTAs. While TEAMS/EVENTS flags are off (.env.local) the CTAs fall back to News
(hero-articles-cta → /articles) and Get Involved (hero-involved-cta → /get-involved). The
section has three audience cards (involved-card-{athletes|volunteers|support}), each with ONE
link (involved-cta-*). /get-involved has three anchored sections. The sticky header carries
data-hero="true" only on "/" at scroll-top.

## When
(1) An anonymous visitor loads "/". (2) They load "/get-involved". (3) On desktop they
scroll the home page, and they load /articles.

## Then
(1) Exactly one h1, named "U.S. Virgin Islands Softball Federation"; the tagline reads
"From the Virgin Islands to the World."; ≤2 hero CTAs with the fallback hrefs; no Support CTA
in the hero; three involved cards, each with exactly one link — internal ones point at
/get-involved#athletes / #volunteers, the support one is an external PayPal anchor
(target=_blank, rel noopener) announced as "opens PayPal"; the section link names its
destination and points at /get-involved. (2) The page responds 200 with an h1 "Get Involved"
and sections #athletes, #volunteers, #support. (3) data-hero is "true" at top, "false" after
scrolling, and "false" on /articles.
*/

import { test, expect } from "@playwright/test";
import { PAYPAL_DONATE_URL } from "@/lib/flags";

test.describe("home-hero-involved — hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("one h1 carrying the full federation name, plus the tagline", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "U.S. Virgin Islands Softball Federation",
    );
    await expect(page.getByTestId("home-hero-tagline")).toHaveText(
      "From the Virgin Islands to the World.",
    );
  });

  test("at most two CTAs, flag-off fallbacks, and no Support CTA in the hero", async ({
    page,
  }) => {
    const hero = page.getByTestId("home-hero");
    await expect(hero.getByRole("link")).toHaveCount(2);
    await expect(page.getByTestId("hero-articles-cta")).toHaveAttribute("href", "/articles");
    await expect(page.getByTestId("hero-involved-cta")).toHaveAttribute(
      "href",
      "/get-involved",
    );
    await expect(hero.locator(`a[href="${PAYPAL_DONATE_URL}"]`)).toHaveCount(0);
  });
});

test.describe("home-hero-involved — Get Involved section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("three audience cards, one link each, pointing at their destinations", async ({
    page,
  }) => {
    const expected = {
      athletes: "/get-involved#athletes",
      volunteers: "/get-involved#volunteers",
      support: PAYPAL_DONATE_URL,
    } as const;
    for (const [id, href] of Object.entries(expected)) {
      const card = page.getByTestId(`involved-card-${id}`);
      await expect(card.getByRole("link")).toHaveCount(1);
      await expect(page.getByTestId(`involved-cta-${id}`)).toHaveAttribute("href", href);
    }
  });

  test("the support card opens PayPal in a new tab and says so", async ({ page }) => {
    const cta = page.getByTestId("involved-cta-support");
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
    await expect(cta).toHaveAccessibleName(/opens PayPal/);
  });

  test("the section link names its destination", async ({ page }) => {
    const link = page.getByTestId("home-involved-link");
    await expect(link).toHaveText("Ways to get involved");
    await expect(link).toHaveAttribute("href", "/get-involved");
  });
});

test.describe("home-hero-involved — /get-involved page", () => {
  test("renders with the three anchored audience sections", async ({ page }) => {
    const res = await page.goto("/get-involved");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get Involved");
    for (const id of ["athletes", "volunteers", "support"]) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }
  });
});

test.describe("home-hero-involved — crest overhang state (desktop)", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "The crest overhang is a desktop (lg+) treatment",
    );
  });

  test("data-hero is true only on the home page at scroll-top", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("site-header");
    await expect(header).toHaveAttribute("data-hero", "true");
    await page.mouse.wheel(0, 600);
    await expect(header).toHaveAttribute("data-hero", "false");

    await page.goto("/articles");
    await expect(page.getByTestId("site-header")).toHaveAttribute("data-hero", "false");
  });
});
