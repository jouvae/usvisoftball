/*
---
id: about-e2e-013
name: "about-e2e-013: Committee member CRUD w/ photo; upload lifecycle, reap, authz + RLS"
feature: softball/about
stack: web
priority: P1
group: A
references:
  - app/admin/(protected)/committees/actions.ts (create/update/deleteCommitteeMemberAction)
  - lib/board-photos.ts (uploadBoardPhoto: declared-type + magic-byte validation; reap by URL)
  - lib/committees.ts (createCommitteeMember / getCommitteeMemberPhotoUrl)
  - supabase/migrations/0011_committees.sql (committee_members; FK on delete cascade)
  - supabase/migrations/0012_committees_admin.sql (editor-only member write RLS)
  - supabase/migrations/0009_board_photos_storage.sql (board-photos bucket, editor-only write)
  - components/ui/committees-section.tsx (public /about render: committee-member/-name/-role)
---

The committee-member admin CRUD with a real Storage photo, all through the editor session.

(a) An EDITOR adds a member with an uploaded PNG to a marker committee. The member persists
    (service read) with a board-photos photo_url, the Storage object EXISTS (LIST api, not the
    stale-cached public URL), and it renders on /about. Editing the member's role is reflected
    (service read + /about). Deleting the member removes it AND reaps its Storage object.

(b) A NON-IMAGE / magic-byte-SPOOFED upload is rejected with cm-add-error, creates NO member
    row, and — validation runs BEFORE upload — leaves NO new object in board-photos.

(c) Deleting the PARENT committee reaps its members' photo objects: after an editor adds a
    member with a photo then deletes the committee, the member cascade-deletes and its Storage
    object is GONE (verified via the LIST api, never the CDN-cached public URL).

(d) A CONTRIBUTOR JWT / the ANON key is denied on a direct PostgREST committee_members write.

MANDATORY TEARDOWN (shared prod DB + Storage): all committees/members use a unique marker
name. afterAll (service key) collects every marker member's photo_url, DELETEs marker members
+ marker committees (cascade), then deletes each collected board-photos object and asserts:
committees back to 4 seeded rows, no marker members, and none of the collected objects remain
in the bucket (LIST api). Desktop-gated. The service-key admin client is teardown + out-of-band
verification ONLY — every app write goes through the real editor session.
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
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_KEY;

const MARKER_PREFIX = "e2e-013-marker";
const SEEDED_COMMITTEE_COUNT = 4;
const PHOTO_PUBLIC_BASE = `${(SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${BOARD_PHOTOS_BUCKET}/`;

// A minimal but genuine 1x1 PNG (correct magic bytes) — passes the magic-byte sniff.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function pngUpload() {
  return { name: "h.png", mimeType: "image/png", buffer: PNG_BYTES };
}

// The Storage object key embedded in a board-photos public URL (e.g. "<uuid>.png").
function keyFromPhotoUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(PHOTO_PUBLIC_BASE)) return null;
  const key = url.slice(PHOTO_PUBLIC_BASE.length);
  return key || null;
}

// Existence via the LIST api (authoritative). The public URL serves a stale cached 200 after
// delete, so NEVER probe it — POST object/list and match the returned object's `name`.
async function objectExists(key: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${BOARD_PHOTOS_BUCKET}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY as string,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: "", search: key, limit: 100 }),
    },
  );
  if (!res.ok) throw new Error(`Storage LIST failed: ${res.status}`);
  const arr = (await res.json()) as Array<{ name: string }>;
  return Array.isArray(arr) && arr.some((o) => o.name === key);
}

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

type MemberRow = { id: string; name: string; role: string; photo_url: string; committee_id: string };

async function readMarkerMembers(): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committee_members")
    .select("id,name,role,photo_url,committee_id")
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
  return (data as MemberRow[] | null) ?? [];
}

async function deleteMarkerData(): Promise<string[]> {
  const admin = createAdminClient();
  // Collect marker member photo keys BEFORE deleting the rows, so teardown can reap Storage.
  const members = await readMarkerMembers();
  const keys = members
    .map((m) => keyFromPhotoUrl(m.photo_url))
    .filter((k): k is string => !!k);
  const { error: memErr } = await admin
    .from("committee_members")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (memErr) throw memErr;
  const { error: comErr } = await admin
    .from("committees")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (comErr) throw comErr;
  if (keys.length > 0) {
    await admin.storage.from(BOARD_PHOTOS_BUCKET).remove(keys);
  }
  return keys;
}

// Create a marker committee through the real editor UI, returning its id (service read).
async function createMarkerCommittee(page: Page, name: string): Promise<string> {
  await page.goto("/admin/committees");
  await expect(page.getByTestId("committees-admin")).toBeVisible();
  const addForm = page.getByTestId("committee-add-form");
  await addForm.getByTestId("committee-name").fill(name);
  await addForm.getByTestId("committee-sort").fill("5");
  await page.getByTestId("committee-add").click();
  await expect(
    page.locator('[data-testid="committee-admin-item"]', { hasText: name }),
  ).toBeVisible();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committees")
    .select("id")
    .eq("name", name)
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function contributorAccessToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY as string, "Content-Type": "application/json" },
    body: JSON.stringify({ email: CONTRIBUTOR_EMAIL, password: CONTRIBUTOR_PASSWORD }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error(`contributor sign-in failed: ${res.status}`);
  return body.access_token;
}

async function restMembers(
  method: "POST" | "PATCH",
  bearer: string,
  body: Record<string, unknown>,
  query = "",
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/committee_members${query}`, {
    method,
    headers: {
      apikey: PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  let rows: unknown[] | null = null;
  try {
    const parsed = await res.json();
    rows = Array.isArray(parsed) ? parsed : null;
  } catch {
    rows = null;
  }
  return { status: res.status, rows };
}

const denied = (r: { status: number; rows: unknown[] | null }): boolean =>
  r.status >= 400 || (Array.isArray(r.rows) && r.rows.length === 0);

test.describe("about-e2e-013 — committee member CRUD w/ photo + reap + authz (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "real sign-in + Storage upload against one DB/bucket — run once (desktop)",
    ),
  );

  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerData();
  });

  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const reapedKeys = await deleteMarkerData();

    const admin = createAdminClient();
    const { count: memberLeft, error: mErr } = await admin
      .from("committee_members")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(memberLeft, "TEARDOWN: no marker members may remain").toBe(0);

    const { count: comLeft, error: cErr } = await admin
      .from("committees")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (cErr) throw cErr;
    expect(comLeft, "TEARDOWN: no marker committees may remain").toBe(0);

    const { count: total, error: tErr } = await admin
      .from("committees")
      .select("*", { count: "exact", head: true });
    if (tErr) throw tErr;
    expect(total, "TEARDOWN: committees back to the 4 seeded rows").toBe(
      SEEDED_COMMITTEE_COUNT,
    );

    for (const key of reapedKeys) {
      expect(
        await objectExists(key),
        `TEARDOWN: marker Storage object ${key} must be gone`,
      ).toBe(false);
    }
  });

  test("(a) editor adds a member w/ PNG → persists + object exists + renders; edit; delete reaps", async ({
    page,
  }) => {
    const committeeName = `${MARKER_PREFIX} A ${randomUUID()}`;
    const memberName = `${MARKER_PREFIX} member ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await createMarkerCommittee(page, committeeName);

    // WHEN: the editor adds a member with an uploaded PNG to that committee.
    const item = () =>
      page.locator('[data-testid="committee-admin-item"]', { hasText: committeeName });
    const addForm = item().getByTestId("cm-add-form");
    await addForm.getByTestId("cm-name").fill(memberName);
    await addForm.getByTestId("cm-role").fill("Chair");
    await addForm.getByTestId("cm-photo-file").setInputFiles(pngUpload());
    await addForm.getByTestId("cm-sort").fill("1");
    await item().getByTestId("cm-add").click();
    await expect(item().getByTestId("committee-member-admin-item")).toHaveCount(1);

    // THEN: the member persists with a board-photos photo_url (out-of-band read)...
    let member: MemberRow | undefined;
    await expect
      .poll(async () => {
        member = (await readMarkerMembers()).find((m) => m.name === memberName);
        return member?.photo_url ?? null;
      }, { timeout: 10_000 })
      .not.toBeNull();
    const photoKey = keyFromPhotoUrl(member!.photo_url);
    expect(photoKey, "photo_url points at a board-photos object").not.toBeNull();

    // ...the Storage object actually EXISTS (LIST api)...
    expect(await objectExists(photoKey!), "uploaded object exists in the bucket").toBe(true);

    // ...and the member renders on /about under that committee.
    await page.goto("/about");
    const committeeCard = page.locator('[data-testid="committee"]', {
      hasText: committeeName,
    });
    await expect(
      committeeCard.locator('[data-testid="committee-member"]', { hasText: memberName }),
    ).toBeVisible();

    // WHEN: the editor edits the member's role.
    await page.goto("/admin/committees");
    const editForm = item()
      .locator('[data-testid="committee-member-admin-item"]', { hasText: memberName })
      .getByTestId("cm-edit-form");
    await editForm.getByTestId("cm-role").fill("Vice Chair");
    await item()
      .locator('[data-testid="committee-member-admin-item"]', { hasText: memberName })
      .getByTestId("cm-save")
      .click();

    // THEN: the role change persists (service read) and shows on /about.
    await expect
      .poll(async () => (await readMarkerMembers()).find((m) => m.name === memberName)?.role, {
        timeout: 10_000,
      })
      .toBe("Vice Chair");
    await page.goto("/about");
    await expect(
      page
        .locator('[data-testid="committee"]', { hasText: committeeName })
        .locator('[data-testid="committee-member"]', { hasText: memberName })
        .getByTestId("committee-member-role"),
    ).toContainText("Vice Chair");

    // WHEN: the editor deletes the member.
    await page.goto("/admin/committees");
    await item()
      .locator('[data-testid="committee-member-admin-item"]', { hasText: memberName })
      .getByTestId("cm-delete")
      .click();
    await expect(item().getByTestId("committee-member-admin-item")).toHaveCount(0);

    // THEN: the member row is gone and its Storage object was reaped (LIST api).
    await expect
      .poll(async () => (await readMarkerMembers()).some((m) => m.name === memberName), {
        timeout: 10_000,
      })
      .toBe(false);
    await expect
      .poll(async () => objectExists(photoKey!), { timeout: 10_000 })
      .toBe(false);
  });

  test("(b) a magic-byte-spoofed upload is rejected: cm-add-error, no member, no object", async ({
    page,
  }) => {
    const committeeName = `${MARKER_PREFIX} B ${randomUUID()}`;
    const memberName = `${MARKER_PREFIX} bad ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await createMarkerCommittee(page, committeeName);

    const item = page.locator('[data-testid="committee-admin-item"]', {
      hasText: committeeName,
    });
    const addForm = item.getByTestId("cm-add-form");

    // WHEN: a file with content-type image/png but SVG/text bytes is submitted.
    await addForm.getByTestId("cm-name").fill(memberName);
    await addForm.getByTestId("cm-photo-file").setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/> not really a png"),
    });
    await item.getByTestId("cm-add").click();

    // THEN: a form error, and no member row was added under the committee.
    await expect(item.getByTestId("cm-add-error")).toBeVisible();
    await expect(item.getByTestId("committee-member-admin-item")).toHaveCount(0);

    // dcon: no marker member with that name, and validation runs BEFORE upload so no object.
    expect(
      (await readMarkerMembers()).some((m) => m.name === memberName),
      "rejected upload creates no member row",
    ).toBe(false);
  });

  test("(c) deleting the parent committee reaps its members' photo objects", async ({
    page,
  }) => {
    const committeeName = `${MARKER_PREFIX} C ${randomUUID()}`;
    const memberName = `${MARKER_PREFIX} reap ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await createMarkerCommittee(page, committeeName);

    const item = () =>
      page.locator('[data-testid="committee-admin-item"]', { hasText: committeeName });
    const addForm = item().getByTestId("cm-add-form");
    await addForm.getByTestId("cm-name").fill(memberName);
    await addForm.getByTestId("cm-photo-file").setInputFiles(pngUpload());
    await item().getByTestId("cm-add").click();
    await expect(item().getByTestId("committee-member-admin-item")).toHaveCount(1);

    // Capture the object key before we delete the parent.
    let member: MemberRow | undefined;
    await expect
      .poll(async () => {
        member = (await readMarkerMembers()).find((m) => m.name === memberName);
        return member?.photo_url ?? null;
      }, { timeout: 10_000 })
      .not.toBeNull();
    const photoKey = keyFromPhotoUrl(member!.photo_url);
    expect(photoKey, "member has a board-photos object").not.toBeNull();
    expect(await objectExists(photoKey!), "object exists before committee delete").toBe(true);
    const committeeId = member!.committee_id;

    // WHEN: the editor deletes the whole committee.
    await item().getByTestId("committee-delete").click();
    await expect(item()).toHaveCount(0);

    // THEN: the member cascade-deleted...
    const admin = createAdminClient();
    await expect
      .poll(async () => {
        const { count } = await admin
          .from("committee_members")
          .select("*", { count: "exact", head: true })
          .eq("committee_id", committeeId);
        return count;
      }, { timeout: 10_000 })
      .toBe(0);

    // ...and its Storage object is GONE (verified via the LIST api, not the cached public URL).
    await expect
      .poll(async () => objectExists(photoKey!), { timeout: 10_000 })
      .toBe(false);
  });

  test("(d) contributor + anon are denied on a direct PostgREST committee_members write", async ({
    page,
  }) => {
    const committeeName = `${MARKER_PREFIX} D ${randomUUID()}`;

    // Create a real committee to target (through the editor UI, the canonical path).
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const committeeId = await createMarkerCommittee(page, committeeName);

    // --- anon key INSERT: no insert grant → denied.
    const anonInsert = await restMembers("POST", PUBLISHABLE_KEY as string, {
      committee_id: committeeId,
      name: `${MARKER_PREFIX} anon member`,
    });
    expect(denied(anonInsert), `anon member INSERT denied (got ${anonInsert.status})`).toBe(true);

    // --- contributor JWT INSERT: has grant but editor-only with_check → denied.
    const token = await contributorAccessToken();
    const cInsert = await restMembers("POST", token, {
      committee_id: committeeId,
      name: `${MARKER_PREFIX} contrib member`,
    });
    expect(denied(cInsert), `contributor member INSERT denied (got ${cInsert.status})`).toBe(true);

    // dcon: neither denied write created a member under the committee.
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("committee_members")
      .select("*", { count: "exact", head: true })
      .eq("committee_id", committeeId);
    if (error) throw error;
    expect(count, "no member row created by a denied PostgREST write").toBe(0);
  });
});
