/*
---
id: init-e2e-007
name: "init-e2e-007: AI draft is generated for review and never auto-published (slice 09)"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-09-ai-draft.md
  - docs/features/softball/init/slice-05-contributor-draft.md
  - DESIGN.md
---

## Given
Migration `0005_ai_provenance.sql` is applied out of band (the `ai_provenance`
jsonb column, the `articles_ai_requires_provenance` table CHECK, and the SEPARATE
permissive `articles_ai_draft_insert` policy — slice-09 §2) and the seed
`contributor` (`SEED_CONTRIBUTOR_*`) is provisioned (`npm run seed:contributor`).
This spec never mints a session / raw-inserts a row on the ASSERTION path: it
drives the REAL Supabase sign-in UI and the REAL generate/accept Server Actions,
so RLS genuinely enforces as the contributor (slice-09 §7). Generation is the
DETERMINISTIC in-app stub drafter (`model='stub'`) — no live model, no key, no
network (slice-09 §0.1, §3).

## When
The signed-in contributor opens the AI draft panel (`/admin/news/ai`), selects an
owned/licensed source, types a UNIQUE-marker prompt, GENERATES a draft, reviews
the generated title/body/provenance, and ACCEPTS it (acceptAiDraft → RLS-enforced
insert as the contributor → redirect to the `[id]` editor).

## Then
An article is created with `source=ai`, `status=draft` (NEVER `published`), and
stored `ai_provenance` (source + model) visible on the draft editor. It enters the
normal review workflow — present in the editorial queue as a `draft` — and is
ABSENT from the public `/news` feed to an anonymous visitor: the feed never shows
its headline and its `/news/[slug]` returns HTTP 404 (RLS keeps non-published
invisible). This is the safety property — AI content is never auto-published
(slice-09 §2.4, §7).
*/

import { test, expect } from "@playwright/test";

// TEARDOWN ONLY (never the assertion path): the BYPASSRLS admin client removes
// the `[e2e-007]`-marked article(s) THIS (and any prior aborted) run created so
// the suite is re-runnable and the queue does not accumulate drafts. Targeted by
// a CONTAINS-match on the marker — NOT deleteAllArticles(), which would nuke the
// seeded published rows the feed specs depend on. The created row is a `draft`,
// so /news stays at EXACTLY 2 published automatically; teardown only prevents
// draft accumulation. `lib/supabase/admin.ts` is `server-only`-fenced; the
// Playwright transform aliases `server-only` to a no-op via tests/tsconfig.json
// (see playwright.config.ts), so this import resolves under the plain-Node worker
// (identical to how init-e2e-003 / init-e2e-004 pull the admin client).
import { createAdminClient } from "@/lib/supabase/admin";
// A per-run unique marker keeps the spec deterministic + re-runnable: the prompt
// (which the stub splices VERBATIM into the generated title, slice-09 §3 MINOR-1)
// can never collide with a fixture or a prior run, and the absent-from-feed check
// cannot pass by matching a pre-existing row.
import { randomUUID } from "node:crypto";
// The app's OWN slug derivation (unfenced, pure — lib/format.ts). acceptAiDraft
// persists with `slug = slugify(draft.title)` (slice-09 §5.4 step 4), so slugging
// the reviewed title reproduces the exact public path to probe for the 404 —
// without hardcoding the stub's title template.
import { slugify } from "@/lib/format";

// Credentials live ONLY in the gitignored `.env.local`, which
// playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE workers
// spawn (identical to init-e2e-003 / init-e2e-004). We do NOT import lib/* into
// the ASSERTION path — only the teardown helper below touches the admin client.
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;

// Manually-created browser contexts (the fresh anon feed / 404 check) do NOT
// inherit the project's `use.baseURL`, so we resolve it the same way the config
// does.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

// Stable, fixture-free marker STEM. The per-run marker is `${MARKER_STEM} <uuid>`;
// the stub splices it mid-TITLE (slice-09 §3), so every consumer — the queue
// filter, the feed-absence check, and teardown — uses a CONTAINS match, never a
// prefix match. No seed fixture uses this stem, so the contains-scoped delete only
// ever removes this spec's drafts (and any leftover from a prior aborted run).
const MARKER_STEM = "[e2e-007]";

function requireCreds(): { email: string; password: string } {
  if (!CONTRIBUTOR_EMAIL || !CONTRIBUTOR_PASSWORD) {
    throw new Error(
      "SEED_CONTRIBUTOR_EMAIL / SEED_CONTRIBUTOR_PASSWORD must be set (gitignored .env.local). " +
        "Run `npm run seed:contributor` before this spec — the contributor user + role are documented preconditions.",
    );
  }
  return { email: CONTRIBUTOR_EMAIL, password: CONTRIBUTOR_PASSWORD };
}

// Drive the REAL sign-in form (the init-e2e-003 / init-e2e-004 helper shape), then
// assert the Server-Action redirect landed on the dashboard. The contributor is
// live, so this SUCCEEDS — the RED failure must land later, at the first missing
// slice-09 element (the AI-draft nav link / panel).
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

// Targeted teardown: remove every article whose title CONTAINS the marker stem.
// `%` is the SQL LIKE wildcard; `[`/`]` are LITERAL in Postgres LIKE (only `%`/`_`
// are wildcards), so `%[e2e-007]%` is a literal contains-match on the mid-title
// marker. Runs even on the skipped mobile project (deletes nothing there) —
// harmless + idempotent. NEVER deleteAllArticles().
async function deleteMarkedArticles(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("articles")
    .delete()
    .like("title", `%${MARKER_STEM}%`);
  if (error) throw error;
}

// ===========================================================================
// The scenario is inherently sequential + stateful (the generated title, the
// created article id, and the derived slug all flow through the assertions), so
// it compiles to ONE test. The real sign-in mutates a shared Supabase session and
// none of the assertions are viewport-specific, so it runs ONCE (desktop project)
// — mirroring init-e2e-003 / init-e2e-004's positive-direction gating so the two
// projects don't redundantly re-drive the same auth + write flow against one
// shared DB (workers:1, fullyParallel:false). Playwright types the describe-level
// test.skip callback with fixtures only (never testInfo), so gate via beforeEach.
// ===========================================================================
test.describe("init-e2e-007 — AI draft generated for review, never auto-published (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + write flow, no viewport dependence — run once against the shared DB",
    ),
  );

  // Fail-closed cleanup: first HEAL any leftover from a prior aborted run, then
  // remove this run's draft afterwards so the queue/DB return to the seeded
  // baseline (2 published) and the next run starts clean. Teardown MAY use the
  // admin client (it is NOT the assertion path).
  test.beforeAll(async () => {
    await deleteMarkedArticles();
  });
  test.afterAll(async () => {
    await deleteMarkedArticles();
  });

  test("generates an AI draft, accepts it as a draft with stored provenance, and it never reaches the public feed", async ({
    page,
    browser,
  }) => {
    const { email, password } = requireCreds();

    // A UNIQUE marker per run — the anti-tautology + re-runnability anchor. It
    // goes into the PROMPT; the deterministic stub splices it verbatim into the
    // generated TITLE (slice-09 §3), which is what makes the queued row + the
    // draft findable/cleanable by a contains-match.
    const marker = `${MARKER_STEM} ${randomUUID()}`;

    // GIVEN: a signed-in contributor on the dashboard.
    await signIn(page, email, password);

    // WHEN: they open the AI draft panel via the role-gated nav link. (slice-09:
    // this link does not exist yet, so an unbuilt run fails HERE — the first
    // missing slice-09 element, exactly the intended RED.)
    await page.getByTestId("admin-ai-draft-link").click();
    await expect(page).toHaveURL(/\/admin\/news\/ai$/);
    await expect(page.getByTestId("ai-draft-panel")).toBeVisible();

    // Select an owned/licensed source. We do NOT hardcode the placeholder
    // allow-list (Federation still owes the real list, slice-09 §0.2) — we read
    // the FIRST selectable option straight off the <select> and remember its
    // human-readable label, which the review-area + editor provenance displays
    // must echo (slice-09 §5.5: "Source: X · Model: stub").
    const sourceSelect = page.getByTestId("ai-source-select");
    const options = await sourceSelect
      .locator("option")
      .evaluateAll((els) =>
        (els as HTMLOptionElement[])
          .filter((o) => o.value.trim().length > 0)
          .map((o) => ({ value: o.value, label: (o.textContent ?? "").trim() })),
      );
    expect(
      options.length,
      "ai-source-select exposes at least one selectable source option",
    ).toBeGreaterThan(0);
    const source = options[0];
    await sourceSelect.selectOption(source.value);

    // Type the unique-marker prompt and GENERATE (generateAiDraft — review only,
    // NOTHING persisted, slice-09 §5.3).
    await page.getByTestId("ai-prompt").fill(marker);
    await page.getByTestId("ai-generate").click();

    // The review area renders the generated draft. Auto-retrying expect — never a
    // bare count() (the recorded false-defect gotcha, slice-02/03).
    const review = page.getByTestId("ai-generated-draft");
    await expect(review).toBeVisible();

    // The generated title CONTAINS the marker (spliced mid-title, slice-09 §3
    // MINOR-1 — contains-match, never prefix/exact). Capture the full reviewed
    // title so we can derive the exact public slug for the 404 probe below.
    const generatedTitleEl = page.getByTestId("ai-generated-title");
    await expect(generatedTitleEl).toContainText(marker);
    await expect(page.getByTestId("ai-generated-body")).toBeVisible();
    const generatedTitle = (await generatedTitleEl.textContent())?.trim() ?? "";
    expect(
      generatedTitle,
      "captured a non-empty generated title from ai-generated-title",
    ).toContain(marker);

    // Provenance shows the model (`stub`) AND the selected source (slice-09 §5.5).
    const provenance = page.getByTestId("ai-provenance");
    await expect(provenance).toBeVisible();
    await expect(provenance).toContainText(/stub/i);
    await expect(provenance).toContainText(source.label);

    // ACCEPT (acceptAiDraft → re-derives server-side, RLS-enforced insert as the
    // contributor → 303 redirect to the `[id]` editor, slice-09 §5.4).
    await page.getByTestId("ai-accept").click();

    // THEN: we land on the draft editor for the new AI row.
    await expect(page).toHaveURL(/\/admin\/articles\/[^/]+$/);
    await expect(page.getByTestId("draft-editor")).toBeVisible();

    // ...stored as a DRAFT (never published) with source=ai and visible
    // provenance (source + model). draft-status-badge is EXACTLY `draft`.
    await expect(page.getByTestId("draft-status-badge")).toHaveText(/^draft$/i);
    await expect(page.getByTestId("draft-source")).toContainText(/ai/i);
    const draftProvenance = page.getByTestId("draft-provenance");
    await expect(draftProvenance).toBeVisible();
    await expect(draftProvenance).toContainText(/stub/i);
    await expect(draftProvenance).toContainText(source.label);

    // ...and it enters the normal review workflow — present in the editorial queue
    // as a DRAFT. Filter the queue by the mid-title marker (hasText is already a
    // substring match); its status reads EXACTLY `draft`.
    await page.goto("/admin/queue");
    await expect(page.getByTestId("queue-list")).toBeVisible();
    const row = page.getByTestId("queue-item").filter({ hasText: marker });
    await expect(row).toHaveCount(1);
    await expect(row.getByTestId("queue-item-title")).toContainText(marker);
    await expect(row.getByTestId("queue-item-status")).toHaveText(/^draft$/i);

    // ── The safety property, at the public surface: the AI draft is NEVER on the
    // public feed and its article page 404s. A FRESH anon context (no
    // storageState / no contributor cookie) proves RLS — not the UI — hides the
    // non-published row.
    const anon = await browser.newContext({ baseURL: BASE_URL });
    try {
      const anonPage = await anon.newPage();

      // Absent from /news: the feed never shows the marker headline. toHaveCount(0)
      // is the auto-retrying absence assertion (article-card scoped, plus a
      // whole-page text sweep as a belt-and-braces leak check).
      const feedRes = await anonPage.goto("/news");
      expect(feedRes, "no response for /news").not.toBeNull();
      expect(feedRes!.status()).toBe(200);
      await expect(
        anonPage.getByTestId("article-card").filter({ hasText: marker }),
      ).toHaveCount(0);
      await expect(anonPage.getByText(marker)).toHaveCount(0);

      // Its /news/[slug] returns a REAL HTTP 404 (RLS keeps non-published
      // invisible to anon — the property slices 02/03 proved). The slug is the
      // app's own slugify() of the reviewed title, i.e. the exact path acceptAiDraft
      // persisted (slice-09 §5.4 step 4).
      const slug = slugify(generatedTitle);
      expect(slug, "derived a non-empty slug from the generated title").toBeTruthy();
      const draftRes = await anonPage.goto(`/news/${slug}`);
      expect(draftRes, `no response for /news/${slug}`).not.toBeNull();
      expect(draftRes!.status()).toBe(404);
      await expect(anonPage.getByTestId("article-not-found")).toBeVisible();
      // The AI draft's title never leaks into the 404 body.
      await expect(anonPage.getByText(marker)).toHaveCount(0);
    } finally {
      await anon.close();
    }
  });
});
