/*
---
id: init-web-009
name: "init-web-009: Foundation shell renders core navigation"
feature: softball/init
stack: web
priority: P1
status: green
group: A
references:
  - docs/features/softball/init/slice-01-shell.md
  - docs/features/softball/init/scenarios.md
  - DESIGN.md
---

## Given
An unauthenticated visitor on the home page `/`.

## When
The site shell loads.

## Then
The core landmarks (header, brand, main, footer, primary nav) and the federation
branding render, and the brand reskin (navy masthead + gold Donate pill) holds.

RECONCILED for the MVP shell slice: the nav was rebuilt to exactly Articles ·
About · Donate (Donate is an external PayPal CTA); News/Teams/Events/Shop and the
"placeholder section" model were removed, and Teams/Events are flag-gated OFF for
launch. Full nav composition, routing, redirects, and flag-off 404s are asserted
by tests/e2e/shell/shell-mvp.spec.ts — this file keeps the landmark + brand-token
guards that spec does not duplicate.
*/

import { test, expect } from "@playwright/test";

const BRAND_TEXT = "USVI SOFTBALL FEDERATION";

// Brand tokens as Chromium reports computed colors: `rgb(r, g, b)` with a space
// after each comma, no alpha when opaque. Values are the LIGHT palette from
// DESIGN.md § "Brand & design tokens" (the authoritative source); the exact
// strings are enumerated in slice-01b-brand.md §4.1 / §4.4.
const BRAND = {
  // Home-layout palette (design guide §1.1): royal #2A51C6 (interactive), gold #F7CF4F accent,
  // navy #0A2557 text on gold, frosty-white masthead.
  blue: "rgb(42, 81, 198)", // #2A51C6 — --brand
  yellow: "rgb(247, 207, 79)", // #F7CF4F — --accent (Support pill fill)
  accentFg: "rgb(10, 37, 87)", // #0A2557 — --accent-foreground (navy text on the gold pill)
  headerMuted: "rgb(71, 85, 105)", // #475569 — --header-muted (inactive nav text on the white bar)
  navy: "rgb(26, 49, 95)", // the OLD masthead color — the frosty bar must NOT be this
  white: "rgb(255, 255, 255)", // forbidden as text-on-yellow — see the guard below
} as const;

// ---------------------------------------------------------------------------
// Given/When: the shell renders on `/`. Structural/attribute assertions hold at
// every viewport (links are always attached; only visibility varies), so they
// run under both the desktop and mobile projects.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — site shell renders on /", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("core landmarks and branding render", async ({ page }) => {
    await expect(page.getByTestId("site-header")).toBeVisible();
    await expect(page.getByTestId("site-brand")).toBeVisible();
    await expect(page.getByTestId("site-main")).toBeVisible();
    await expect(page.getByTestId("site-footer")).toBeVisible();
    await expect(page.getByTestId("primary-nav")).toBeAttached();

    // Assert the wordmark via the brand testid, NOT getByText — the footer
    // echoes the same wordmark, so text matching would hit two nodes (QA NIT-01).
    await expect(page.getByTestId("site-brand")).toHaveText(BRAND_TEXT);
  });

  test("exactly one main landmark (QA MAJ-01 regression guard)", async ({
    page,
  }) => {
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("primary nav is labelled", async ({ page }) => {
    const nav = page.getByTestId("primary-nav");
    await expect(nav).toHaveAttribute("aria-label", "Primary");
  });
});

// ---------------------------------------------------------------------------
// Responsive contract §8 — desktop project: the nav links are visible on the
// horizontal bar and the mobile toggle is hidden.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — responsive (desktop)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop viewport contract");
  });

  test("the nav links are visible and the mobile toggle is hidden", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("nav-link-articles")).toBeVisible();
    await expect(page.getByTestId("nav-link-about")).toBeVisible();
    await expect(page.getByTestId("nav-link-donate")).toBeVisible();
    await expect(page.getByTestId("mobile-nav-toggle")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Responsive contract §8 — mobile project. Links are always attached; the
// panel is collapsed by default and revealed via the toggle. Selecting an
// internal link navigates and closes the panel.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — responsive (mobile)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile viewport contract");
  });

  test("toggle reveals the collapsed nav; selecting a link navigates and closes it", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.getByTestId("mobile-nav-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Collapsed by default: links attached but not visible.
    await expect(page.getByTestId("nav-link-articles")).toBeAttached();
    await expect(page.getByTestId("nav-link-articles")).not.toBeVisible();

    // Open the panel.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("nav-link-articles")).toBeVisible();

    // Selecting the Articles link navigates and closes the panel.
    await page.getByTestId("nav-link-articles").click();
    await expect(page).toHaveURL(/\/articles$/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("nav-link-articles")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Slice 01b — brand reskin (navy + gold). Computed-color assertions that pin the
// reskin so a silent palette regression fails CI instead of shipping. The
// masthead bar and the brand crest are visible at EVERY viewport (only the nav
// links collapse behind the mobile toggle), so this block runs under BOTH
// projects — no gating.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — brand: masthead + crest (all viewports)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("masthead is the frosty translucent white bar", async ({ page }) => {
    // Redesign: the masthead is a sticky translucent-white bar with a backdrop blur —
    // NOT the old solid navy. Assert it is not navy and that a backdrop blur is applied
    // (the translucent white computes to an oklab string, too brittle to match exactly).
    const header = page.getByTestId("site-header");
    await expect(header).not.toHaveCSS("background-color", BRAND.navy);
    const blur = await header.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.backdropFilter || (s as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter || "";
    });
    expect(blur).toContain("blur");
  });

  test("brand crest renders and stays decorative", async ({ page }) => {
    // §4.2 #6: the crest <img> is painted in the bar.
    await expect(page.getByTestId("site-brand-crest")).toBeVisible();

    // §4.2 #7 — DECORATIVE GUARD, do not delete. The crest carries alt="" on
    // purpose: the visible wordmark "USVI SOFTBALL FEDERATION" beside it is
    // already the link's accessible name, so a non-empty alt would make screen
    // readers announce the same name twice.
    await expect(page.getByTestId("site-brand-crest")).toHaveAttribute(
      "alt",
      "",
    );

    // §3 strict-mode check: getByTestId matches the attribute value exactly, so
    // "site-brand-crest" is not a second match for "site-brand".
    await expect(page.getByTestId("site-brand")).toHaveCount(1);
    await expect(page.getByTestId("site-brand")).toHaveText(BRAND_TEXT);
  });
});

// ---------------------------------------------------------------------------
// Slice 01b — nav-link colors. The Donate pill and the default nav links only
// RENDER on the horizontal bar at the desktop breakpoint, so gate to DESKTOP. On
// `/` no nav link is active (Home is not a nav item), so nav-link-articles is
// deterministically inactive → muted.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — brand: nav link colors (desktop)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "Donate pill + default nav links only render on the desktop horizontal bar",
    );
    await page.goto("/");
  });

  test("Donate pill is gold with navy text (the inversion)", async ({
    page,
  }) => {
    const donate = page.getByTestId("nav-link-donate");
    // --accent gold #F7CF4F fill.
    await expect(donate).toHaveCSS("background-color", BRAND.yellow);
    // --accent-foreground navy #0A2557 text (dark-on-gold, never white).
    await expect(donate).toHaveCSS("color", BRAND.accentFg);
  });

  test("Donate label is NEVER white-on-gold (forbidden-pair guard)", async ({
    page,
  }) => {
    // §4.1 #3 — THE ONE INVIOLABLE COLOR RULE, encoded as a test. White text on
    // the gold fill measures 1.57:1 — a severe WCAG AA failure. This negative
    // guard makes that specific, banned pair fail loudly and independently.
    await expect(page.getByTestId("nav-link-donate")).not.toHaveCSS(
      "color",
      BRAND.white,
    );
  });

  test("inactive default nav link uses the muted header token", async ({
    page,
  }) => {
    // Redesign: on `/`, nav-link-articles is inactive → --header-muted slate #475569
    // (dark-on-white now, was light #cbd5e1 on the old navy bar).
    await expect(page.getByTestId("nav-link-articles")).toHaveCSS(
      "color",
      BRAND.headerMuted,
    );
  });
});
