/*
---
id: init-e2e-008
name: "init-e2e-008: Admin auth gate — anon is redirected, a real admin signs in"
feature: softball/init
stack: web
priority: P0
status: red
group: A
references:
  - docs/features/softball/init/slice-04-admin-auth.md
  - docs/features/softball/init/scenarios.md
  - DESIGN.md
---

## Given
An unauthenticated visitor, and a seed admin user provisioned out of band by
`npm run seed:admin` (the documented precondition — `lib/admin-user.ts`
`provisionAdminUser`, never a raw insert / minted cookie).

## When
The visitor navigates to any `/admin` route; then a real admin signs in through
the `/admin/login` form with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Then
Every `/admin` route redirects an anon to `/admin/login` (307, `Location:
/admin/login`) with no admin-data marker present — GATE proven; and a real
signed-in admin reaches `/admin`, sees the dashboard + their email, and the
session persists — proving the gate is non-tautological (a gate that redirected
everyone would fail the positive direction). A wrong password stays on the login
page with an error.
*/

import { test, expect } from "@playwright/test";

// Credentials live ONLY in the gitignored `.env.local`, which
// playwright.config.ts `loadEnvLocal()` copies into process.env BEFORE workers
// spawn (identical to how init-web-001 obtains SUPABASE_KEY). The spec never
// mints a session / sets a fake cookie — it drives the REAL Supabase sign-in
// UI. The admin's existence is a documented precondition (`npm run seed:admin`),
// exactly like the article seed is a precondition for the feed specs. We do NOT
// import lib/admin-user.ts or lib/supabase/* here: those are `server-only`-fenced
// and throw under the plain-Node Playwright worker (the react-server
// export-condition trap; see tests/support/server-only-stub.ts).
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

function requireCreds(): { email: string; password: string } {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local). " +
        "Run `npm run seed:admin` before this spec — the admin user is a documented precondition.",
    );
  }
  return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
}

// Two admin surfaces: the base route and a NESTED path, to prove the proxy
// matcher covers `/admin/:path*`, not just `/admin` exactly.
const ADMIN_PATHS = ["/admin", "/admin/queue"] as const;

// ===========================================================================
// Negative direction (the scenario's sole scope) — an anon cannot reach any
// /admin route and NO admin data is returned. These are content/redirect
// assertions with no viewport dependence, so they run under BOTH projects.
// Each Playwright test gets a fresh browser context (no storageState is
// configured), so `page` here is always anonymous — no session can leak in from
// the positive test regardless of ordering.
// ===========================================================================
test.describe("init-e2e-008 — anon is gated out of /admin (all viewports)", () => {
  // Raw, no-follow probe out of band via the request fixture: proves the 307 +
  // Location BEFORE any redirect is followed. Repeated for a nested path so
  // `/admin/:path*` coverage is asserted, not assumed. `headers()` keys are
  // lowercased by Playwright, hence `location`.
  for (const path of ADMIN_PATHS) {
    test(`GET ${path} (no redirect) responds 307 → /admin/login`, async ({
      request,
    }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers()["location"]).toContain("/admin/login");
    });
  }

  test("browser navigation to /admin lands on /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("no admin-data markers are present for an anon request", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);

    // Auto-retrying toHaveCount(0) — NEVER a bare locator.count() (the recorded
    // false-defect gotcha). The gate runs before the protected page executes, so
    // neither marker is ever serialized to an unauthenticated response.
    await expect(page.getByTestId("admin-dashboard")).toHaveCount(0);
    await expect(page.getByTestId("admin-authenticated")).toHaveCount(0);
  });
});

// ===========================================================================
// Positive direction (anti-tautology) — a REAL admin signs in and reaches
// /admin. Nothing here is viewport-specific, and the real sign-in mutates a
// shared Supabase session; running it once (desktop project) is sufficient and
// avoids the two projects redundantly re-driving the same auth flow. Gated via a
// beforeEach test.skip — the working pattern from init-web-001 (Playwright types
// the describe-level skip callback with fixtures only, never testInfo, so gating
// there would read `.project` off undefined and throw).
// ===========================================================================
test.describe("init-e2e-008 — real admin sign-in reaches /admin (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "one real authenticated sign-in flow; no viewport dependence",
    ),
  );

  test("valid credentials sign in, land on the dashboard, and the session persists", async ({
    page,
  }) => {
    const { email, password } = requireCreds();

    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(email);
    await page.getByTestId("admin-login-password").fill(password);
    await page.getByTestId("admin-login-submit").click();

    // The Server-Action redirect landed on the dashboard — Layer B getUser()
    // passed with the freshly-set cookie. A gate that redirected everyone fails
    // HERE, so the negative direction above is proven non-tautological.
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByTestId("admin-authenticated")).toContainText(email);

    // Persistence: revisit /admin in the SAME context — the cookie session
    // survives and the guard re-validates via getUser(); still on the dashboard.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  });

  test("a wrong password shows an error and stays on /admin/login", async ({
    page,
  }) => {
    const { email } = requireCreds();

    await page.goto("/admin/login");
    await page.getByTestId("admin-login-email").fill(email);
    await page
      .getByTestId("admin-login-password")
      .fill("definitely-not-the-real-admin-password");
    await page.getByTestId("admin-login-submit").click();

    // A real, failed sign-in attempt (never a forged session): the generic error
    // renders and the URL never advances to /admin — proving the positive path
    // isn't passing by accident.
    await expect(page.getByTestId("admin-login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
