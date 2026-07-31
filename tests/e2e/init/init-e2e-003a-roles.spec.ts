/*
---
id: init-e2e-003a
name: "init-e2e-003a: Role foundation — the signed-in dashboard renders the caller's profiles.roles"
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
Migration `0003_profiles_and_authorship.sql` is applied and two users are
provisioned out of band (documented preconditions, never a raw insert / minted
cookie): the seed contributor (`npm run seed:contributor` → `profiles.roles`
contains `contributor`) and the slice-04 seed admin whose role is completed to
`editor` (the seed's upsert heals the pre-trigger admin's missing profile row).

## When
Each user signs in for real through the `/admin/login` form and lands on `/admin`.

## Then
The admin dashboard reads the signed-in user's `roles` from `public.profiles`
through the session/RLS client and renders them in a NON-navigating
`admin-roles` indicator: the contributor sees `contributor`, the admin sees
`editor`. The slice-04 `admin-dashboard` + `admin-authenticated` markers still
render (the role indicator is additive, MINOR-4). This is 05a ONLY — the
`/admin/articles/new` and `/admin/queue` routes do NOT exist yet, so the
dashboard ships NO links to them (a dead link is the MAJOR-2 defect this avoids;
the role-gated nav lands in 05b).
*/

import { test, expect } from "@playwright/test";

// Credentials live ONLY in the gitignored `.env.local`, which
// playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE workers
// spawn (identical to init-e2e-008). This spec NEVER mints a session / sets a
// fake cookie — it drives the REAL Supabase sign-in UI. The users' existence +
// their assigned roles are documented preconditions (`npm run seed:contributor`,
// the admin-role completion, and migration `0003`), exactly as the admin user is
// a precondition for init-e2e-008. We do NOT import lib/* or lib/supabase/*
// here: those are `server-only`-fenced and throw under the plain-Node Playwright
// worker (the react-server export-condition trap).
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

function requireCreds(
  email: string | undefined,
  password: string | undefined,
  who: string,
  seedCmd: string,
): { email: string; password: string } {
  if (!email || !password) {
    throw new Error(
      `SEED_${who}_EMAIL / SEED_${who}_PASSWORD must be set (gitignored .env.local). ` +
        `Run \`${seedCmd}\` before this spec — the ${who.toLowerCase()} user + role are documented preconditions.`,
    );
  }
  return { email, password };
}

// Drive the REAL sign-in form (the init-e2e-008 helper shape), then assert the
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

// The editor's dashboard nav target state (updated for slice 06). An editor is
// NOT a contributor, so the `/admin/articles/new` (New article) link stays absent
// — shipping it would be a semi-dead link (createDraft requires `contributor`),
// the MAJOR-2 defect slice 05 avoided. But slice 06 legitimately gives the editor
// the `/admin/queue` (editorial review queue) link, so that link is now PRESENT.
// Absence/presence are asserted with the auto-retrying toHaveCount(n), never a
// bare locator.count().
const EDITOR_ABSENT_HREF = "/admin/articles/new";
const EDITOR_PRESENT_HREF = "/admin/queue";

// ===========================================================================
// The real sign-ins mutate a SHARED Supabase session and the assertions are not
// viewport-specific, so this whole block runs once (desktop project only) —
// mirroring init-e2e-008's positive-direction gating so the two projects don't
// redundantly re-drive the same auth flow against one shared DB (workers:1).
// Each Playwright test gets a fresh browser context, so the two sign-ins never
// leak sessions into each other regardless of ordering.
// ===========================================================================
test.describe("init-e2e-003a — the dashboard renders the caller's roles (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in flow, no viewport dependence — run once against the shared session",
    ),
  );

  test("a signed-in contributor sees their `contributor` role in admin-roles", async ({
    page,
  }) => {
    const { email, password } = requireCreds(
      CONTRIBUTOR_EMAIL,
      CONTRIBUTOR_PASSWORD,
      "CONTRIBUTOR",
      "npm run seed:contributor",
    );

    await signIn(page, email, password);

    // The role indicator reads profiles.roles through the session/RLS client and
    // renders `contributor` — proving the profiles → trigger → has_role → RLS
    // chain works in the browser.
    await expect(page.getByTestId("admin-roles")).toContainText(/contributor/i);
  });

  test("a signed-in admin (now an editor) sees their `editor` role in admin-roles", async ({
    page,
  }) => {
    const { email, password } = requireCreds(
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      "ADMIN",
      "npm run seed:admin",
    );

    await signIn(page, email, password);

    await expect(page.getByTestId("admin-roles")).toContainText(/editor/i);

    // No slice-04 regression: the additive role indicator preserves the existing
    // dashboard markers (MINOR-4). Asserted on this sign-in (satisfies "at least
    // one of the sign-ins").
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByTestId("admin-authenticated")).toContainText(email);
  });

  test("editor nav — /admin/articles/new stays absent, /admin/queue is present (slice 06)", async ({
    page,
  }) => {
    const { email, password } = requireCreds(
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      "ADMIN",
      "npm run seed:admin",
    );

    await signIn(page, email, password);

    // The role indicator renders (so this is a real dashboard, not a redirect).
    await expect(page.getByTestId("admin-roles")).toBeVisible();

    // An editor is NOT a contributor, so the New-article link stays ABSENT — this
    // test still guards against the MAJOR-2 semi-dead-link defect (an editor
    // cannot createDraft), so it is NOT weakened to a no-op.
    await expect(
      page.locator(`a[href="${EDITOR_ABSENT_HREF}"]`),
    ).toHaveCount(0);

    // ...but slice 06 gives the editor the editorial review queue: the
    // /admin/queue link (admin-queue-link) is now PRESENT and visible.
    await expect(
      page.locator(`a[href="${EDITOR_PRESENT_HREF}"]`),
    ).toHaveCount(1);
    await expect(page.getByTestId("admin-queue-link")).toBeVisible();
  });
});
