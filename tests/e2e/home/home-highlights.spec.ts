/*
---
id: home-highlights
name: "home-highlights: editor-curated home highlights carousel + toggle round-trip (MVP slice 4)"
feature: softball/init
stack: web
priority: P0
group: A
references:
  - app/(public)/page.tsx
  - components/client/highlights-carousel.tsx
  - components/client/highlight-toggle-form.tsx
  - app/admin/(protected)/review/[id]/page.tsx
  - lib/articles.ts
---

## Given
The public home reads listHighlightedArticles() (published AND is_highlight,
newest-first) and renders a hero <h1> + a highlights section: an always-present
"view all articles" link, and — when ≥1 highlight — a <HighlightsCarousel>
(data-testid highlights-carousel → highlights-track of article-card cards, plus
prev/next). An editor, on a PUBLISHED article's /admin/review/[id], gets a
HighlightToggleForm (toggle-highlight button + highlight-state) whose Server Action
flips articles.is_highlight and revalidates "/".

## When
(1) An anonymous visitor loads "/". (2) A signed-in editor opens a published
article's review desk and clicks toggle-highlight, then a fresh anon visitor
reloads "/". (3) The editor clicks toggle-highlight a second time to restore.

## Then
(1) The hero h1 renders and the view-all link points to /articles; if the live DB
has ≥1 highlight, the carousel + track + ≥1 card + prev/next render and the h2 reads
"Highlights". (2) The toggle label/state flip after the action resolves, and the
article's presence in the anon home carousel matches the NEW highlighted state
(present ⇔ highlighted, matched by data-slug). (3) The second toggle restores the
original state, verified both on the desk and on the anon home — so the DB ends
exactly where it started.

Seed-agnostic: the current highlighted state, the target published article, and its
slug are all DERIVED from the DOM/flow — nothing is hardcoded. The auth flow reuses
the established real Supabase sign-in (SEED_ADMIN_* is the seed editor), driven
through the /admin/login form exactly as init-e2e-005 does — no minted session.
*/

import { test, expect, type Page } from "@playwright/test";

// The seed EDITOR account (same identity init-e2e-005 signs in as). Credentials live
// ONLY in the gitignored .env.local, which playwright.config.ts loadEnvLocal() copies
// into process.env BEFORE workers spawn. No lib/* import on the assertion path, no
// out-of-band session — we drive the real /admin/login form.
const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

function requireCreds(): { email: string; password: string } {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local). " +
        "The seed editor user + role are documented preconditions (see init-e2e-005).",
    );
  }
  return { email: EDITOR_EMAIL, password: EDITOR_PASSWORD };
}

// Drive the REAL sign-in form (the init-e2e-005 helper shape), then assert the
// Server-Action redirect landed on the dashboard.
async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// The label the toggle renders is a total function of the CURRENT highlighted state,
// so we read the button label to derive state without trusting the DB — deriving,
// not hardcoding. "Remove …" ⇔ currently highlighted.
async function readHighlighted(page: Page): Promise<boolean> {
  const label = (await page.getByTestId("toggle-highlight").innerText()).trim();
  return /remove/i.test(label);
}

// ===========================================================================
// Gated to the `desktop` project: the round-trip drives the real editor auth flow
// and MUTATES a shared Supabase row. The two projects share ONE DB with no per-worker
// isolation (see playwright.config.ts), so running the write flow twice would have the
// projects race on is_highlight. Mirrors init-e2e-004/005's single-project gating.
// Playwright types the describe-level test.skip callback with fixtures only, so gate
// via beforeEach.
// ===========================================================================
test.describe("home-highlights — editor-curated home carousel + toggle round-trip (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real editor sign-in + is_highlight write, no viewport dependence — run once against the shared DB",
    ),
  );

  test("public home (anon): hero, always-present view-all link, and a carousel iff the live DB has highlights", async ({
    page,
  }) => {
    // WHEN: an anonymous visitor loads the home page (no login).
    const res = await page.goto("/");
    expect(res, "no response for /").not.toBeNull();
    expect(res!.status()).toBe(200);

    // THEN: the hero h1 renders (the page's sole <h1>).
    await expect(
      page.getByRole("heading", { level: 1, name: /USVI Softball Federation/i }),
    ).toBeVisible();

    // The "view all articles" link ALWAYS shows and routes to /articles.
    const viewAll = page.getByTestId("highlights-view-all");
    await expect(viewAll).toBeVisible();
    await expect(viewAll).toHaveAttribute("href", "/articles");

    // DERIVE the highlight state from the DOM: carousel present ⇔ ≥1 highlight.
    const hasCarousel = (await page.getByTestId("highlights-carousel").count()) > 0;

    if (hasCarousel) {
      // ≥1 highlight → carousel + track + ≥1 card + both scroll controls, h2 "Highlights".
      await expect(page.getByTestId("highlights-carousel")).toBeVisible();
      await expect(page.getByTestId("highlights-track")).toBeVisible();
      const cardCount = await page
        .getByTestId("highlights-track")
        .getByTestId("article-card")
        .count();
      expect(cardCount, "carousel renders ≥1 article-card").toBeGreaterThan(0);
      await expect(page.getByTestId("highlights-prev")).toBeVisible();
      await expect(page.getByTestId("highlights-next")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: /^Highlights$/i }),
      ).toBeVisible();
    } else {
      // 0 highlights → empty note, no carousel, h2 "Latest news".
      await expect(page.getByTestId("highlights-empty")).toBeVisible();
      await expect(page.getByTestId("highlights-carousel")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { level: 2, name: /^Latest news$/i }),
      ).toBeVisible();
    }
  });

  test("editor toggle-highlight round-trip: flips the flag, the anon home carousel matches, then restores", async ({
    page,
    browser,
  }) => {
    const { email, password } = requireCreds();

    // GIVEN: a signed-in editor on the dashboard.
    await signIn(page, email, password);

    // Open the editorial queue (editor sees ALL rows incl. published) and pick a
    // PUBLISHED row — matched by the status badge's data-status, seed-agnostic. The
    // toggle only renders on a published article, so we MUST target a published one.
    await page.goto("/admin/queue");
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const publishedItem = page
      .getByTestId("queue-item")
      .filter({ has: page.locator('[data-status="published"]') })
      .first();
    await expect(
      publishedItem,
      "the seed DB has ≥1 published article to toggle",
    ).toHaveCount(1);

    // Open its review desk.
    await publishedItem.getByTestId("queue-item-title").click();
    await expect(page).toHaveURL(/\/admin\/review\/[^/]+$/);
    await expect(page.getByTestId("review-view")).toBeVisible();
    await expect(page.getByTestId("review-status-badge")).toHaveText(/published/i);

    // Capture the id (for the restore round-trip) and the slug (to match the card on
    // the public home) — both DERIVED, never hardcoded.
    const reviewId = new URL(page.url()).pathname.split("/").pop()!;
    expect(reviewId, "captured a review article id").toBeTruthy();
    const liveHref = await page
      .getByTestId("review-live-link")
      .getAttribute("href");
    expect(liveHref, "review page exposes the live-article link").toBeTruthy();
    const slug = liveHref!.split("/").pop()!;
    expect(slug, "derived a slug from the live link").toBeTruthy();

    // Read the ORIGINAL highlighted state from the toggle label.
    const originalHighlighted = await readHighlighted(page);

    // WHEN: the editor clicks toggle-highlight. The action flips is_highlight and
    // revalidates this route, so the label + state re-render in the same roundtrip.
    await page.getByTestId("toggle-highlight").click();

    const afterToggle = !originalHighlighted;
    // THEN: label + state + aria-pressed all reflect the NEW state (auto-retrying).
    await expect(page.getByTestId("toggle-highlight")).toHaveText(
      afterToggle ? /remove from home highlights/i : /add to home highlights/i,
    );
    await expect(page.getByTestId("toggle-highlight")).toHaveAttribute(
      "aria-pressed",
      String(afterToggle),
    );
    await expect(page.getByTestId("highlight-state")).toHaveText(
      afterToggle ? /featured in the home highlights/i : /not featured/i,
    );

    // ...and the ANON public home carousel presence matches the NEW state. A brand-new
    // browser context guarantees no editor cookie — the real anonymous path.
    await assertHomeCardPresence(browser, slug, afterToggle);

    // WHEN: the editor toggles once more to RESTORE the original state.
    await page.goto(`/admin/review/${reviewId}`);
    await expect(page.getByTestId("review-view")).toBeVisible();
    // Guard: we are on the flipped state before restoring.
    expect(await readHighlighted(page)).toBe(afterToggle);
    await page.getByTestId("toggle-highlight").click();

    // THEN: the desk reflects the ORIGINAL state again...
    await expect(page.getByTestId("toggle-highlight")).toHaveText(
      originalHighlighted
        ? /remove from home highlights/i
        : /add to home highlights/i,
    );
    await expect(page.getByTestId("toggle-highlight")).toHaveAttribute(
      "aria-pressed",
      String(originalHighlighted),
    );

    // ...and the anon home carousel presence is back to the original — DB restored.
    await assertHomeCardPresence(browser, slug, originalHighlighted);
  });

  test("carousel scroll controls are present and clickable without error (when a carousel renders)", async ({
    page,
  }) => {
    await page.goto("/");
    const hasCarousel = (await page.getByTestId("highlights-carousel").count()) > 0;
    test.skip(!hasCarousel, "no highlights in the live DB — nothing to scroll");

    const prev = page.getByTestId("highlights-prev");
    const next = page.getByTestId("highlights-next");
    await expect(prev).toBeEnabled();
    await expect(next).toBeEnabled();
    // Smoke only — the buttons scrollBy on the track; assert they click without
    // throwing, not exact pixel offsets (a native scroll-snap list).
    await next.click();
    await prev.click();
    await expect(page.getByTestId("highlights-track")).toBeVisible();
  });
});

// Open the public home in a FRESH anonymous context and assert the article's card
// presence (matched by data-slug — only carousel cards render on home) equals the
// expected highlighted state. Present ⇔ highlighted; absent ⇔ not.
async function assertHomeCardPresence(
  browser: import("@playwright/test").Browser,
  slug: string,
  shouldBePresent: boolean,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const anon = await context.newPage();
    await anon.goto("/");
    const card = anon.locator(
      `[data-testid="article-card"][data-slug="${slug}"]`,
    );
    await expect(card).toHaveCount(shouldBePresent ? 1 : 0);
  } finally {
    await context.close();
  }
}
