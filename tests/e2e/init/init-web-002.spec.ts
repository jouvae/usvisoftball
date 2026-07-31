/*
---
id: init-web-002
name: "init-web-002: Public visitor reads a published article; drafts stay hidden"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-03-article-page.md
  - docs/features/softball/init/scenarios.md
  - DESIGN.md
---

## Given
One article is `published` and others are `draft` / `in_review` / `unpublished`.

## When
An unauthenticated visitor opens the published article's `/news/[slug]`, then
attempts each hidden slug (and a nonexistent one).

## Then
The published article renders (headline, byline, deterministic date, body, hero,
gallery), the empty-gallery published article renders with no gallery section,
and every hidden/nonexistent slug returns HTTP 404 without ever leaking the
hidden article's title — the draft is never exposed to the public.
*/

import { test, expect, type Locator, type Page } from "@playwright/test";

// The canonical write path (slice-03 §5, §9.1) — never a second insert path,
// never raw SQL. `lib/articles.ts` is `server-only`-fenced; the Playwright
// transform aliases `server-only` to a no-op via tests/tsconfig.json (see
// playwright.config.ts), so this import resolves under a plain-Node worker.
import { createArticle } from "@/lib/articles";
// The EXACT fixtures the seed also uses — imported so the seed and this spec can
// never drift (slice-03 §9.1).
import { SEED_ARTICLES } from "@/lib/seed/fixtures";

// ---------------------------------------------------------------------------
// Concrete contract constants (§9.2). Kept as literal strings so a silently
// broken read cannot pass by tautology.
// ---------------------------------------------------------------------------
const PUBLISHED_SLUG = "st-croix-clinches-territory-title";
const EMPTY_GALLERY_SLUG = "federation-launches-2026-season";
const DRAFT_SLUG = "unannounced-roster-shakeup";
const IN_REVIEW_SLUG = "playoff-brackets-in-review";
const UNPUBLISHED_SLUG = "2025-season-recap-archived";
const NONEXISTENT_SLUG = "this-article-does-not-exist";

// Deterministic formatted date (from lib/format.ts; NEVER toLocaleDateString).
const PUBLISHED_DATE = "June 20, 2026";
// A known substring of the published body — proves the real body rendered.
const BODY_SUBSTRING = "capped an undefeated run";

// The published fixture the positive-proof assertions read straight from, so
// title / byline / hero-alt can never drift from what the seed writes.
const PUBLISHED = SEED_ARTICLES.find((a) => a.slug === PUBLISHED_SLUG)!;

// Gallery alts asserted per index, IN FIXTURE/ARRAY ORDER (§9.2 assertion 7).
const GALLERY_ALTS = [
  "St. Croix players warming up before the championship game",
  "The St. Croix squad posing with the territory trophy",
] as const;

// Hidden rows whose slug must 404 AND whose title must never leak (§9.2 9–10).
const HIDDEN = [
  { slug: DRAFT_SLUG, title: "Roster Shakeup Ahead of the Playoffs" },
  { slug: IN_REVIEW_SLUG, title: "Playoff Brackets Set for Review" },
  { slug: UNPUBLISHED_SLUG, title: "2025 Season Recap" },
] as const;

// Idempotent canonical seed: drive createArticle for each fixture, swallowing
// ONLY the slug unique-violation (Postgres 23505). Every other error re-throws
// loudly (§5.3) — an RLS/permission/connection failure must NOT be silently
// treated as "already seeded". This spec ONLY seeds; it never deletes, so it is
// safe under both the desktop and mobile projects (§9.1).
async function seedCanonicalArticles(): Promise<void> {
  for (const input of SEED_ARTICLES) {
    try {
      await createArticle(input);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "23505") throw err;
    }
  }
}

function cardBySlug(page: Page, slug: string): Locator {
  return page.locator(`[data-testid="article-card"][data-slug="${slug}"]`);
}

test.beforeAll(async () => {
  // GIVEN: the canonical published + hidden fixtures exist.
  await seedCanonicalArticles();
});

// ===========================================================================
// The positive proof (§8-#4): the published article renders 200 with REAL
// content. A 404-only suite could pass with everything broken — so we pin the
// headline, byline, deterministic date, hero, body substring, and the two
// gallery images. A silently-empty DB or a broken public read fails HERE.
// ===========================================================================
test.describe("init-web-002 — published article renders", () => {
  test("route responds 200 with full article content", async ({ page }) => {
    // 1. HTTP 200 read straight off the navigation response.
    const res = await page.goto(`/news/${PUBLISHED_SLUG}`);
    expect(res, `no response for /news/${PUBLISHED_SLUG}`).not.toBeNull();
    expect(res!.status()).toBe(200);

    // 2. The sole <h1> is the headline (asserted via testid AND role).
    await expect(page.getByTestId("article-headline")).toHaveText(
      PUBLISHED.title,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      PUBLISHED.title,
    );

    // 3. Byline.
    await expect(page.getByTestId("article-byline")).toHaveText(
      `By ${PUBLISHED.authorName}`,
    );

    // 4. Deterministic date string (never toLocaleDateString).
    await expect(page.getByTestId("article-date")).toHaveText(PUBLISHED_DATE);

    // 5. Hero image visible; its alt equals the fixture coverImageAlt. The
    // testid is pinned to the <Image> element that carries `alt` (§4.1 MINOR-1).
    const hero = page.getByTestId("article-hero");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("alt", PUBLISHED.coverImageAlt ?? "");

    // 6. Body rendered for real (a known substring), not an empty shell.
    const body = page.getByTestId("article-body");
    await expect(body).toBeVisible();
    await expect(body).toContainText(BODY_SUBSTRING);
  });

  test("gallery renders exactly 2 images, per index, in array order", async ({
    page,
  }) => {
    await page.goto(`/news/${PUBLISHED_SLUG}`);

    // 7. Gallery section present; images scoped under it (strict mode, §4.1).
    const gallery = page.getByTestId("article-gallery");
    await expect(gallery).toBeVisible();

    const images = gallery.getByTestId("article-gallery-image");
    await expect(images).toHaveCount(2);

    // Assert the two alts PER INDEX (ordered), not as an unordered set.
    await expect(images.nth(0)).toHaveAttribute("alt", GALLERY_ALTS[0]);
    await expect(images.nth(1)).toHaveAttribute("alt", GALLERY_ALTS[1]);
  });
});

// ===========================================================================
// Empty-gallery published article (§9.2 assertion 8): renders 200 with its
// headline + body, but NO gallery section — the empty branch is a real fixture.
// ===========================================================================
test.describe("init-web-002 — empty-gallery published article", () => {
  test("renders 200 with no gallery section", async ({ page }) => {
    const res = await page.goto(`/news/${EMPTY_GALLERY_SLUG}`);
    expect(res, `no response for /news/${EMPTY_GALLERY_SLUG}`).not.toBeNull();
    expect(res!.status()).toBe(200);

    await expect(page.getByTestId("article-headline")).toBeVisible();
    await expect(page.getByTestId("article-body")).toBeVisible();

    // The gallery section is ABSENT (not merely empty) for an empty gallery.
    await expect(page.getByTestId("article-gallery")).toHaveCount(0);
  });
});

// ===========================================================================
// Hidden statuses never leak (§9.2 assertions 9–10). Reading through the
// RLS-enforced client with NO status filter (§2.1) makes each 404 a genuine RLS
// assertion: a broken policy leaks the draft → it renders 200 → this fails. The
// leak check is a real body check, not just a status check.
// ===========================================================================
test.describe("init-web-002 — drafts / in_review / unpublished 404 (no leak)", () => {
  for (const { slug, title } of HIDDEN) {
    test(`/news/${slug} returns 404 and never leaks its title`, async ({
      page,
    }) => {
      // 9. HTTP 404 (streamed-response-sensitive — read off the response, §8-#2).
      const res = await page.goto(`/news/${slug}`);
      expect(res, `no response for /news/${slug}`).not.toBeNull();
      expect(res!.status()).toBe(404);

      // 10. Leak check: the hidden title appears NOWHERE in the 404 body.
      await expect(page.getByText(title)).toHaveCount(0);

      // The branded 404 UI is shown instead of the article.
      await expect(page.getByTestId("article-not-found")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Article not found",
      );

      // The article testids must be absent — nothing article-shaped rendered.
      await expect(page.getByTestId("article-headline")).toHaveCount(0);
      await expect(page.getByTestId("article-body")).toHaveCount(0);
    });
  }

  // 11. A nonexistent slug also 404s (same non-streamed path).
  test(`/news/${NONEXISTENT_SLUG} returns 404`, async ({ page }) => {
    const res = await page.goto(`/news/${NONEXISTENT_SLUG}`);
    expect(res, `no response for /news/${NONEXISTENT_SLUG}`).not.toBeNull();
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("article-not-found")).toBeVisible();
  });
});

// ===========================================================================
// Navigation from the feed (§9.2 assertion 12): clicking the published card's
// headline link lands on the article page — proving the slice-02→03 link delta
// actually navigates. The link repeats per card, so it is scoped under the card.
// ===========================================================================
test.describe("init-web-002 — feed → article navigation", () => {
  test("clicking the card headline link opens the article", async ({ page }) => {
    await page.goto("/news");

    await cardBySlug(page, PUBLISHED_SLUG)
      .getByTestId("article-card-link")
      .click();

    await expect(page).toHaveURL(new RegExp(`/news/${PUBLISHED_SLUG}$`));
    await expect(page.getByTestId("article-headline")).toHaveText(
      PUBLISHED.title,
    );
  });
});
