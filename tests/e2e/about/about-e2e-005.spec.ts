/*
---
id: about-e2e-005
name: "about-e2e-005: Editor adds a board member to the current term"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/board/page.tsx
  - app/admin/(protected)/board/actions.ts (createBoardMemberAction)
  - components/client/board-member-form.tsx
  - lib/board.ts (createBoardMember)
  - supabase/migrations/0007_about_admin.sql (board_members_editor_insert, current-term-only)
---

GIVEN a signed-in editor, WHEN they add a member (name, seat, role, photo, bio) to the
CURRENT term via /admin/board, THEN it is stored for THAT term (term_id = current,
seat set, name set) and appears on the PUBLIC /about current roster but NOT on the
archive (/about/2023-2025).

ASSERTION path (WHEN + THEN) drives the REAL sign-in UI, the REAL createBoardMember
Server Action (RLS `board_members_editor_insert` enforces editor + current-term-only),
and REAL anon /about reads. The BYPASSRLS admin client is used ONLY to look up the
current term id (setup) and to DELETE the marker member in afterAll (teardown) — this
hits the SHARED live Supabase, so the current roster MUST return to its 4 seeded rows.
*/

import { test, expect, type Page, type Browser, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const isDesktop = (t: TestInfo): boolean => t.project.name === "desktop";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// Seeded baseline (0006 + seed:about).
const CURRENT_TERM_SLUG = "2025-2027";
const ARCHIVE_TERM_SLUG = "2023-2025";
const SEEDED_CURRENT_COUNT = 4;

// Fixture-free marker (no SQL-LIKE metachars) so teardown can target ONLY this spec's
// row (and any leftover from a prior aborted run) without touching seeded members.
const MARKER_PREFIX = "e2e-005-marker";
let markerName = "";
let currentTermId = "";

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

async function deleteMarkerMembers(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("board_members")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

async function gotoAsAnon(
  browser: Browser,
  path: string,
  assert: (page: Page) => Promise<void>,
): Promise<void> {
  const ctx = await browser.newContext();
  try {
    const anon = await ctx.newPage();
    const res = await anon.goto(path);
    expect(res, `no response for ${path}`).not.toBeNull();
    expect(res!.status()).toBe(200);
    await assert(anon);
  } finally {
    await ctx.close();
  }
}

test.describe("about-e2e-005 — editor adds a current-term member (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real sign-in + write flow against the shared DB — run once",
    ),
  );

  // HEAL any leftover marker, then resolve the current term id for the dcon read.
  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerMembers();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("board_terms")
      .select("id, is_current")
      .eq("slug", CURRENT_TERM_SLUG)
      .single();
    if (error) throw error;
    expect(data.is_current, "seeded 2025-2027 term must be current").toBe(true);
    currentTermId = data.id as string;
    markerName = `${MARKER_PREFIX} ${randomUUID()}`;
  });

  // MANDATORY teardown: remove the marker member and VERIFY the roster is back to 4.
  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerMembers();
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("term_id", currentTermId);
    if (error) throw error;
    expect(
      count,
      "TEARDOWN: current roster must return to its 4 seeded members",
    ).toBe(SEEDED_CURRENT_COUNT);
  });

  test("editor adds a member; it appears on /about current roster, not the archive", async ({
    page,
    browser,
  }) => {
    // GIVEN: a signed-in editor on the board admin screen.
    await signInEditor(page);
    await page.getByTestId("admin-board-link").click();
    await expect(page).toHaveURL(/\/admin\/board$/);
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT,
    );

    // WHEN: they fill the add-member form (current term) and submit.
    const addForm = page.getByTestId("member-add-form");
    await addForm.getByTestId("member-name").fill(markerName);
    await addForm.getByTestId("member-seat").selectOption("st_croix");
    await addForm.getByTestId("member-role").fill("Sergeant-at-Arms");
    await addForm.getByTestId("member-photo").fill("/seed/team-profiles.png");
    await addForm.getByTestId("member-bio").fill("Added by about-e2e-005.");
    await addForm.getByTestId("member-sort").fill("99");
    await page.getByTestId("member-add").click();

    // No form error (RLS accepted the editor insert into the current term).
    await expect(page.getByTestId("member-add-error")).toHaveCount(0);

    // THEN: the roster grows to 5 and the new member is present (auto-retrying).
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT + 1,
    );
    await expect(
      page.getByTestId("board-roster-item").filter({ hasText: markerName }),
    ).toHaveCount(1);

    // THEN (assertion path — anon RLS read): visible on the PUBLIC current roster...
    await gotoAsAnon(browser, "/about", async (anon) => {
      await expect(
        anon
          .getByTestId("about-board-roster")
          .getByTestId("board-member-card")
          .filter({ hasText: markerName }),
      ).toHaveCount(1);
    });

    // ...and NOT on the archived term's roster (it belongs only to the current term).
    await gotoAsAnon(browser, `/about/${ARCHIVE_TERM_SLUG}`, async (anon) => {
      await expect(anon.getByTestId("about-term-roster")).toBeVisible();
      await expect(
        anon
          .getByTestId("about-term-roster")
          .getByTestId("board-member-card")
          .filter({ hasText: markerName }),
      ).toHaveCount(0);
    });

    // dcon confirmation (out-of-band read): stored for the CURRENT term, seat + name set.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("board_members")
      .select("term_id, name, seat")
      .eq("name", markerName)
      .single();
    if (error) throw error;
    expect(data.term_id).toBe(currentTermId);
    expect(data.seat).toBe("st_croix");
    expect(data.name).toBe(markerName);
  });
});
