/*
---
id: init-e2e-003
name: "init-e2e-003: Contributor creates + submits a draft (slice 05b happy path)"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-05-contributor-draft.md
  - docs/features/softball/init/slice-04-admin-auth.md
  - DESIGN.md
---

## Given
Migration `0003_profiles_and_authorship.sql` is applied and the seed contributor
is provisioned out of band (`npm run seed:contributor` → `profiles.roles`
contains `contributor`) — the same documented precondition proven live by 05a
(`init-e2e-003a`). This spec never mints a session / raw-inserts a row: it drives
the REAL Supabase sign-in UI and the REAL create/submit Server Actions, so RLS
genuinely enforces as the contributor (slice-05 §2).

## When
The signed-in contributor opens the new-article form, fills a UNIQUE draft
(title / body / category / hero + hero-alt), SAVES it (createDraft), lands on the
`[id]` editor, and SUBMITS it for review (submitForReview).

## Then
The draft is stored as `source=human`, transitions `draft → in_review`, appears
in the editorial queue with an `in_review` status, and is NOT visible on the
public `/news` feed to an anonymous visitor (RLS keeps non-published invisible).
This is 05b — the full `init-e2e-003` end-to-end on the proven 05a foundation
(slice-05 §6, §7).
*/

import { test, expect } from "@playwright/test";

// TEARDOWN ONLY (never the assertion path): the BYPASSRLS admin client removes
// the drafts THIS spec created so the suite is re-runnable and the queue does not
// accumulate. Targeted by a marker title prefix — NOT deleteAllArticles(), which
// would nuke the seeded published rows the feed specs depend on. `lib/supabase/
// admin.ts` is `server-only`-fenced; the Playwright transform aliases
// `server-only` to a no-op via tests/tsconfig.json (see playwright.config.ts), so
// this import resolves under the plain-Node worker (identical to how
// init-web-001 pulls deleteAllArticles).
import { createAdminClient } from "@/lib/supabase/admin";
// A per-run unique marker keeps the spec deterministic + re-runnable: the draft
// title can never collide with a fixture or a prior run, and the absent-from-feed
// check cannot pass by matching a pre-existing row.
import { randomUUID } from "node:crypto";

// Credentials live ONLY in the gitignored `.env.local`, which
// playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE workers
// spawn (identical to init-e2e-003a / init-e2e-008). We do NOT import lib/* or
// lib/supabase/* into the ASSERTION path — only the teardown helper below touches
// the admin client.
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;

// Manually-created browser contexts (the fresh anon feed check) do NOT inherit
// the project's `use.baseURL`, so we resolve it the same way the config does.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

// Stable, fixture-free title prefix — used to build the per-run marker AND to
// target teardown. No seed fixture uses it, so a prefix-scoped delete only ever
// removes this spec's drafts (and any leftovers from a prior aborted run).
const MARKER_PREFIX = "[e2e-003] contributor draft";

function requireCreds(): { email: string; password: string } {
  if (!CONTRIBUTOR_EMAIL || !CONTRIBUTOR_PASSWORD) {
    throw new Error(
      "SEED_CONTRIBUTOR_EMAIL / SEED_CONTRIBUTOR_PASSWORD must be set (gitignored .env.local). " +
        "Run `npm run seed:contributor` before this spec — the contributor user + role are documented preconditions.",
    );
  }
  return { email: CONTRIBUTOR_EMAIL, password: CONTRIBUTOR_PASSWORD };
}

// Drive the REAL sign-in form (the init-e2e-003a / init-e2e-008 helper shape),
// then assert the Server-Action redirect landed on the dashboard. 05a is live, so
// this SUCCEEDS — the RED failure must land later, at the first missing 05b element.
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

// Targeted teardown: remove every draft whose title starts with the marker
// prefix. `%` is the SQL LIKE wildcard; the prefix has no `_`/`%`, so the match
// is a literal-prefix match. Runs even on the skipped mobile project (deletes
// nothing there) — harmless + idempotent.
async function deleteMarkedDrafts(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .delete()
    .like("title", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

// ===========================================================================
// The happy path is inherently sequential + stateful (the editor id and the
// queued row flow from the create), so it compiles to ONE test. The real
// sign-in mutates a shared Supabase session and none of the assertions are
// viewport-specific, so it runs ONCE (desktop project) — mirroring
// init-e2e-003a / init-e2e-008's positive-direction gating so the two projects
// don't redundantly re-drive the same auth + write flow against one shared DB
// (workers:1, fullyParallel:false). Playwright types the describe-level
// test.skip callback with fixtures only (never testInfo), so gate via beforeEach.
// ===========================================================================
test.describe("init-e2e-003 — contributor creates + submits a draft (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + write flow, no viewport dependence — run once against the shared DB",
    ),
  );

  // Fail-closed cleanup so the queue never accumulates and the next run starts
  // clean. Teardown MAY use the admin client (it is NOT the assertion path).
  test.afterAll(async () => {
    await deleteMarkedDrafts();
  });

  test("creates a human draft, submits it for review, and it stays off the public feed", async ({
    page,
    browser,
  }) => {
    const { email, password } = requireCreds();

    // A UNIQUE marker title per run — the anti-tautology + re-runnability anchor.
    const markerTitle = `${MARKER_PREFIX} ${randomUUID()}`;

    // GIVEN: a signed-in contributor on the dashboard (05a — proven live).
    await signIn(page, email, password);

    // WHEN: they open the new-article form via the role-gated nav link. (05b:
    // this link does not exist yet, so an unbuilt-05b run fails HERE — the first
    // missing 05b element, exactly the intended RED.)
    await page.getByTestId("admin-new-article-link").click();
    await expect(page).toHaveURL(/\/admin\/articles\/new$/);
    await expect(page.getByTestId("admin-new-article")).toBeVisible();

    // ...and fill a unique draft: title / body / category / hero + hero-alt. The
    // hero is a path over the seeded `public/seed/*.png` (no upload pipeline yet).
    await page.getByTestId("draft-title").fill(markerTitle);
    await page
      .getByTestId("draft-body")
      .fill("A contributor-authored draft body created by init-e2e-003.");
    await page.getByTestId("draft-category").fill("Championships");
    await page.getByTestId("draft-hero").fill("/seed/season-opener.png");
    await page
      .getByTestId("draft-hero-alt")
      .fill("Players taking the field on opening day");

    // Save the draft (createDraft Server Action → RLS-enforced insert as the
    // contributor → redirect to the editor).
    await page.getByTestId("draft-save").click();

    // THEN: we land on the `[id]` editor with a fresh `draft` / `human` row.
    await expect(page).toHaveURL(/\/admin\/articles\/[^/]+$/);
    await expect(page.getByTestId("draft-editor")).toBeVisible();
    // Auto-retrying expect — never a bare count() (the recorded false-defect gotcha).
    await expect(page.getByTestId("draft-status-badge")).toHaveText(/draft/i);
    await expect(page.getByTestId("draft-source")).toContainText(/human/i);

    // Submit for review (submitForReview Server Action → RLS-enforced
    // draft→in_review transition; revalidation ships the fresh status).
    await page.getByTestId("submit-for-review").click();
    await expect(page.getByTestId("draft-status-badge")).toHaveText(
      /in.?review/i,
    );

    // ...and the draft surfaces in the editorial queue with an in_review status.
    await page.goto("/admin/queue");
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const row = page
      .getByTestId("queue-item")
      .filter({ hasText: markerTitle });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("queue-item-title")).toContainText(markerTitle);
    await expect(row.getByTestId("queue-item-status")).toContainText(
      /in.?review/i,
    );

    // ...and it is ABSENT from the public feed. A FRESH anon context (no
    // storageState / no contributor cookie) proves RLS — not the UI — hides the
    // non-published row. toHaveCount(0) is the auto-retrying absence assertion.
    const anon = await browser.newContext({ baseURL: BASE_URL });
    try {
      const anonPage = await anon.newPage();
      const res = await anonPage.goto("/news");
      expect(res, "no response for /news").not.toBeNull();
      expect(res!.status()).toBe(200);
      await expect(anonPage.getByText(markerTitle)).toHaveCount(0);
    } finally {
      await anon.close();
    }
  });
});
