/*
---
id: init-e2e-005
name: "init-e2e-005: Editor reviews, edits the body, and publishes an in_review article (slice 06)"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-06-editor-publish.md
  - docs/features/softball/init/slice-05-contributor-draft.md
  - DESIGN.md
---

## Given
Migration `0004_editor_policies.sql` is applied out of band (the two permissive
`articles_editor_read_all` / `articles_editor_update` policies) and the slice-04
seed admin is provisioned with `roles=['editor']` (`npm run seed:admin` →
`assignRoles`, slice-06 §0). This spec never mints a session / raw-inserts a row
on the ASSERTION path: it drives the REAL Supabase sign-in UI and the REAL
publish Server Action, so RLS genuinely enforces as the editor (slice-06 §2, §6).
The ONE precondition row (an `in_review` throwaway the editor did NOT author) is
admin-seeded in `beforeAll` — sanctioned setup, exactly as init-web-001 seeds and
init-e2e-003 tears down via the admin client (slice-06 §6).

## When
The signed-in editor opens the editorial queue (which now surfaces EVERY
`in_review` row via the editor-wide read, not just their own), opens the throwaway
in the review desk, EDITS the body, and PUBLISHES it (publishArticle).

## Then
The article transitions `in_review → published` (the review status chip flips to
Published), appears on the public `/news` feed, and its `/news/[slug]` page renders
with the EDITED body — proving the editor UPDATE policy enforced, `published_at`
was set (the 0001 CHECK backstop), and the body edit persisted (slice-06 §7).
*/

import { test, expect } from "@playwright/test";

// SETUP + TEARDOWN ONLY (never the assertion path): the BYPASSRLS admin client
// seeds the ONE throwaway `in_review` precondition row and removes it afterwards
// so the feed returns to EXACTLY 2 published (init-web-001's `toHaveCount(2)`).
// Targeted by a marker-title prefix — NOT deleteAllArticles(), which would nuke
// the seeded published rows the feed specs depend on. `lib/articles.ts` /
// `lib/supabase/admin.ts` are `server-only`-fenced; the Playwright transform
// aliases `server-only` to a no-op via tests/tsconfig.json (see
// playwright.config.ts), so these imports resolve under the plain-Node worker
// (identical to how init-web-001 pulls createArticle / deleteAllArticles).
import { createArticle } from "@/lib/articles";
import { createAdminClient } from "@/lib/supabase/admin";
// A per-run unique marker keeps the spec deterministic + re-runnable: the
// throwaway title/slug can never collide with a fixture or a prior run, and the
// on-feed check cannot pass by matching a pre-existing row.
import { randomUUID } from "node:crypto";

// The seed admin IS the editor (slice-06 §0: `assignRoles` gives it
// `roles=['editor']`). Credentials live ONLY in the gitignored `.env.local`,
// which playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE
// workers spawn (identical to init-e2e-003 / init-e2e-003a). We do NOT import
// lib/* into the ASSERTION path — only the seed/teardown helpers below touch the
// admin client.
const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// Stable, fixture-free title prefix — used to build the per-run marker AND to
// target teardown. No seed fixture uses it, so a prefix-scoped delete only ever
// removes this spec's throwaway (and any leftover from a prior aborted run).
const MARKER_PREFIX = "[e2e-005] editor publish";

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

// Drive the REAL sign-in form (the init-e2e-003 / init-e2e-003a helper shape),
// then assert the Server-Action redirect landed on the dashboard. The editor
// sign-in itself SUCCEEDS — the RED failure must land later, at the first missing
// slice-06 element (the editor's queue link / the review route / its testids).
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
// viewport-specific, so it runs ONCE (desktop project) — mirroring
// init-e2e-003 / init-e2e-003a's positive-direction gating so the two projects
// don't redundantly re-drive the same auth + write flow against one shared DB
// (workers:1, fullyParallel:false). Playwright types the describe-level
// test.skip callback with fixtures only (never testInfo), so gate via beforeEach.
// ===========================================================================
test.describe("init-e2e-005 — editor reviews, edits, and publishes (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + publish flow, no viewport dependence — run once against the shared DB",
    ),
  );

  // GIVEN (precondition): first HEAL any leftover from a prior aborted run, then
  // seed exactly ONE throwaway `in_review` row the editor did NOT author
  // (authorId:null, source:'human') via the BYPASSRLS admin client — sanctioned
  // setup (slice-06 §6). Unique marker title + slug per run.
  test.beforeAll(async () => {
    await deleteMarkedArticles();

    const runId = randomUUID();
    markerTitle = `${MARKER_PREFIX} ${runId}`;
    seededSlug = `e2e-005-editor-publish-${runId}`;

    await createArticle({
      title: markerTitle,
      slug: seededSlug,
      body: "The seeded in_review body — the editor REPLACES this before publishing.",
      excerpt: "Awaiting editorial review.",
      coverImageUrl: "/seed/season-opener.png",
      coverImageAlt: "Players taking the field on opening day",
      authorName: "USVI Softball Federation",
      authorId: null, // the editor did NOT author it — proves the editor-wide read
      category: "Championships",
      status: "in_review",
      source: "human",
    });
  });

  // Fail-closed cleanup so the feed returns to EXACTLY 2 published (init-web-001
  // stays green) and the next run starts clean. Targeted — never
  // deleteAllArticles(). Teardown MAY use the admin client (NOT the assertion path).
  test.afterAll(async () => {
    await deleteMarkedArticles();
  });

  test("editor sees the unauthored in_review row, edits its body, publishes it, and it goes live on /news", async ({
    page,
  }) => {
    const { email, password } = requireCreds();

    // A UNIQUE edited-body marker — proves the body EDIT (not merely the seeded
    // body) persisted through publish and rendered on the public article page.
    const editedBody = `[e2e-005] edited body ${randomUUID()}`;

    // GIVEN: a signed-in editor on the dashboard.
    await signIn(page, email, password);

    // WHEN: they open the editorial queue via the role-gated nav link. (Slice 06
    // adds admin-queue-link for the editor; before it is built an unbuilt-06 run
    // fails HERE — the first missing slice-06 element, the intended RED.)
    await expect(page.getByTestId("admin-nav")).toBeVisible();
    await page.getByTestId("admin-queue-link").click();
    await expect(page).toHaveURL(/\/admin\/queue$/);

    // The editor-wide read (articles_editor_read_all) surfaces a row the editor
    // did NOT author. filter({ hasText }) + auto-retrying toHaveCount(1) — never a
    // bare count() (the recorded false-defect gotcha).
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const row = page.getByTestId("queue-item").filter({ hasText: markerTitle });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("queue-item-status")).toContainText(
      /in.?review/i,
    );

    // Open the review desk for this row (editor queue links → /admin/review/[id]).
    await row.getByTestId("queue-item-title").click();
    await expect(page).toHaveURL(/\/admin\/review\/[^/]+$/);
    await expect(page.getByTestId("review-view")).toBeVisible();
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /in.?review/i,
    );
    await expect(page.getByTestId("review-source")).toContainText(/human/i);

    // Edit the body, then publish (publishArticle Server Action → RLS-enforced as
    // the editor via articles_editor_update; sets status='published' + published_at).
    await page.getByTestId("editor-body").fill(editedBody);
    await page.getByTestId("publish-article").click();

    // The status chip flips to Published (auto-retrying expect ships the fresh
    // status via revalidation in the same roundtrip).
    await expect(page.getByTestId("review-status-badge")).toHaveText(
      /published/i,
    );

    // THEN: the now-published article appears on the public /news feed. Presence,
    // not count — during this window there are 3 published (the two fixtures + the
    // throwaway); afterAll restores the feed to exactly 2.
    const feedRes = await page.goto("/news");
    expect(feedRes, "no response for /news").not.toBeNull();
    expect(feedRes!.status()).toBe(200);
    await expect(
      page.locator(
        `[data-testid="article-card"][data-slug="${seededSlug}"]`,
      ),
    ).toHaveCount(1);

    // ...and its article page renders with the EDITED body (proves the body edit
    // persisted + rendered, React-escaped).
    const articleRes = await page.goto(`/news/${seededSlug}`);
    expect(articleRes, "no response for the article page").not.toBeNull();
    expect(articleRes!.status()).toBe(200);
    await expect(page.getByTestId("article-headline")).toHaveText(markerTitle);
    await expect(page.getByTestId("article-body")).toContainText(editedBody);
  });
});
