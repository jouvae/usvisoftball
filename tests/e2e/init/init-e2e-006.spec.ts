/*
---
id: init-e2e-006
name: "init-e2e-006: Editor unpublishes a live article (slice 08)"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-08-editor-unpublish.md
  - docs/features/softball/init/slice-06-editor-publish.md
  - docs/features/softball/init/slice-03-article-page.md
  - DESIGN.md
---

## Given
Migrations `0001`–`0004` are applied out of band (NO new migration this slice —
`articles_editor_update` already permits `published → unpublished`; the
`0001` published-only anon read already hides a non-published row) and the seed
admin is provisioned with `roles=['editor']` (`npm run seed:admin`). This spec
never mints a session / raw-inserts a row on the ASSERTION path: it drives the
REAL Supabase sign-in UI and the REAL unpublish/re-publish Server Actions, so
RLS genuinely enforces as the editor (slice-08 §2, §3, §7). The ONE precondition
row is a `published` throwaway the editor did NOT author, admin-seeded in
`beforeAll` — sanctioned setup, exactly as init-web-001 seeds and init-e2e-005
tears down via the admin client (slice-08 §7).

## When
The signed-in editor opens the (broadened) editorial queue — which now surfaces
`published` rows, not just `in_review` — opens the throwaway in the review desk,
and UNPUBLISHES it (unpublishArticle Server Action).

## Then
The article transitions `published → unpublished` (the review chip flips to
Unpublished, the live link disappears, a Re-publish control appears), vanishes
from the public `/news` feed, and its `/news/[slug]` returns a real HTTP 404 for
anon (the same non-streamed property init-web-002 asserts for drafts) — WHILE
remaining visible in the editor's queue as `unpublished` for re-publish. The
bonus close proves re-publish returns it to the feed (slice-08 §8).
*/

import { test, expect } from "@playwright/test";

// SETUP + TEARDOWN ONLY (never the assertion path): the BYPASSRLS admin client
// seeds the ONE throwaway `published` precondition row and removes it afterwards
// so the feed returns to EXACTLY 2 published (init-web-001's `toHaveCount(2)`).
// Targeted by a marker-title prefix — NOT deleteAllArticles(), which would nuke
// the seeded published rows the feed specs depend on. `lib/articles.ts` /
// `lib/supabase/admin.ts` are `server-only`-fenced; the Playwright transform
// aliases `server-only` to a no-op via tests/tsconfig.json (see
// playwright.config.ts), so these imports resolve under the plain-Node worker
// (identical to how init-e2e-005 pulls createArticle / createAdminClient).
import { createArticle } from "@/lib/articles";
import { createAdminClient } from "@/lib/supabase/admin";
// A per-run unique marker keeps the spec deterministic + re-runnable: the
// throwaway title/slug can never collide with a fixture or a prior run, and the
// on-feed / off-feed checks cannot pass by matching a pre-existing row.
import { randomUUID } from "node:crypto";

// The seed admin IS the editor (slice-06 §0 / slice-08 §7: `assignRoles` gives
// it `roles=['editor']`). Credentials live ONLY in the gitignored `.env.local`,
// which playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE
// workers spawn. We do NOT import lib/* into the ASSERTION path — only the
// seed/teardown helpers below touch the admin client.
const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// Manually-created browser contexts (the fresh anon off-feed + 404 checks) do
// NOT inherit the project's `use.baseURL`, so we resolve it the same way the
// config does (mirrors init-e2e-003).
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

// Stable, fixture-free title prefix — used to build the per-run marker AND to
// target teardown. No seed fixture uses it, so a prefix-scoped delete only ever
// removes this spec's throwaway (and any leftover from a prior aborted run —
// which, because the throwaway is `published`, would otherwise be a stray 3rd
// card on the shared feed: heal-by-marker in beforeAll removes it, slice-08 §7).
const MARKER_PREFIX = "[e2e-006] editor unpublish";

// Populated by beforeAll so the test can target the exact seeded row.
let markerTitle = "";
let seededSlug = "";

function requireCreds(): { email: string; password: string } {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local). " +
        "Run `npm run seed:admin` before this spec — the seed admin (roles=['editor']) is a documented precondition.",
    );
  }
  return { email: EDITOR_EMAIL, password: EDITOR_PASSWORD };
}

// Drive the REAL sign-in form (the init-e2e-005 helper shape), then assert the
// Server-Action redirect landed on the dashboard. The editor sign-in itself
// SUCCEEDS — the RED failure must land later, at the first missing slice-08
// element (the broadened editorial queue surfacing the published throwaway).
async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Targeted teardown: remove every article whose title starts with the marker
// prefix. `%` is the SQL LIKE wildcard; the prefix has no `_`/`%`, so the match
// is a literal-prefix match. Runs even on the skipped mobile project (deletes
// nothing there) — harmless + idempotent. NEVER deleteAllArticles().
async function deleteMarkedArticles(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .delete()
    .like("title", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

// ===========================================================================
// The happy path is inherently sequential + stateful (the review id and the
// queued row flow from the seed), so it compiles to ONE test. The real sign-in
// mutates a shared Supabase session and none of the assertions are
// viewport-specific, so it runs ONCE (desktop project) — mirroring init-e2e-005's
// gating so the two projects don't redundantly re-drive the same auth + write
// flow against one shared DB (workers:1, fullyParallel:false).
//
// NOTE ON THE 3-PUBLISHED WINDOW (slice-08 §7 / QA (c)): unlike init-e2e-005
// (which seeds an `in_review` throwaway, invisible to the feed), THIS spec seeds
// a `published` throwaway, so a 3rd published card exists on the shared feed from
// beforeAll until the UI unpublish step. That is safe ONLY because the suite runs
// serially (workers:1) and this file's teardown restores the feed to exactly 2
// BEFORE init-web-001 runs. Do NOT re-parallelize the config.
// ===========================================================================
test.describe("init-e2e-006 — editor unpublishes a live article (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + unpublish flow, no viewport dependence — run once against the shared DB",
    ),
  );

  // GIVEN (precondition): first HEAL any leftover from a prior aborted run (which,
  // for a `published` throwaway, would be a stray 3rd feed card), THEN seed exactly
  // ONE throwaway `published` row the editor did NOT author (authorId:null,
  // source:'human', publishedAt set — the 0001 CHECK requires non-null for
  // published) via the BYPASSRLS admin client — sanctioned setup (slice-08 §7).
  // Unique marker title + slug per run.
  test.beforeAll(async () => {
    await deleteMarkedArticles();

    const runId = randomUUID();
    markerTitle = `${MARKER_PREFIX} ${runId}`;
    seededSlug = `e2e-006-editor-unpublish-${runId}`;

    await createArticle({
      title: markerTitle,
      slug: seededSlug,
      body: "The seeded live body — the editor UNPUBLISHES this article.",
      excerpt: "A live story, about to be retired.",
      coverImageUrl: "/seed/season-opener.png",
      coverImageAlt: "Players taking the field on opening day",
      authorName: "USVI Softball Federation",
      authorId: null, // the editor did NOT author it — proves the editor-wide read
      category: "Championships",
      status: "published",
      publishedAt: new Date().toISOString(), // the 0001 published⇒published_at CHECK
      source: "human",
    });
  });

  // Fail-closed cleanup so the feed returns to EXACTLY 2 published (init-web-001
  // stays green) and the next run starts clean. Targeted — never
  // deleteAllArticles(). Teardown MAY use the admin client (NOT the assertion path).
  test.afterAll(async () => {
    await deleteMarkedArticles();
  });

  test("editor reaches the live throwaway in the queue, unpublishes it, it leaves /news + 404s, stays in the queue as unpublished, and re-publishes", async ({
    page,
    browser,
  }) => {
    const { email, password } = requireCreds();

    // ---------------------------------------------------------------------
    // 1. Confirm the GIVEN is live: the published throwaway shows on the public
    //    /news feed and its article page renders (headline = marker title).
    //    Presence, not count — during this window there are 3 published (the two
    //    fixtures + the throwaway); afterAll restores the feed to exactly 2.
    // ---------------------------------------------------------------------
    const feedResBefore = await page.goto("/articles");
    expect(feedResBefore, "no response for /news").not.toBeNull();
    expect(feedResBefore!.status()).toBe(200);
    await expect(
      page.locator(`[data-testid="article-card"][data-slug="${seededSlug}"]`),
    ).toHaveCount(1);

    const articleResBefore = await page.goto(`/articles/${seededSlug}`);
    expect(articleResBefore, "no response for the article page").not.toBeNull();
    expect(articleResBefore!.status()).toBe(200);
    await expect(page.getByTestId("article-headline")).toHaveText(markerTitle);

    // ---------------------------------------------------------------------
    // 2. Sign in as the editor and open the editorial queue.
    // ---------------------------------------------------------------------
    await signIn(page, email, password);
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    await page.getByTestId("admin-queue-link").click();
    await expect(page).toHaveURL(/\/admin\/queue$/);

    // The BROADENED editorial queue (listEditorialQueue) now surfaces `published`
    // rows, not just `in_review`. Before slice 08 the queue lists only in_review,
    // so an unbuilt run fails HERE — the throwaway is absent (the intended RED).
    // filter({ hasText }) + auto-retrying toHaveCount(1) — never a bare count().
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const row = page.getByTestId("queue-item").filter({ hasText: markerTitle });
    await expect(row).toHaveCount(1);
    // Anchored regex: the "Unpublished" label CONTAINS the substring "published",
    // so an unanchored /published/i would also match an unpublished row. Anchor to
    // assert the row is genuinely PUBLISHED here (and genuinely UNPUBLISHED later).
    await expect(row.getByTestId("queue-item-status")).toContainText(
      /^published$/i,
    );

    // ---------------------------------------------------------------------
    // 3. Open the review desk; it shows Published + the live link + Unpublish.
    // ---------------------------------------------------------------------
    await row.getByTestId("queue-item-title").click();
    await expect(page).toHaveURL(/\/admin\/review\/[^/]+$/);
    await expect(page.getByTestId("review-view")).toBeVisible();
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /^published$/i,
    );
    await expect(page.getByTestId("review-live-link")).toBeVisible();
    await expect(page.getByTestId("unpublish-article")).toBeVisible();

    // ---------------------------------------------------------------------
    // 4. Unpublish (unpublishArticle Server Action → RLS-enforced as the editor via
    //    articles_editor_update; sets status='unpublished'). The chip flips to
    //    Unpublished, the live link disappears, and the Re-publish control appears
    //    — all shipped by revalidation in the same roundtrip (auto-retrying expect).
    // ---------------------------------------------------------------------
    await page.getByTestId("unpublish-article").click();
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /^unpublished$/i,
    );
    await expect(page.getByTestId("review-live-link")).toHaveCount(0);
    await expect(page.getByTestId("republish-article")).toBeVisible();

    // ---------------------------------------------------------------------
    // 5 + 6. From a FRESH anon context (no editor cookie), the unpublished article
    //    is GONE from /news and its slug returns a REAL HTTP 404. A fresh context
    //    proves RLS — not the UI — hides the non-published row (mirrors init-e2e-003
    //    / init-web-002). The 404 is read straight off the navigation response, the
    //    streamed-response-sensitive check the no-`loading.tsx` constraint guards.
    // ---------------------------------------------------------------------
    const anon = await browser.newContext({ baseURL: BASE_URL });
    try {
      const anonPage = await anon.newPage();

      const anonFeedRes = await anonPage.goto("/articles");
      expect(anonFeedRes, "no response for anon /news").not.toBeNull();
      expect(anonFeedRes!.status()).toBe(200);
      await expect(
        anonPage.locator(
          `[data-testid="article-card"][data-slug="${seededSlug}"]`,
        ),
      ).toHaveCount(0);

      const anonSlugRes = await anonPage.goto(`/articles/${seededSlug}`);
      expect(anonSlugRes, "no response for the anon article page").not.toBeNull();
      expect(anonSlugRes!.status()).toBe(404);
      await expect(anonPage.getByTestId("article-not-found")).toBeVisible();
      // Nothing article-shaped rendered — the unpublished body never leaks.
      await expect(anonPage.getByTestId("article-headline")).toHaveCount(0);
    } finally {
      await anon.close();
    }

    // ---------------------------------------------------------------------
    // 7. Remains in the EDITOR queue as `unpublished` — the editor can still reach
    //    it for re-publish (the "while remaining visible … for re-publish" clause).
    // ---------------------------------------------------------------------
    await page.goto("/admin/queue");
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const unpublishedRow = page
      .getByTestId("queue-item")
      .filter({ hasText: markerTitle });
    await expect(unpublishedRow).toHaveCount(1);
    await expect(
      unpublishedRow.getByTestId("queue-item-status"),
    ).toContainText(/^unpublished$/i);

    // ---------------------------------------------------------------------
    // 8. BONUS — proves "for re-publish": re-open the review desk, click
    //    Re-publish (reuses the publishArticle action), and the article returns to
    //    Published, the live link returns, and it reappears on the public /news
    //    feed (fresh anon context). afterAll deletes the throwaway regardless.
    // ---------------------------------------------------------------------
    await unpublishedRow.getByTestId("queue-item-title").click();
    await expect(page).toHaveURL(/\/admin\/review\/[^/]+$/);
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /^unpublished$/i,
    );
    await page.getByTestId("republish-article").click();
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /^published$/i,
    );
    await expect(page.getByTestId("review-live-link")).toBeVisible();

    const anonAfter = await browser.newContext({ baseURL: BASE_URL });
    try {
      const anonAfterPage = await anonAfter.newPage();
      const res = await anonAfterPage.goto("/articles");
      expect(res, "no response for anon /news (re-publish)").not.toBeNull();
      expect(res!.status()).toBe(200);
      await expect(
        anonAfterPage.locator(
          `[data-testid="article-card"][data-slug="${seededSlug}"]`,
        ),
      ).toHaveCount(1);
    } finally {
      await anonAfter.close();
    }
  });
});
