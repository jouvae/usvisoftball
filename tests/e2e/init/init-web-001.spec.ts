/*
---
id: init-web-001
name: "init-web-001: Public visitor reads the news feed"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-02-news-feed.md
  - docs/features/softball/init/scenarios.md
  - DESIGN.md
---

## Given
Published articles exist and an unauthenticated visitor opens `/news`.

## When
The feed loads.

## Then
Only `published` articles appear, newest first, each showing headline, category,
author byline, date, and hero image; and when no articles are published the feed
shows an empty state (not an error).
*/

import { test, expect, type Locator, type Page } from "@playwright/test";

// The canonical write/reset path (slice-02 §2.2, §9.2) — never a second insert
// path, never raw SQL. `lib/articles.ts` is `server-only`-fenced; the Playwright
// transform aliases `server-only` to a no-op via tests/tsconfig.json (see
// playwright.config.ts), so this import resolves under a plain-Node worker.
import { createArticle, deleteAllArticles } from "@/lib/articles";
// The EXACT three fixtures the seed also uses — imported so the seed and this
// spec can never drift (slice-02 §9).
import { SEED_ARTICLES } from "@/lib/seed/fixtures";

// ---------------------------------------------------------------------------
// Expectations derived from the canonical fixtures (§2.4 table). The two
// published fixtures, newest-first by published_at (desc). Per-card content
// (title / category / author / alt) is read straight from the fixtures so it
// cannot drift from what the seed writes.
// ---------------------------------------------------------------------------
const PUBLISHED_NEWEST_FIRST = SEED_ARTICLES.filter(
  (a) => a.status === "published",
).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

// Literal contract values (§9.3) — kept as concrete strings so a silently-empty
// or mis-ordered feed cannot pass by tautology.
const EXPECTED_SLUG_ORDER = [
  "st-croix-clinches-territory-title",
  "federation-launches-2026-season",
];
const DRAFT_SLUG = "unannounced-roster-shakeup";
const NEWEST_HEADLINE = "St. Croix Clinches the Territory Title";
// Deterministic formatted dates (§3.3) keyed by slug — the ONE thing not derived
// from the fixtures, so we assert the formatter's output against a fixed string.
const EXPECTED_DATE_BY_SLUG: Record<string, string> = {
  "st-croix-clinches-territory-title": "June 20, 2026",
  "federation-launches-2026-season": "March 1, 2026",
};

// Idempotent canonical seed: drive createArticle for each fixture, swallowing
// ONLY the slug unique-violation (Postgres 23505). Every other error re-throws
// loudly (§2.4) — an RLS/permission/connection failure must NOT be silently
// treated as "already seeded".
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

// Read `data-slug` in DOM order WITHOUT selecting by the data-testid string:
// scope to the feed container and read the attribute off each <li> (mirrors
// init-web-009's `navLinkOrder`).
async function feedSlugOrder(page: Page): Promise<(string | null)[]> {
  return page
    .getByTestId("news-feed")
    .locator("li")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-slug")));
}

function cardBySlug(page: Page, slug: string): Locator {
  return page.locator(`[data-testid="article-card"][data-slug="${slug}"]`);
}

// ===========================================================================
// Populated feed — the canonical/default DB state (§9.3). These assertions are
// content/order only (CSS reflow is irrelevant, §6), so they run under BOTH the
// desktop and mobile projects. The shared DB is seeded (idempotently) first.
// ===========================================================================
test.describe("init-web-001 — published feed, newest first", () => {
  test.beforeAll(async () => {
    // GIVEN: the canonical published + draft fixtures exist.
    await seedCanonicalArticles();
  });

  test.beforeEach(async ({ page }) => {
    // WHEN: an unauthenticated visitor opens /news and the feed loads.
    const res = await page.goto("/news");
    expect(res, "no response for /news").not.toBeNull();
    expect(res!.status()).toBe(200);
  });

  test("route responds 200 and renders the feed (not the empty state)", async ({
    page,
  }) => {
    await expect(page.getByTestId("news-feed")).toBeVisible();
    await expect(page.getByTestId("news-empty-state")).toHaveCount(0);
  });

  test("exactly 2 cards — published shown, draft excluded (RLS + query)", async ({
    page,
  }) => {
    // 2, not 3: proves the feed is non-empty AND the draft never leaks. A broken
    // RLS policy returning [] fails here rather than passing as "empty".
    await expect(page.getByTestId("article-card")).toHaveCount(2);
  });

  test("the draft article is absent by slug", async ({ page }) => {
    await expect(cardBySlug(page, DRAFT_SLUG)).toHaveCount(0);
  });

  test("cards are ordered newest-first", async ({ page }) => {
    await expect(page.getByTestId("article-card")).toHaveCount(2);
    expect(await feedSlugOrder(page)).toEqual(EXPECTED_SLUG_ORDER);
  });

  test("newest card shows its known headline", async ({ page }) => {
    // A concrete known string so a silently-empty / mis-ordered feed cannot pass.
    const firstCard = page.getByTestId("article-card").first();
    await expect(firstCard.getByTestId("article-card-headline")).toHaveText(
      NEWEST_HEADLINE,
    );
    await expect(
      firstCard.getByRole("heading", { level: 2 }),
    ).toHaveText(NEWEST_HEADLINE);
  });

  for (const fixture of PUBLISHED_NEWEST_FIRST) {
    test(`card content is complete for "${fixture.slug}"`, async ({ page }) => {
      // Scope every inner testid under the card locator — inner testids repeat
      // per card and are NOT globally unique (strict-mode safety, §4).
      const card = cardBySlug(page, fixture.slug);
      await expect(card).toHaveCount(1);

      await expect(card.getByTestId("article-card-headline")).toHaveText(
        fixture.title,
      );
      await expect(card.getByTestId("article-card-category")).toHaveText(
        fixture.category,
      );
      await expect(card.getByTestId("article-card-byline")).toHaveText(
        `By ${fixture.authorName}`,
      );
      await expect(card.getByTestId("article-card-date")).toHaveText(
        EXPECTED_DATE_BY_SLUG[fixture.slug],
      );
      await expect(card.getByTestId("article-card-image")).toHaveAttribute(
        "alt",
        fixture.coverImageAlt ?? "",
      );
    });
  }
});

// ===========================================================================
// Empty state — the ONLY DB-mutating test (§9.2). Desktop-only + serial so the
// two parallel projects cannot race the shared Supabase DB: truncate → assert
// the empty state → RE-SEED. If the re-seed fails the suite fails loudly rather
// than leaving the DB empty for the next run.
// ===========================================================================
test.describe.configure({ mode: "serial" });

test.describe("init-web-001 — empty state (desktop-only, mutating)", () => {
  // Playwright 1.61.1 types the describe-level `test.skip(callback)` as
  // `ConditionBody<TestArgs> = (args: TestArgs) => boolean` (test.d.ts ~2699):
  // it receives ONLY the fixtures, never testInfo — so `({}, testInfo) => …`
  // reads `.project` off undefined and throws before any assertion. Gate via a
  // beforeEach, the working pattern used throughout init-web-009. This keeps the
  // mutating test desktop-project-only so mobile cannot race the shared DB.
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "DB-mutating: confined to the desktop project so mobile cannot race it",
    ),
  );

  test("empty feed shows the empty state (HTTP 200, no error), then re-seeds", async ({
    page,
  }) => {
    // Truncate via the BYPASSRLS admin client (not raw SQL, not the public client).
    await deleteAllArticles();

    try {
      const res = await page.goto("/news");
      expect(res, "no response for /news").not.toBeNull();
      expect(res!.status()).toBe(200); // a normal state, never a thrown error

      await expect(page.getByTestId("news-empty-state")).toBeVisible();
      // Empty state and feed are mutually exclusive.
      await expect(page.getByTestId("news-feed")).toHaveCount(0);
      await expect(page.getByTestId("article-card")).toHaveCount(0);
      // Positive proof this is the intended empty UI, not an error boundary.
      await expect(page.getByRole("heading", { name: "No stories yet" })).toBeVisible();
    } finally {
      // Fail-closed: restore the baseline no matter how the assertions went. If
      // the re-seed itself fails, this throw surfaces and fails the suite rather
      // than poisoning the next run / the other project with an empty DB.
      await seedCanonicalArticles();
    }
  });
});
