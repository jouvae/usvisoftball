/*
---
id: articles-index
name: "articles-index: Articles index client-side search + category filter"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - app/(public)/articles/page.tsx
  - components/client/articles-browser.tsx
  - components/ui/article-feed.tsx
  - components/ui/article-card.tsx
---

## Given
The public /articles page renders <h1>Articles</h1> and the <ArticlesBrowser>
client island over the live published-article list.

## When
A visitor uses the search input and category select to filter the feed.

## Then
- The controls render (search input, category select whose first option is "all",
  and the count line).
- Typing a query that matches a rendered card title narrows the feed to matching
  cards, and the count line tracks the visible card count.
- Selecting a specific category shows only that category's cards (<= initial total)
  with the count line in agreement; resetting to "all" restores the full list.
- A query that matches nothing shows articles-no-results, hides the feed, and the
  count line reads "0 articles".

SEED-AGNOSTIC: every expected value is derived from the live DOM, never hardcoded.
Real browser → running Next.js dev server → live Supabase read. No mocks, no seeding.
*/

import { test, expect, type Page } from "@playwright/test";

// The count line reads "N articles" / "1 article"; pull the leading integer out.
async function readCount(page: Page): Promise<number> {
  const text = (await page.getByTestId("articles-count").textContent()) ?? "";
  const match = text.match(/(\d+)/);
  expect(match, `articles-count had no number: "${text}"`).not.toBeNull();
  return Number(match![1]);
}

// Pick the longest word from a card headline so the derived query is distinctive
// enough to be a real narrowing, while still guaranteed to match >=1 card.
function longestWord(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
}

test.beforeEach(async ({ page }) => {
  await page.goto("/articles");
  // The island only mounts when >=1 published article exists. These behavioral
  // assertions require a non-empty feed; the empty-state path is covered elsewhere
  // (init-web-001). Fail loudly rather than pass vacuously if the DB is empty.
  await expect(page.getByRole("heading", { level: 1, name: "Articles" })).toBeVisible();
  await expect(page.getByTestId("articles-search")).toBeVisible();
});

test.describe("articles-index — controls render", () => {
  test("search input, category select (first option 'all'), and count line render", async ({
    page,
  }) => {
    const search = page.getByTestId("articles-search");
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute("type", "search");

    const select = page.getByTestId("articles-category");
    await expect(select).toBeVisible();
    // First option is the sentinel value="all".
    const firstOption = select.locator("option").first();
    await expect(firstOption).toHaveAttribute("value", "all");
    await expect(firstOption).toHaveText("All categories");
    // The control starts on "all".
    await expect(select).toHaveValue("all");

    // Count line renders and agrees with the number of visible cards.
    await expect(page.getByTestId("articles-count")).toBeVisible();
    const initialCount = await readCount(page);
    await expect(page.getByTestId("article-card")).toHaveCount(initialCount);
    expect(initialCount).toBeGreaterThan(0);
  });
});

test.describe("articles-index — text search narrows the feed", () => {
  test("typing a rendered title substring narrows cards and the count tracks them", async ({
    page,
  }) => {
    const initialCount = await readCount(page);

    // Derive the query from an ACTUAL rendered card title — no assumed content.
    const firstTitle =
      (await page.getByTestId("article-card-headline").first().textContent()) ?? "";
    const query = longestWord(firstTitle);
    expect(query, `no usable word in title "${firstTitle}"`).toBeTruthy();

    await page.getByTestId("articles-search").fill(query);

    // The feed narrows: at least one match, never more than the initial total.
    const filteredCount = await readCount(page);
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // The count line matches the number of cards actually rendered.
    await expect(page.getByTestId("article-card")).toHaveCount(filteredCount);

    // The card the query was derived from is still present.
    await expect(
      page.getByTestId("article-card-headline").filter({ hasText: firstTitle }),
    ).toHaveCount(1);
  });
});

test.describe("articles-index — category filter", () => {
  test("selecting a category shows only its cards; 'all' restores the full list", async ({
    page,
  }) => {
    const initialCount = await readCount(page);
    const select = page.getByTestId("articles-category");

    // Every option value except the "all" sentinel is a real category.
    const values = await select.locator("option").evaluateAll((opts) =>
      (opts as HTMLOptionElement[]).map((o) => o.value),
    );
    const categories = values.filter((v) => v !== "all");
    expect(categories.length, "expected >=1 distinct category").toBeGreaterThan(0);

    const category = categories[0];
    await select.selectOption(category);

    const filteredCount = await readCount(page);
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Count line agrees with the number of visible cards.
    await expect(page.getByTestId("article-card")).toHaveCount(filteredCount);
    // Every visible card belongs to the chosen category.
    await expect(page.getByTestId("article-card-category")).toHaveCount(filteredCount);
    const shownCategories = await page
      .getByTestId("article-card-category")
      .allTextContents();
    for (const shown of shownCategories) {
      expect(shown.trim()).toBe(category);
    }

    // Resetting to "all" restores the full list.
    await select.selectOption("all");
    await expect(page.getByTestId("articles-count")).toHaveText(
      new RegExp(`^${initialCount}\\b`),
    );
    await expect(page.getByTestId("article-card")).toHaveCount(initialCount);
  });
});

test.describe("articles-index — no results", () => {
  test("a non-matching query shows the empty message, hides the feed, and reads '0 articles'", async ({
    page,
  }) => {
    // A random uuid-like token that cannot appear in any title/excerpt/author/category.
    const impossible = "zzz-" + crypto.randomUUID();
    await page.getByTestId("articles-search").fill(impossible);

    await expect(page.getByTestId("articles-no-results")).toBeVisible();
    // The feed list itself is gone (not merely empty).
    await expect(page.getByTestId("news-feed")).toHaveCount(0);
    await expect(page.getByTestId("article-card")).toHaveCount(0);
    await expect(page.getByTestId("articles-count")).toHaveText("0 articles");
  });
});
