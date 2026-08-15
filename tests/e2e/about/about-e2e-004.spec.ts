/*
---
id: about-e2e-004
name: "about-e2e-004: Editor updates the mission"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/board/page.tsx
  - app/admin/(protected)/board/actions.ts (updateMissionAction)
  - components/client/mission-edit-form.tsx
  - lib/board.ts (updateMission / getMission)
  - supabase/migrations/0007_about_admin.sql (site_content_editor_update)
---

GIVEN a signed-in editor, WHEN they edit + save the mission text on /admin/board,
THEN it is stored (site_content 'about_mission'.body == edited text) and the PUBLIC
/about render shows the updated text — never stale.

The ASSERTION path (WHEN + THEN) drives the REAL sign-in UI, the REAL updateMission
Server Action (RLS `site_content_editor_update` enforces the editor role), and the
REAL anon /about read (RLS publishable client). The BYPASSRLS admin client is used
ONLY to (a) capture the original mission body in beforeAll and (b) RESTORE it in
afterAll — this hits the SHARED live Supabase that also serves the deployed site, so
the mission MUST return to exactly its seeded copy.
*/

import { test, expect, type Page, type Browser, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { ABOUT_MISSION_SLUG } from "@/lib/board-view";
import { randomUUID } from "node:crypto";

const isDesktop = (t: TestInfo): boolean => t.project.name === "desktop";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// Captured in beforeAll, restored + verified in afterAll.
let originalBody = "";

function requireCreds(): { email: string; password: string } {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local).",
    );
  }
  return { email: EDITOR_EMAIL, password: EDITOR_PASSWORD };
}

async function signInEditor(page: Page): Promise<void> {
  const { email, password } = requireCreds();
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// A truly-anonymous context (no editor cookie) proves the PUBLIC render — the dcon
// "anon /about shows new text". Closed by the caller.
async function readAsAnon(
  browser: Browser,
  assert: (page: Page) => Promise<void>,
): Promise<void> {
  const ctx = await browser.newContext();
  try {
    const anon = await ctx.newPage();
    const res = await anon.goto("/about");
    expect(res, "no response for /about").not.toBeNull();
    expect(res!.status()).toBe(200);
    await assert(anon);
  } finally {
    await ctx.close();
  }
}

test.describe("about-e2e-004 — editor updates the mission (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + write flow against the shared DB — run once",
    ),
  );

  // Capture the seeded mission body so afterAll can restore it exactly.
  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("site_content")
      .select("body")
      .eq("slug", ABOUT_MISSION_SLUG)
      .single();
    if (error) throw error;
    originalBody = data.body as string;
    expect(originalBody.length, "seeded mission body should be non-empty").toBeGreaterThan(0);
  });

  // MANDATORY teardown: restore the seeded body and VERIFY it round-tripped.
  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const admin = createAdminClient();
    const { error } = await admin
      .from("site_content")
      .update({ body: originalBody })
      .eq("slug", ABOUT_MISSION_SLUG);
    if (error) throw error;

    const { data, error: readErr } = await admin
      .from("site_content")
      .select("body")
      .eq("slug", ABOUT_MISSION_SLUG)
      .single();
    if (readErr) throw readErr;
    expect(
      data.body,
      "TEARDOWN: mission body must be restored to the seeded copy",
    ).toBe(originalBody);
  });

  test("editor edits + saves the mission; public /about shows the new text", async ({
    page,
    browser,
  }) => {
    const editedBody = `The USVI Softball Federation mission — e2e-004 edit ${randomUUID()}.`;

    // GIVEN: a signed-in editor reaches the board admin via the editor-only nav link.
    await signInEditor(page);
    await expect(page.getByTestId("admin-board-link")).toBeVisible();
    await page.getByTestId("admin-board-link").click();
    await expect(page).toHaveURL(/\/admin\/board$/);
    await expect(page.getByTestId("board-admin")).toBeVisible();

    // WHEN: they replace the mission prose and save (updateMission via editor RLS).
    await page.getByTestId("mission-body").fill(editedBody);
    await page.getByTestId("mission-save").click();

    // No form error surfaced (RLS accepted the editor write).
    await expect(page.getByTestId("mission-error")).toHaveCount(0);

    // Server-confirmed synchronization (UI + RLS, no admin client): reload the admin
    // page so its Server Component RE-READS the mission from Supabase, then assert the
    // freshly server-rendered textarea holds the edit. (A bare post-submit toHaveValue
    // would only echo the client-retained input — the mission textarea is uncontrolled —
    // and would pass before the Server Action commits. The reload makes this a true
    // persistence gate before we read the public page.)
    await page.reload();
    await expect(page.getByTestId("mission-body")).toHaveValue(editedBody);

    // THEN (assertion path — anon RLS read): public /about renders the NEW text.
    await readAsAnon(browser, async (anon) => {
      await expect(anon.getByTestId("about-mission")).toContainText(editedBody);
    });

    // dcon confirmation (out-of-band read): the stored body IS the edited text.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("site_content")
      .select("body")
      .eq("slug", ABOUT_MISSION_SLUG)
      .single();
    if (error) throw error;
    expect(data.body).toBe(editedBody);
  });
});
