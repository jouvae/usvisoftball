/*
---
id: init-e2e-004
name: "init-e2e-004: Contributor cannot publish their own in_review article (slice 07 verification)"
feature: softball/init
stack: web
priority: P0
status: green
group: A
references:
  - docs/features/softball/init/slice-07-contributor-cannot-publish.md
  - docs/features/softball/init/slice-05-contributor-draft.md
  - docs/features/softball/init/slice-06-editor-publish.md
  - DESIGN.md
---

## Given
A signed-in seed `contributor` (`SEED_CONTRIBUTOR_*`) who has authored a genuine
`in_review` article via the REAL create + submit flow (mirrors init-e2e-003 — no
minted session, no raw-inserted row, so RLS enforces as the contributor). The
publish barrier is already complete at three layers as-is (slice-07 §1): RLS
`WITH CHECK` (0003/0004), the `requireRole('editor')` gate on the ONLY publish
route + the `publishArticle` action, and a contributor UI that renders no Publish
control. This spec is a VERIFICATION contract — expected to PASS on the first
run; a FAILURE reveals a real barrier leak, not a missing feature.

## When
The contributor opens their own `in_review` article at `/admin/articles/[id]`,
and then navigates directly to the editor-only publish surface
`/admin/review/[id]`.

## Then
(a) The own-article view exposes NO publish control and NO link to the review
surface, while showing an `in_review` status. (b) The direct `/admin/review/[id]`
navigation is redirected to `/admin` by `requireRole('editor')` and the review
desk never renders. (c) The article's status is unchanged — still `in_review`.
Covers the "via UI" clause; the "via a direct publish request" (contributor-JWT
PATCH → 42501) clause is the documented out-of-band probe (slice-07 §5/§6), not a
Playwright step.
*/

import { test, expect } from "@playwright/test";

// TEARDOWN ONLY (never the assertion path): the BYPASSRLS admin client removes the
// `[e2e-004]`-prefixed article(s) THIS spec created so the suite is re-runnable and
// the queue does not accumulate. Targeted by a marker title prefix — NOT
// deleteAllArticles(), which would nuke the seeded published rows the feed specs
// depend on (keeps /news at EXACTLY 2 published; this slice only ever writes a
// non-published row). `lib/supabase/admin.ts` is `server-only`-fenced; the
// Playwright transform aliases `server-only` to a no-op via tests/tsconfig.json
// (see playwright.config.ts), so this import resolves under the plain-Node worker.
import { createAdminClient } from "@/lib/supabase/admin";
// A per-run unique marker keeps the spec deterministic + re-runnable: the draft
// title can never collide with a fixture or a prior run.
import { randomUUID } from "node:crypto";

// Credentials live ONLY in the gitignored `.env.local`, which
// playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE workers
// spawn (identical to init-e2e-003). We do NOT import lib/* into the ASSERTION
// path — only the teardown helper below touches the admin client.
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;

// Stable, fixture-free title prefix — used to build the per-run marker AND to
// target teardown. No seed fixture uses it, so a prefix-scoped delete only ever
// removes this spec's article (and any leftover from a prior aborted run).
const MARKER_PREFIX = "[e2e-004] contributor cannot publish";

function requireCreds(): { email: string; password: string } {
  if (!CONTRIBUTOR_EMAIL || !CONTRIBUTOR_PASSWORD) {
    throw new Error(
      "SEED_CONTRIBUTOR_EMAIL / SEED_CONTRIBUTOR_PASSWORD must be set (gitignored .env.local). " +
        "Run `npm run seed:contributor` before this spec — the contributor user + role are documented preconditions.",
    );
  }
  return { email: CONTRIBUTOR_EMAIL, password: CONTRIBUTOR_PASSWORD };
}

// Drive the REAL sign-in form (the init-e2e-003 helper shape), then assert the
// Server-Action redirect landed on the dashboard.
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
// prefix. `%` is the SQL LIKE wildcard; the prefix has no `_`/`%`, so the match is
// a literal-prefix match. Runs even on the skipped mobile project (deletes nothing
// there) — harmless + idempotent. NEVER deleteAllArticles().
async function deleteMarkedArticles(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .delete()
    .like("title", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

// ===========================================================================
// The scenario is inherently sequential + stateful (the `in_review` article id
// flows from the create/submit into every assertion), so it compiles to ONE test.
// The real sign-in mutates a shared Supabase session and none of the assertions
// are viewport-specific, so it runs ONCE (desktop project) — mirroring
// init-e2e-003 / init-e2e-005's positive-direction gating so the two projects
// don't redundantly re-drive the same auth + write flow against one shared DB
// (workers:1, fullyParallel:false). Playwright types the describe-level test.skip
// callback with fixtures only (never testInfo), so gate via beforeEach.
// ===========================================================================
test.describe("init-e2e-004 — contributor cannot publish their own in_review article (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + write flow, no viewport dependence — run once against the shared DB",
    ),
  );

  // Fail-closed cleanup: first HEAL any leftover from a prior aborted run, then
  // remove this run's row afterwards so /news stays at EXACTLY 2 published and the
  // next run starts clean. Teardown MAY use the admin client (NOT the assertion path).
  test.beforeAll(async () => {
    await deleteMarkedArticles();
  });
  test.afterAll(async () => {
    await deleteMarkedArticles();
  });

  test("has no publish control on their own in_review view, is redirected from the review surface, and the status is unchanged", async ({
    page,
  }) => {
    const { email, password } = requireCreds();

    // A UNIQUE marker title per run — the anti-tautology + re-runnability anchor.
    const markerTitle = `${MARKER_PREFIX} ${randomUUID()}`;

    // GIVEN: a signed-in contributor on the dashboard.
    await signIn(page, email, password);

    // ...who creates a genuinely contributor-owned draft via the REAL New-article
    // form (createDraft Server Action → RLS-enforced insert as the contributor →
    // redirect to the editor). This yields a real author_id without looking it up.
    await page.getByTestId("admin-new-article-link").click();
    await expect(page).toHaveURL(/\/admin\/articles\/new$/);
    await expect(page.getByTestId("admin-new-article")).toBeVisible();

    await page.getByTestId("draft-title").fill(markerTitle);
    await page
      .getByTestId("draft-body")
      .fill("A contributor-authored draft body created by init-e2e-004.");
    await page.getByTestId("draft-category").fill("Championships");
    await page.getByTestId("draft-hero").fill("/seed/season-opener.png");
    await page
      .getByTestId("draft-hero-alt")
      .fill("Players taking the field on opening day");
    await page.getByTestId("draft-save").click();

    // Land on the `[id]` editor and CAPTURE the id from the URL.
    await expect(page).toHaveURL(/\/admin\/articles\/[^/]+$/);
    await expect(page.getByTestId("draft-editor")).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop()!;
    expect(id, "captured a non-empty article id from the editor URL").toBeTruthy();

    // ...and SUBMIT it for review (submitForReview Server Action → RLS-enforced
    // draft→in_review transition). Now it is a genuinely contributor-owned
    // in_review row with a real author_id.
    await page.getByTestId("submit-for-review").click();
    await expect(page.getByTestId("draft-status-badge")).toHaveText(
      /in.?review/i,
    );

    // ── Assertion (a): NO publish control on the contributor's own in_review view.
    // Re-open the own-article view fresh to assert the rendered contract.
    await page.goto(`/admin/articles/${id}`);
    await expect(page.getByTestId("draft-editor")).toBeVisible();
    await expect(page.getByTestId("draft-status-badge")).toHaveText(
      /in.?review/i,
    );
    // Absence of any publish control (auto-retrying toHaveCount(0) — never a bare
    // count(), the recorded false-defect gotcha).
    await expect(page.getByTestId("publish-article")).toHaveCount(0);
    // No in-app link to the editor-only review surface.
    await expect(page.locator('a[href^="/admin/review/"]')).toHaveCount(0);
    // (Bonus) the in_review own-view exposes NO status-mutating control at all —
    // SubmitForReviewButton is gated to `draft`, so there is no dead no-op here.
    await expect(page.getByTestId("submit-for-review")).toHaveCount(0);

    // ── Assertion (b): the direct publish surface is DENIED. requireRole('editor')
    // redirects the contributor to /admin, and the review desk never renders.
    await page.goto(`/admin/review/${id}`);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("review-view")).toHaveCount(0);

    // ── Assertion (c): status UNCHANGED — still in_review on the own-article view.
    await page.goto(`/admin/articles/${id}`);
    await expect(page.getByTestId("draft-status-badge")).toHaveText(
      /in.?review/i,
    );
  });
});
