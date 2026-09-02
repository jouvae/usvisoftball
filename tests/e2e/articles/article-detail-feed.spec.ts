/*
---
id: article-detail-feed
name: "article-detail-feed: Article detail continued feed (other published articles, excl. current)"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - app/(public)/articles/[slug]/page.tsx
  - lib/articles.ts
  - components/ui/article-feed.tsx
  - components/ui/article-card.tsx
---

## Given
A visitor opens an article detail page at /articles/[slug]. There are >=2 published
articles in the live DB.

## When
The detail page renders.

## Then
- The article headline (data-testid="article-headline") renders.
- A "continued feed" section (data-testid="article-continued-feed") renders with an
  <h2>More stories</h2> and a news-feed (data-testid="news-feed") of >=1 article-card.
- The current article NEVER appears in its own continued feed (exclusion).
- The set of hrefs in the continued feed equals every OTHER published detail href
  (all published index hrefs minus the current one), newest-first.

## Edge
When only ONE published article exists the section is omitted entirely; the
exclusion/feed assertions test.skip with a clear message.

SEED-AGNOSTIC: every expected value (slugs, hrefs, counts, dates) is derived from the
live DOM, never hardcoded. Real browser -> running Next.js dev server -> live Supabase
read. No mocks, no seeding.
*/

import { test, expect, type Page, type Locator } from "@playwright/test";

// Reduce every href to its pathname so relative ("/articles/x") and absolute
// (page.goto-resolved) forms compare equal.
function pathOf(href: string, base: string): string {
  return new URL(href, base).pathname;
}

// The ordered, de-duplicated list of published detail pathnames as the /articles
// index renders them (default state: no filter, full published list).
async function collectIndexHrefs(page: Page): Promise<string[]> {
  await page.goto("/articles");
  await expect(
    page.getByRole("heading", { level: 1, name: "Articles" }),
  ).toBeVisible();
  await expect(page.getByTestId("news-feed")).toBeVisible();

  const links = page.getByTestId("news-feed").getByTestId("article-card-link");
  const hrefs = await links.evaluateAll((els) =>
    (els as HTMLAnchorElement[]).map((a) => a.getAttribute("href") ?? ""),
  );
  const base = page.url();
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const h of hrefs) {
    const p = pathOf(h, base);
    if (!seen.has(p)) {
      seen.add(p);
      ordered.push(p);
    }
  }
  return ordered;
}

// The continued-feed card hrefs (as pathnames) in DOM order.
async function feedHrefs(feed: Locator, base: string): Promise<string[]> {
  const raw = await feed
    .getByTestId("article-card-link")
    .evaluateAll((els) =>
      (els as HTMLAnchorElement[]).map((a) => a.getAttribute("href") ?? ""),
    );
  return raw.map((h) => pathOf(h, base));
}

test.describe("article-detail-feed", () => {
  test("detail page renders the headline and a continued feed of other articles", async ({
    page,
  }) => {
    const published = await collectIndexHrefs(page);
    expect(published.length, "expected >=1 published article").toBeGreaterThan(0);
    test.skip(
      published.length < 2,
      `only ${published.length} published article; the continued-feed section is intentionally omitted`,
    );

    await page.goto(published[0]);

    // The article itself rendered.
    await expect(page.getByTestId("article-headline")).toBeVisible();

    // The continued-feed section rendered with its heading and a non-empty feed.
    const feed = page.getByTestId("article-continued-feed");
    await expect(feed).toBeVisible();
    await expect(
      feed.getByRole("heading", { level: 2, name: "More stories" }),
    ).toBeVisible();
    await expect(feed.getByTestId("news-feed")).toBeVisible();
    const cardCount = await feed.getByTestId("article-card").count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("the current article is excluded from its own continued feed", async ({
    page,
  }) => {
    const published = await collectIndexHrefs(page);
    test.skip(
      published.length < 2,
      `only ${published.length} published article; nothing to exclude`,
    );

    const current = published[0];
    await page.goto(current);

    const feed = page.getByTestId("article-continued-feed");
    await expect(feed).toBeVisible();

    const inFeed = await feedHrefs(feed, page.url());
    expect(inFeed.length).toBeGreaterThan(0);
    // The article never links to itself in its own continued feed.
    expect(
      inFeed,
      `continued feed must not contain the current article ${current}`,
    ).not.toContain(current);
  });

  test("the continued feed equals the OTHER published articles, newest-first", async ({
    page,
  }) => {
    const published = await collectIndexHrefs(page);
    test.skip(
      published.length < 2,
      `only ${published.length} published article; the section is omitted`,
    );

    const current = published[0];
    await page.goto(current);

    const feed = page.getByTestId("article-continued-feed");
    await expect(feed).toBeVisible();

    // Set equality: feed == (all published) minus (current). Compared as sets so a
    // pure ordering difference doesn't cause flakiness — order is checked separately.
    const inFeed = await feedHrefs(feed, page.url());
    const expected = published.filter((p) => p !== current);
    expect([...inFeed].sort()).toEqual([...expected].sort());

    // Ordering: the card DOM exposes published dates via <time datetime> on
    // article-card-date, so assert newest-first (non-increasing) directly.
    const isoDates = await feed
      .getByTestId("article-card-date")
      .evaluateAll((els) =>
        (els as HTMLTimeElement[]).map((t) => t.getAttribute("datetime") ?? ""),
      );
    const usable = isoDates.filter((d) => d.length > 0);
    // Only assert strict order when every card exposed a parseable date.
    if (usable.length === isoDates.length && isoDates.length > 1) {
      const times = isoDates.map((d) => new Date(d).getTime());
      const sortedDesc = [...times].sort((a, b) => b - a);
      expect(times, "continued feed must be newest-first").toEqual(sortedDesc);
    }
  });
});
