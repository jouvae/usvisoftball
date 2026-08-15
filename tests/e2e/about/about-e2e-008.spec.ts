/*
---
id: about-e2e-008
name: "about-e2e-008: Bad-file rejection + contributor cannot upload (negative/security)"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/board/actions.ts (createBoardMemberAction → BoardPhotoUploadError → member-add-error)
  - lib/board-photos.ts (declared-type AND magic-byte validation; SVG/spoof rejected BEFORE upload)
  - app/admin/(protected)/board/page.tsx (requireRole('editor') → redirect a contributor)
  - lib/roles.ts (requireRole)
  - supabase/migrations/0009_board_photos.sql (editor-only Storage write RLS)
---

Two security guarantees:
(a) BAD FILES are rejected. The Server Action validates BOTH the declared content-type
    AND the magic bytes. A non-image (text/plain) and a magic-byte-SPOOFED file
    (content-type image/png but SVG/text bytes) each surface a member-add-error, create
    NO board_members row, and — because validation runs BEFORE the Storage upload — leave
    NO new object in the board-photos bucket.
(b) A CONTRIBUTOR cannot reach the upload surface. /admin/board is editor-gated
    (requireRole('editor')), so a signed-in contributor is redirected to /admin and never
    sees the add-member form. (A direct Storage POST with the contributor JWT is separately
    denied by the 0009 editor-write RLS — proven 400 out-of-band; here we assert the
    app-level redirect, the boundary a user actually hits.)

The BYPASSRLS admin client is setup/teardown + dcon ONLY. Bucket object counts are
snapshotted around the bad-file submits to prove nothing landed. Teardown removes any
marker leftover and verifies the seed baseline (6 members, mission, 2 terms) is intact.
*/

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOARD_PHOTOS_BUCKET } from "@/lib/board-photos";
import { randomUUID } from "node:crypto";

const isDesktop = (t: TestInfo): boolean => t.project.name === "desktop";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;

const CURRENT_TERM_SLUG = "2025-2027";
const SEEDED_CURRENT_COUNT = 4;
const SEEDED_MEMBER_TOTAL = 6;
const SEEDED_TERM_COUNT = 2;

const MARKER_PREFIX = "e2e-008-marker";
let markerName = "";
let currentTermId = "";

async function signIn(
  page: Page,
  email: string | undefined,
  password: string | undefined,
  who: string,
): Promise<void> {
  if (!email || !password) {
    throw new Error(`${who} credentials must be set (gitignored .env.local).`);
  }
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Total object count in the board-photos bucket (root listing). Used to prove a rejected
// upload leaves the bucket unchanged. Object keys are random UUIDs at the root.
async function bucketObjectCount(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BOARD_PHOTOS_BUCKET)
    .list("", { limit: 1000 });
  if (error) throw error;
  return (data ?? []).filter((o) => o.id !== null).length;
}

async function deleteMarkerMembers(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("board_members")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

test.describe("about-e2e-008 — bad-file rejection + contributor gate (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "real sign-in + security assertions against the shared DB/bucket — run once",
    ),
  );

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

  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerMembers();
    const admin = createAdminClient();

    const { count: markerLeft, error: mErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker members may remain").toBe(0);

    const { count: total, error: tErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true });
    if (tErr) throw tErr;
    expect(total, "TEARDOWN: total board members back to seeded 6").toBe(
      SEEDED_MEMBER_TOTAL,
    );

    const { count: currentCount, error: cErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("term_id", currentTermId);
    if (cErr) throw cErr;
    expect(currentCount, "TEARDOWN: current roster back to seeded 4").toBe(
      SEEDED_CURRENT_COUNT,
    );

    const { count: termCount, error: tcErr } = await admin
      .from("board_terms")
      .select("*", { count: "exact", head: true });
    if (tcErr) throw tcErr;
    expect(termCount, "TEARDOWN: both seeded terms intact").toBe(SEEDED_TERM_COUNT);

    const { data: mission, error: msErr } = await admin
      .from("site_content")
      .select("body")
      .eq("slug", "about_mission")
      .limit(1);
    if (msErr) throw msErr;
    expect(mission?.length, "TEARDOWN: mission row intact").toBe(1);
  });

  test("(a) a non-image and a magic-byte-spoofed file are each rejected; no member, no object", async ({
    page,
  }) => {
    // GIVEN: a signed-in editor on the board admin screen, and a bucket snapshot.
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.getByTestId("admin-board-link").click();
    await expect(page).toHaveURL(/\/admin\/board$/);
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT,
    );
    const objectsBefore = await bucketObjectCount();

    const addForm = page.getByTestId("member-add-form");
    const fillCommon = async () => {
      await addForm.getByTestId("member-name").fill(markerName);
      await addForm.getByTestId("member-seat").selectOption("st_croix");
      await addForm.getByTestId("member-role").fill("Rejected Upload");
    };

    // WHEN 1: submit a NON-IMAGE (text/plain) as the headshot.
    await fillCommon();
    await addForm.getByTestId("member-photo-file").setInputFiles({
      name: "x.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await page.getByTestId("member-add").click();

    // THEN: a form error, and the roster did NOT grow.
    await expect(page.getByTestId("member-add-error")).toBeVisible();
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT,
    );

    // WHEN 2: submit a MAGIC-BYTE-SPOOFED file — content-type image/png but SVG/text
    // bytes. This proves the magic-byte sniff (not just the content-type header) rejects.
    await fillCommon();
    await addForm.getByTestId("member-photo-file").setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/> not really a png"),
    });
    await page.getByTestId("member-add").click();

    // THEN: a form error again, roster still unchanged.
    await expect(page.getByTestId("member-add-error")).toBeVisible();
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT,
    );

    // dcon (out-of-band): NO marker member was created, and the bucket gained NO object
    // (validation runs BEFORE upload, so neither reject touched Storage).
    const admin = createAdminClient();
    const { count: markerCount, error } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (error) throw error;
    expect(markerCount, "no member row may be created by a rejected upload").toBe(0);

    const objectsAfter = await bucketObjectCount();
    expect(
      objectsAfter,
      "a rejected upload must leave NO new object in board-photos",
    ).toBe(objectsBefore);
  });

  test("(b) a contributor is redirected away from /admin/board and never sees the upload form", async ({
    page,
  }) => {
    // GIVEN: a signed-in CONTRIBUTOR (valid account, but lacks the editor role).
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");

    // WHEN: they navigate directly to the editor-gated board admin.
    await page.goto("/admin/board");

    // THEN: requireRole('editor') redirects them to /admin — they never reach the board
    // editor, so the add-member form (the upload surface) is absent.
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("member-add-form")).toHaveCount(0);
    await expect(page.getByTestId("member-photo-file")).toHaveCount(0);
  });
});
