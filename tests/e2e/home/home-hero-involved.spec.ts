/*
---
id: home-hero-involved
name: "home-hero-involved: home Get Involved section + /get-involved page (home-layout slice 2)"
feature: softball/home-layout
stack: web
priority: P0
group: A
references:
  - app/(public)/page.tsx
  - app/(public)/get-involved/page.tsx
  - components/ui/get-involved.tsx
  - docs/features/softball/home-layout/design-guide.md
---

## Given
The home renders <GetInvolvedSection> (home-involved): three audience cards
(involved-card-{athletes|volunteers|support}), each with ONE link (involved-cta-*).
/get-involved has three anchored sections. (The hero and its crest-overhang header state were
removed by softball/home-feed H2 — the lead story is the top of the page; see
tests/e2e/home-feed/.)

## When
(1) An anonymous visitor loads "/". (2) They load "/get-involved".

## Then
(1) Three involved cards, each with exactly one link — internal ones point at
/get-involved#athletes / #volunteers, the support one at /donate (the donate modal,
softball/donate); the section link names its
destination and points at /get-involved. (2) The page responds 200 with an h1 "Get Involved"
and sections #athletes, #volunteers, #support.
*/

import { test, expect } from "@playwright/test";

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
      support: "/donate",
    } as const;
    for (const [id, href] of Object.entries(expected)) {
      const card = page.getByTestId(`involved-card-${id}`);
      await expect(card.getByRole("link")).toHaveCount(1);
      await expect(page.getByTestId(`involved-cta-${id}`)).toHaveAttribute("href", href);
    }
  });

  test("the support card opens the donate panel in place", async ({ page }) => {
    const cta = page.getByTestId("involved-cta-support");
    await expect(cta).not.toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("data-support-cta", "home_involved");
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
