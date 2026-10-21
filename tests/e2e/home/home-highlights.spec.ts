/*
---
id: home-highlights
name: "home-highlights: curated home news grid (highlights first) + editor toggle round-trip (home-layout slice 3)"
feature: softball/home-layout
stack: web
priority: P0
group: A
references:
  - app/(public)/page.tsx
  - components/ui/article-card.tsx
  - components/client/highlight-toggle-form.tsx
  - app/admin/(protected)/review/[id]/page.tsx
  - lib/articles.ts
---

## Given
The public home reads listHomeNews(3): published articles ordered is_highlight desc,
published_at desc, capped at 3. It renders a "Latest News" section (home-news) with an
always-present home-news-link → /articles and, when ≥1 article is published, a
home-news-grid of ≤3 article-card cards, each carrying data-highlight="true|false". An
editor, on a PUBLISHED article's /admin/review/[id], gets a HighlightToggleForm
(toggle-highlight button + highlight-state) whose Server Action flips articles.is_highlight
and revalidates "/". (Replaces the slice-4 highlights carousel.)

## When
(1) An anonymous visitor loads "/". (2) A signed-in editor opens a published article's
review desk and clicks toggle-highlight, then a fresh anon visitor reloads "/". (3) The
editor clicks toggle-highlight a second time to restore.

## Then
(1) The hero h1 renders, the news link points at /articles with the label "All news", and
the grid shows 1–3 cards in which every highlighted card precedes every non-highlighted one.
(2) The toggle label/state flip; on the anon home the article's card is consistent with the
curated ordering: if now highlighted it is present as data-highlight="true" OR the grid is
already full of three highlighted cards (newer highlights win the slots); if now not
highlighted it is absent or present as data-highlight="false". The ordering invariant holds
throughout. (3) The second toggle restores the original state, checked the same way — the
DB ends exactly where it started.

Seed-agnostic: the current highlighted state, the target published article, and its slug
are all DERIVED from the DOM/flow — nothing is hardcoded. The auth flow reuses the
established real Supabase sign-in (SEED_ADMIN_* is the seed editor), driven through the
/admin/login form exactly as init-e2e-005 does — no minted session.
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
test.describe("home-highlights — curated home news grid + toggle round-trip (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real editor sign-in + is_highlight write, no viewport dependence — run once against the shared DB",
    ),
  );

  test("public home (anon): hero, news link, and a curated grid with highlights first", async ({
    page,
  }) => {
    // WHEN: an anonymous visitor loads the home page (no login).
    const res = await page.goto("/");
    expect(res, "no response for /").not.toBeNull();
    expect(res!.status()).toBe(200);

    // THEN: the hero h1 renders (the page's sole <h1>).
    await expect(
      page.getByRole("heading", { level: 1, name: /Virgin Islands Softball Federation/i }),
    ).toBeVisible();

    // The news link ALWAYS shows, names its destination, and routes to /articles.
    const allNews = page.getByTestId("home-news-link");
    await expect(allNews).toHaveText("All news");
    await expect(allNews).toHaveAttribute("href", "/articles");
    await expect(
      page.getByRole("heading", { level: 2, name: /^Latest News$/i }),
    ).toBeVisible();

    // DERIVE from the DOM: grid present ⇔ ≥1 published article.
    if ((await page.getByTestId("home-news-grid").count()) === 0) {
      await expect(page.getByTestId("home-news-empty")).toBeVisible();
      return;
    }
    const flags = await readGridFlags(page);
    expect(flags.length, "grid renders 1–3 cards").toBeGreaterThan(0);
    expect(flags.length).toBeLessThanOrEqual(3);
    expectHighlightsFirst(flags);
  });

  test("editor toggle-highlight round-trip: flips the flag, the anon home grid stays consistent, then restores", async ({
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

    // ...and the ANON public home grid is consistent with the NEW state. A brand-new
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

    // ...and the anon home grid is consistent with the original state — DB restored.
    await assertHomeCardPresence(browser, slug, originalHighlighted);
  });
});

// The grid's data-highlight flags, in DOM order.
async function readGridFlags(page: Page): Promise<boolean[]> {
  const attrs = await page
    .getByTestId("home-news-grid")
    .getByTestId("article-card")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-highlight")));
  return attrs.map((a) => a === "true");
}

// Curated ordering: no highlighted card may follow a non-highlighted one.
function expectHighlightsFirst(flags: boolean[]): void {
  const firstPlain = flags.indexOf(false);
  if (firstPlain === -1) return;
  expect(
    flags.slice(firstPlain).every((f) => !f),
    `highlighted cards precede the rest (got ${JSON.stringify(flags)})`,
  ).toBe(true);
}

// Open the public home in a FRESH anonymous context and assert the article's card is
// consistent with its highlighted state under the curated ordering:
//   highlighted     → present as data-highlight="true", OR the grid is already three
//                     highlighted cards (newer highlights hold every slot);
//   not highlighted → absent, or present as data-highlight="false".
async function assertHomeCardPresence(
  browser: import("@playwright/test").Browser,
  slug: string,
  highlighted: boolean,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const anon = await context.newPage();
    await anon.goto("/");
    const flags = await readGridFlags(anon);
    expectHighlightsFirst(flags);

    const card = anon.locator(`[data-testid="article-card"][data-slug="${slug}"]`);
    const present = (await card.count()) > 0;
    if (highlighted) {
      if (present) {
        await expect(card).toHaveAttribute("data-highlight", "true");
      } else {
        expect(
          flags.length === 3 && flags.every(Boolean),
          "a highlighted article may only be missing when three newer highlights fill the grid",
        ).toBe(true);
      }
    } else if (present) {
      await expect(card).toHaveAttribute("data-highlight", "false");
    }
  } finally {
    await context.close();
  }
}
