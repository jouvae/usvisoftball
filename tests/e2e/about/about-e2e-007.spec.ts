/*
---
id: about-e2e-007
name: "about-e2e-007: Editor uploads a board-member headshot (positive)"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/board/page.tsx
  - app/admin/(protected)/board/actions.ts (createBoardMemberAction → resolvePhotoFromForm)
  - components/client/board-member-form.tsx (member-photo-file)
  - lib/board-photos.ts (uploadBoardPhoto — magic-byte validation + Storage upload)
  - components/ui/board-member-card.tsx (board-member-photo <img> vs initials fallback)
  - supabase/migrations/0009_board_photos.sql (board-photos bucket + editor-write RLS)
  - next.config.ts (images.remotePatterns *.supabase.co)
---

GIVEN a signed-in editor, WHEN they add a board member to the CURRENT term WITH an
uploaded image file, THEN the file is validated server-side (declared type AND magic
bytes), uploaded to the Storage bucket `board-photos` under the editor session (RLS),
its public URL stored in board_members.photo_url, and the member renders on the PUBLIC
/about roster with a real <img> (next/image) whose decoded src resolves to a
board-photos Storage object — NOT the initials fallback.

ASSERTION path drives the REAL sign-in UI, the REAL createBoardMember Server Action
(RLS + real Storage upload), and REAL anon /about reads. The BYPASSRLS admin client is
setup/teardown ONLY: it resolves the current-term id, and in afterAll deletes the marker
member AND the Storage object it created, then verifies the seed baseline (6 members,
mission, 2 terms) is intact. dcon (out-of-band): photo_url points at the bucket and the
object is fetchable (GET public URL → 200, content-type image/*).
*/

import { test, expect, type Page, type Browser, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { boardPhotoPublicBase, BOARD_PHOTOS_BUCKET } from "@/lib/board-photos";
import { randomUUID } from "node:crypto";

const isDesktop = (t: TestInfo): boolean => t.project.name === "desktop";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// Seeded baseline (0006 + seed:about): current term "2025-2027" has 4 members; the
// archived "2023-2025" term has 2 → 6 total. Teardown restores exactly this.
const CURRENT_TERM_SLUG = "2025-2027";
const SEEDED_CURRENT_COUNT = 4;
const SEEDED_MEMBER_TOTAL = 6;
const SEEDED_TERM_COUNT = 2;

// Fixture-free marker (no SQL-LIKE metachars) so teardown targets ONLY this spec's row.
const MARKER_PREFIX = "e2e-007-marker";
let markerName = "";
let currentTermId = "";

// A REAL 1x1 PNG (valid magic bytes: 89 50 4E 47 …) — the happy-path upload payload.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

// Delete marker members AND the Storage objects their photo_url points at. Returns the
// list of object keys it removed so the caller can verify they are gone.
async function purgeMarkers(): Promise<string[]> {
  const admin = createAdminClient();
  const base = boardPhotoPublicBase();

  const { data: rows, error: selErr } = await admin
    .from("board_members")
    .select("photo_url")
    .like("name", `${MARKER_PREFIX}%`);
  if (selErr) throw selErr;

  const keys = (rows ?? [])
    .map((r) => r.photo_url as string | null)
    .filter((u): u is string => !!u && u.startsWith(base))
    .map((u) => u.slice(base.length))
    .filter(Boolean);

  const { error: delErr } = await admin
    .from("board_members")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (delErr) throw delErr;

  if (keys.length > 0) {
    const { error: rmErr } = await admin.storage
      .from(BOARD_PHOTOS_BUCKET)
      .remove(keys);
    if (rmErr) throw rmErr;
  }
  return keys;
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

test.describe("about-e2e-007 — editor uploads a headshot (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "real sign-in + Storage upload against the shared DB/bucket — run once",
    ),
  );

  // HEAL any leftover marker (member + its object), then resolve the current term id.
  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await purgeMarkers();
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

  // MANDATORY teardown: remove the marker member + its Storage object, then verify the
  // object is gone AND the seed baseline (6 members, mission, 2 terms) is intact.
  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const removedKeys = await purgeMarkers();
    const admin = createAdminClient();

    // No marker member remains.
    const { count: markerLeft, error: mErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker members may remain").toBe(0);

    // Each object this run uploaded is gone from the bucket. We assert against the
    // authoritative Storage list API — NOT a public GET, whose CDN edge can serve a
    // stale 200 for a just-deleted object.
    const { data: listing, error: lErr } = await admin.storage
      .from(BOARD_PHOTOS_BUCKET)
      .list("", { limit: 1000 });
    if (lErr) throw lErr;
    const presentKeys = new Set((listing ?? []).map((o) => o.name));
    for (const key of removedKeys) {
      expect(
        presentKeys.has(key),
        `TEARDOWN: Storage object ${key} must be deleted`,
      ).toBe(false);
    }

    // Seed baseline intact: 6 members total, current roster back to 4, 2 terms, mission.
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

  test("editor uploads a headshot; the member renders on /about with a Storage-backed <img>", async ({
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

    // WHEN: they fill the add-member form and UPLOAD a real PNG headshot.
    const addForm = page.getByTestId("member-add-form");
    await addForm.getByTestId("member-name").fill(markerName);
    await addForm.getByTestId("member-seat").selectOption("st_croix");
    await addForm.getByTestId("member-role").fill("Communications Officer");
    await addForm.getByTestId("member-photo-file").setInputFiles({
      name: "head.png",
      mimeType: "image/png",
      buffer: PNG_1x1,
    });
    await addForm.getByTestId("member-bio").fill("Added by about-e2e-007.");
    await addForm.getByTestId("member-sort").fill("99");
    await page.getByTestId("member-add").click();

    // No form error (validation + Storage upload + RLS insert all succeeded).
    await expect(page.getByTestId("member-add-error")).toHaveCount(0);

    // THEN: the roster grows to 5 and the new member is present.
    await expect(page.getByTestId("board-roster-item")).toHaveCount(
      SEEDED_CURRENT_COUNT + 1,
    );

    // THEN (assertion path — anon RLS read): the member appears on the PUBLIC current
    // roster rendered with a real <img> (NOT the initials fallback), and the <img> src
    // (next/image rewrites to /_next/image?url=<encoded>) decodes to a board-photos URL.
    await gotoAsAnon(browser, "/about", async (anon) => {
      const card = anon
        .getByTestId("about-board-roster")
        .getByTestId("board-member-card")
        .filter({ hasText: markerName });
      await expect(card).toHaveCount(1);

      const photo = card.getByTestId("board-member-photo");
      const img = photo.locator("img");
      // Presence of an <img> (vs the initials <span>) proves it is NOT the fallback.
      await expect(img).toHaveCount(1);
      await expect(img).toBeVisible();

      const src = await img.getAttribute("src");
      expect(src, "board-member-photo <img> must have a src").toBeTruthy();
      const query = src!.includes("?") ? src!.split("?")[1] : "";
      const urlParam = new URLSearchParams(query).get("url");
      const decoded = decodeURIComponent(urlParam ?? src!);
      expect(
        decoded,
        "decoded next/image url must resolve to the board-photos bucket",
      ).toContain("/storage/v1/object/public/board-photos/");
    });

    // dcon (out-of-band): photo_url is stored, points at the bucket, and the object is
    // publicly fetchable as a real image.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("board_members")
      .select("term_id, name, photo_url")
      .eq("name", markerName)
      .single();
    if (error) throw error;
    expect(data.term_id).toBe(currentTermId);
    expect(data.photo_url, "photo_url must be set").toBeTruthy();
    expect(
      data.photo_url as string,
      "photo_url must point at the board-photos bucket",
    ).toContain("/storage/v1/object/public/board-photos/");

    const res = await fetch(data.photo_url as string);
    expect(res.status, "the Storage object must be publicly fetchable").toBe(200);
    expect(
      res.headers.get("content-type") ?? "",
      "the stored object must be served as an image",
    ).toMatch(/^image\//);
  });
});
