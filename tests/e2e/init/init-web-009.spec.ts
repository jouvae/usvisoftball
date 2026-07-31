/*
---
id: init-web-009
name: "init-web-009: Foundation shell renders core navigation"
feature: softball/init
stack: web
priority: P1
status: red
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
The primary navigation (News, Teams, Events, About, Shop, Donate) and the
federation branding render, and each nav item routes to its section — sections
not yet built resolve to a visible placeholder, not a broken link or error.
*/

import { test, expect, type Page } from "@playwright/test";

// Nav destinations in scenario order: News, Teams, Events, About, Shop, Donate.
const SECTIONS = [
  { key: "news", testId: "nav-link-news", path: "/news", title: "News" },
  { key: "teams", testId: "nav-link-teams", path: "/teams", title: "Teams" },
  { key: "events", testId: "nav-link-events", path: "/events", title: "Events" },
  { key: "about", testId: "nav-link-about", path: "/about", title: "About" },
  { key: "shop", testId: "nav-link-shop", path: "/shop", title: "Shop" },
  { key: "donate", testId: "nav-link-donate", path: "/donate", title: "Donate" },
] as const;

const NAV_TEST_IDS = SECTIONS.map((s) => s.testId);

// Sections still resolving to the shared placeholder. `/news` is deliberately
// EXCLUDED: it was built in slice 02 (real news feed) and is covered by
// init-web-001, which asserts the feed renders there. Asserting a placeholder at
// /news here would collide with that spec — no implementation can satisfy both.
// Do NOT re-add "news" to this set; the scenario's "sections not yet built"
// clause simply no longer applies to /news. See PLACEHOLDER_SECTIONS usage below.
const PLACEHOLDER_SECTIONS = SECTIONS.filter((s) => s.key !== "news");

const BRAND_TEXT = "USVI SOFTBALL FEDERATION";

// Brand tokens as Chromium reports computed colors: `rgb(r, g, b)` with a space
// after each comma, no alpha when opaque. Values are the LIGHT palette from
// DESIGN.md § "Brand & design tokens" (the authoritative source); the exact
// strings are enumerated in slice-01b-brand.md §4.1 / §4.4. These are the FIRST
// color assertions in this suite — before this slice the reskin was invisible to
// CI (no toHaveCSS / rgb() anywhere in tests/).
const BRAND = {
  navy: "rgb(26, 49, 95)", //  #1a315f — --header (masthead) & --accent-foreground (text on gold)
  gold: "rgb(243, 203, 54)", // #f3cb36 — --accent (Donate pill fill)
  headerMuted: "rgb(203, 213, 225)", // #cbd5e1 — --header-muted (inactive nav text)
  white: "rgb(255, 255, 255)", // forbidden as text-on-gold (1.57:1) — see the guard below
} as const;

// Read the nav-link data-testids in DOM order without selecting by the
// data-testid attribute (honors the getByTestId rule; anchors are scoped to
// the nav container, which contains only the six nav links).
async function navLinkOrder(page: Page): Promise<(string | null)[]> {
  return page
    .getByTestId("primary-nav")
    .locator("a")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
}

// ---------------------------------------------------------------------------
// Given/When: the shell renders on `/`. These structural/attribute assertions
// hold at every viewport (links are always attached; only visibility varies),
// so they run under both the desktop and mobile projects.
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

  test("primary nav is labelled and exposes six links in scenario order", async ({
    page,
  }) => {
    const nav = page.getByTestId("primary-nav");
    await expect(nav).toHaveAttribute("aria-label", "Primary");

    // DOM order matches the scenario order exactly.
    expect(await navLinkOrder(page)).toEqual(NAV_TEST_IDS);
  });

  test("each nav link exists exactly once with the correct href", async ({
    page,
  }) => {
    for (const section of SECTIONS) {
      const link = page.getByTestId(section.testId);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", section.path);
    }
  });

  test("no nav link is active on / (Home is not a nav item — QA NIT-02)", async ({
    page,
  }) => {
    for (const section of SECTIONS) {
      await expect(page.getByTestId(section.testId)).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Then: each nav item routes to its section with a visible placeholder and no
// broken link/error. Direct navigation asserts a 200 response (proves the route
// is not a 404/error) and the shared placeholder; runs under both projects.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — each section route resolves (no dead links)", () => {
  for (const section of PLACEHOLDER_SECTIONS) {
    test(`${section.path} responds 200 and shows the "${section.title}" placeholder`, async ({
      page,
    }) => {
      const response = await page.goto(section.path);
      expect(response, `no response for ${section.path}`).not.toBeNull();
      expect(response!.status()).toBe(200);

      const placeholder = page.getByTestId("section-placeholder");
      await expect(placeholder).toBeVisible();
      await expect(
        placeholder.getByRole("heading", { level: 1 }),
      ).toHaveText(section.title);

      // Once inside the section, its nav link is marked active.
      await expect(page.getByTestId(section.testId)).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  // `/news` graduated out of the placeholder set: slice 02 replaced the
  // placeholder with the real news feed (asserted in depth by init-web-001). The
  // scenario's "each nav item routes to its section … not a broken link or error"
  // clause still binds here, so we assert /news responds 200 with REAL content —
  // the feed container or the empty state — and specifically NOT the placeholder.
  test('/news responds 200 and renders the real feed (not the "News" placeholder)', async ({
    page,
  }) => {
    const response = await page.goto("/news");
    expect(response, "no response for /news").not.toBeNull();
    expect(response!.status()).toBe(200);

    // The placeholder must be gone at /news.
    await expect(page.getByTestId("section-placeholder")).toHaveCount(0);

    // Real content: either the populated feed or the empty state (both are valid,
    // depending on DB contents), never a broken link/error.
    const feedOrEmpty = page
      .getByTestId("news-feed")
      .or(page.getByTestId("news-empty-state"));
    await expect(feedOrEmpty.first()).toBeVisible();

    // Once inside the section, its nav link is still marked active.
    await expect(page.getByTestId("nav-link-news")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// ---------------------------------------------------------------------------
// Then (click-through): real clicks prove the rendered links navigate — not
// just direct URL visits. Requires the links to be visible, so desktop only.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — nav links navigate on click (desktop)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "click-through requires the desktop horizontal nav (links visible)",
    );
  });

  for (const section of PLACEHOLDER_SECTIONS) {
    test(`clicking ${section.testId} navigates to ${section.path}`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.getByTestId(section.testId).click();

      await expect(page).toHaveURL(new RegExp(`${section.path}$`));
      await expect(page.getByTestId("section-placeholder")).toBeVisible();
      await expect(
        page
          .getByTestId("section-placeholder")
          .getByRole("heading", { level: 1 }),
      ).toHaveText(section.title);
      await expect(page.getByTestId(section.testId)).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }

  // `/news` click-through kept (nav item must route + mark active), but it lands
  // on the real feed, not the placeholder — slice 02, covered by init-web-001.
  test("clicking nav-link-news navigates to /news (real feed, no placeholder)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("nav-link-news").click();

    await expect(page).toHaveURL(/\/news$/);
    await expect(page.getByTestId("section-placeholder")).toHaveCount(0);
    await expect(page.getByTestId("nav-link-news")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// ---------------------------------------------------------------------------
// Responsive contract §8 — desktop project.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — responsive (desktop)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop viewport contract");
  });

  test("all six nav links are visible and the mobile toggle is hidden", async ({
    page,
  }) => {
    await page.goto("/");

    for (const section of SECTIONS) {
      await expect(page.getByTestId(section.testId)).toBeVisible();
    }
    await expect(page.getByTestId("mobile-nav-toggle")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Responsive contract §8 — mobile project. Links are always attached; the
// panel is collapsed by default and revealed via the toggle.
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
    for (const section of SECTIONS) {
      await expect(page.getByTestId(section.testId)).toBeAttached();
      await expect(page.getByTestId(section.testId)).not.toBeVisible();
    }

    // Open the panel.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const section of SECTIONS) {
      await expect(page.getByTestId(section.testId)).toBeVisible();
    }

    // Selecting a link navigates and closes the panel.
    await page.getByTestId("nav-link-teams").click();
    await expect(page).toHaveURL(/\/teams$/);
    await expect(page.getByTestId("section-placeholder")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("nav-link-teams")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Slice 01b — brand reskin (navy + gold). The FIRST computed-color assertions
// in this suite (see slice-01b-brand.md §4). These pin the reskin so a silent
// palette regression fails CI instead of shipping.
//
// The masthead bar and the brand crest are visible at EVERY viewport (only the
// six nav links collapse behind the mobile toggle), so this block runs under
// BOTH the desktop and mobile projects — no gating.
// ---------------------------------------------------------------------------
test.describe("init-web-009 — brand: masthead + crest (all viewports)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("masthead background is the navy --header token", async ({ page }) => {
    // §4.1 #4: --header #1a315f, the constant navy masthead.
    await expect(page.getByTestId("site-header")).toHaveCSS(
      "background-color",
      BRAND.navy,
    );
  });

  test("brand crest renders and stays decorative", async ({ page }) => {
    // §4.2 #6: the crest <img> is painted in the bar.
    await expect(page.getByTestId("site-brand-crest")).toBeVisible();

    // §4.2 #7 — DECORATIVE GUARD, do not delete. The crest carries alt="" on
    // purpose: the visible wordmark "USVI SOFTBALL FEDERATION" beside it is
    // already the link's accessible name, so a non-empty alt (e.g. a
    // well-meaning alt="USVI Softball Federation") would make screen readers
    // announce the same name twice. This asserts the empty string exactly so
    // that "helpful" duplication fails loudly.
    await expect(page.getByTestId("site-brand-crest")).toHaveAttribute(
      "alt",
      "",
    );

    // §3 strict-mode check: with the <img> now nested inside the brand <Link>,
    // getByTestId("site-brand") must still resolve to EXACTLY ONE element.
    // getByTestId matches the attribute value exactly (not a substring), so the
    // crest's distinct "site-brand-crest" is not a second match for "site-brand".
    await expect(page.getByTestId("site-brand")).toHaveCount(1);

    // §4.2 #8 (existing, line ~74): an alt="" image contributes no text, so the
    // wordmark assertion is unaffected — re-checked here to prove the invariant.
    await expect(page.getByTestId("site-brand")).toHaveText(BRAND_TEXT);
  });
});

// ---------------------------------------------------------------------------
// Slice 01b — nav-link colors. The Donate pill and the default nav links only
// RENDER on the horizontal bar at the desktop breakpoint (< md they collapse
// behind mobile-nav-toggle). toHaveCSS resolves computed styles even on a
// hidden-but-attached element, but reading a color off a collapsed link would
// be asserting a style the user never sees — so gate to DESKTOP, matching the
// existing responsive-desktop pattern in this file. On `/` no nav link is
// active (QA NIT-02), so nav-link-news is deterministically inactive → muted.
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
    // §4.1 #1: --accent gold #f3cb36 fill.
    await expect(donate).toHaveCSS("background-color", BRAND.gold);
    // §4.1 #2: --accent-foreground navy #1a315f text.
    await expect(donate).toHaveCSS("color", BRAND.navy);
  });

  test("Donate label is NEVER white-on-gold (forbidden-pair guard)", async ({
    page,
  }) => {
    // §4.1 #3 — THE ONE INVIOLABLE COLOR RULE, encoded as a test. Do NOT delete
    // this as redundant with the "color == navy" check above. White text on the
    // gold fill measures 1.57:1 (DESIGN.md measured-contrast table) — a severe
    // WCAG AA failure. A future edit that puts white text on gold could still
    // satisfy other assertions if they were loosened; this negative guard makes
    // that specific, banned pair fail loudly and independently.
    await expect(page.getByTestId("nav-link-donate")).not.toHaveCSS(
      "color",
      BRAND.white,
    );
  });

  test("inactive default nav link uses the muted header token", async ({
    page,
  }) => {
    // §4.1 #5: on `/`, nav-link-news is inactive → --header-muted #cbd5e1.
    // (The active link, only inside its own section, would be white #ffffff.)
    await expect(page.getByTestId("nav-link-news")).toHaveCSS(
      "color",
      BRAND.headerMuted,
    );
  });
});
