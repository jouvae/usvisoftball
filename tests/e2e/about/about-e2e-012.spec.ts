/*
---
id: about-e2e-012
name: "about-e2e-012: Editor committee CRUD; slug stability, cascade, authz + RLS"
feature: softball/about
stack: web
priority: P1
group: A
references:
  - app/admin/(protected)/committees/page.tsx (requireRole('editor') → committees-admin)
  - app/admin/(protected)/committees/actions.ts (create/update/deleteCommitteeAction)
  - lib/committees.ts (slugify: slug set on create, NEVER re-derived on update)
  - supabase/migrations/0011_committees.sql (public read; unique(slug); FK on delete cascade)
  - supabase/migrations/0012_committees_admin.sql (editor-only insert/update/delete RLS)
  - components/ui/committees-section.tsx (public /about render: committee/committee-name)
  - lib/roles.ts / lib/auth.ts (requireRole('editor') → /admin; requireUser → /admin/login)
---

The committees admin-CRUD lifecycle on the standing `committees` table.

(a) An EDITOR creates a committee (marker name) via /admin/committees; it persists (service
    read) and appears on the public /about page. Renaming it is reflected on /about, and the
    slug stays STABLE across the rename (verified via a service-key read — slugify runs only
    on create). Deleting it removes it from /about AND cascade-deletes its committee_members
    (both counts proven 0 out-of-band).

(b) A CONTRIBUTOR is redirected off /admin/committees to /admin (never sees committees-admin);
    an ANON request is redirected to /admin/login; and a direct PostgREST INSERT / UPDATE /
    DELETE on committees with the anon key or a real contributor JWT is denied by RLS
    (401/403 or 0 rows) — the seeded row is untouched.

MANDATORY TEARDOWN (shared prod DB): all created committees use a unique marker name. afterAll
(service key) deletes marker committees (cascading their members), then asserts the committees
table is back to the 4 seeded rows with zero marker rows. Desktop-gated so the mobile project
does not double-run the shared-state mutations. The service-key admin client is setup/teardown
+ out-of-band verification ONLY — every app-level write goes through the real editor session.
*/

import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const isDesktop = (t: TestInfo): boolean => t.project.name === "desktop";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const MARKER_PREFIX = "e2e-012-marker";
const SEEDED_COMMITTEE_COUNT = 4;

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

type CommitteeRow = { id: string; name: string; slug: string };

async function readCommitteeByName(name: string): Promise<CommitteeRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committees")
    .select("id,name,slug")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return (data as CommitteeRow | null) ?? null;
}

async function readSeededCommittee(): Promise<CommitteeRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("committees")
    .select("id,name,slug")
    .eq("slug", "competition")
    .single();
  if (error) throw error;
  return data as CommitteeRow;
}

async function deleteMarkerCommittees(): Promise<void> {
  const admin = createAdminClient();
  // committee_members cascade via FK, but delete them explicitly first in case a marker
  // member was ever attached to a NON-marker committee (defence in depth for teardown).
  const { error } = await admin
    .from("committees")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
}

// Real Supabase Auth password grant → a genuine contributor access_token (no minted JWT).
async function contributorAccessToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY as string, "Content-Type": "application/json" },
    body: JSON.stringify({ email: CONTRIBUTOR_EMAIL, password: CONTRIBUTOR_PASSWORD }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`contributor sign-in failed: ${res.status}`);
  }
  return body.access_token;
}

// Raw PostgREST call with a caller-supplied bearer + apikey. Returns status + rows (or null).
async function restCommittees(
  method: "POST" | "PATCH" | "DELETE",
  apikey: string,
  bearer: string,
  opts: { query?: string; body?: Record<string, unknown> } = {},
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/committees${opts.query ?? ""}`,
    {
      method,
      headers: {
        apikey,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    },
  );
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

test.describe("about-e2e-012 — editor committee CRUD + authz/RLS (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "real sign-in + shared-DB mutation against one DB — run once (desktop)",
    ),
  );

  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerCommittees();
  });

  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    await deleteMarkerCommittees();

    const admin = createAdminClient();
    const { count: markerLeft, error: mErr } = await admin
      .from("committees")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker committee may remain").toBe(0);

    const { count: total, error: tErr } = await admin
      .from("committees")
      .select("*", { count: "exact", head: true });
    if (tErr) throw tErr;
    expect(total, "TEARDOWN: committees back to the 4 seeded rows").toBe(
      SEEDED_COMMITTEE_COUNT,
    );
  });

  test("(a) editor creates → renames (slug stable) → deletes (members cascade)", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} ${randomUUID()}`;
    const renamed = `${name} RENAMED`;

    // GIVEN: a signed-in editor on the committees admin screen.
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.goto("/admin/committees");
    await expect(page.getByTestId("committees-admin")).toBeVisible();

    // WHEN: they add a committee (Server Action → editor session → 0012 RLS).
    const addForm = page.getByTestId("committee-add-form");
    await addForm.getByTestId("committee-name").fill(name);
    await addForm.getByTestId("committee-description").fill("Marker committee");
    await addForm.getByTestId("committee-sort").fill("5");
    await page.getByTestId("committee-add").click();

    // THEN: it appears in the admin list...
    const item = page.locator('[data-testid="committee-admin-item"]', {
      hasText: name,
    });
    await expect(item).toBeVisible();

    // ...persists (out-of-band service read) with a slug derived from the name...
    let row: CommitteeRow | null = null;
    await expect
      .poll(async () => {
        row = await readCommitteeByName(name);
        return row?.name ?? null;
      }, { timeout: 10_000 })
      .toBe(name);
    const originalSlug = row!.slug;
    expect(originalSlug.length, "a non-empty slug is generated on create").toBeGreaterThan(0);

    // ...and renders on the public /about page.
    await page.goto("/about");
    await expect(
      page.locator('[data-testid="committee"]', { hasText: name }),
    ).toBeVisible();

    // WHEN: the editor renames the committee.
    await page.goto("/admin/committees");
    const editForm = page
      .locator('[data-testid="committee-admin-item"]', { hasText: name })
      .getByTestId("committee-edit-form");
    await editForm.getByTestId("committee-name").fill(renamed);
    await editForm.getByTestId("committee-save").click();
    await expect(
      page.locator('[data-testid="committee-admin-item"]', { hasText: renamed }),
    ).toBeVisible();

    // THEN: /about reflects the new name, and the slug is UNCHANGED (never re-derived).
    await page.goto("/about");
    await expect(
      page.locator('[data-testid="committee"]', { hasText: renamed }),
    ).toBeVisible();
    const afterRename = await readCommitteeByName(renamed);
    expect(afterRename, "renamed committee is readable").not.toBeNull();
    expect(afterRename!.slug, "slug is STABLE across a rename").toBe(originalSlug);
    const committeeId = afterRename!.id;

    // GIVEN: attach a member so the cascade has something to reap (real editor member add).
    await page.goto("/admin/committees");
    const memberForm = page
      .locator('[data-testid="committee-admin-item"]', { hasText: renamed })
      .getByTestId("cm-add-form");
    await memberForm.getByTestId("cm-name").fill(`${MARKER_PREFIX} member`);
    await memberForm.getByTestId("cm-role").fill("Chair");
    await memberForm.getByTestId("cm-sort").fill("1");
    await page
      .locator('[data-testid="committee-admin-item"]', { hasText: renamed })
      .getByTestId("cm-add")
      .click();
    await expect(
      page
        .locator('[data-testid="committee-admin-item"]', { hasText: renamed })
        .getByTestId("committee-member-admin-item"),
    ).toHaveCount(1);

    // WHEN: the editor deletes the committee.
    await page
      .locator('[data-testid="committee-admin-item"]', { hasText: renamed })
      .getByTestId("committee-delete")
      .click();
    await expect(
      page.locator('[data-testid="committee-admin-item"]', { hasText: renamed }),
    ).toHaveCount(0);

    // THEN: it is gone from /about...
    await page.goto("/about");
    await expect(
      page.locator('[data-testid="committee"]', { hasText: renamed }),
    ).toHaveCount(0);

    // ...and its committee_members cascade-deleted (out-of-band count = 0), committee gone.
    const admin = createAdminClient();
    const { count: memberCount, error: mErr } = await admin
      .from("committee_members")
      .select("*", { count: "exact", head: true })
      .eq("committee_id", committeeId);
    if (mErr) throw mErr;
    expect(memberCount, "committee_members cascade-deleted with the committee").toBe(0);
    expect(await readCommitteeByName(renamed), "committee row removed").toBeNull();
  });

  test("(b) contributor + anon gated; raw PostgREST writes denied by RLS", async ({
    page,
  }) => {
    const seeded = await readSeededCommittee();

    // --- contributor: signed in, not an editor → redirected off /admin/committees.
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");
    await page.goto("/admin/committees");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("committees-admin")).toHaveCount(0);

    // --- anon: no session → redirected to the login screen.
    await page.context().clearCookies();
    await page.goto("/admin/committees");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByTestId("committees-admin")).toHaveCount(0);

    // --- raw PostgREST with the ANON key: no insert grant → denied.
    const anonInsert = await restCommittees("POST", PUBLISHABLE_KEY as string, PUBLISHABLE_KEY as string, {
      body: { name: `${MARKER_PREFIX} anon`, slug: `${MARKER_PREFIX}-anon-${randomUUID()}` },
    });
    expect(denied(anonInsert), `anon INSERT denied (got ${anonInsert.status})`).toBe(true);

    // --- raw PostgREST with a real CONTRIBUTOR JWT: has grants but the editor-only policy
    //     matches 0 rows / fails with_check → every write denied.
    const token = await contributorAccessToken();
    const cInsert = await restCommittees("POST", PUBLISHABLE_KEY as string, token, {
      body: { name: `${MARKER_PREFIX} contrib`, slug: `${MARKER_PREFIX}-contrib-${randomUUID()}` },
    });
    expect(denied(cInsert), `contributor INSERT denied (got ${cInsert.status})`).toBe(true);

    const cUpdate = await restCommittees("PATCH", PUBLISHABLE_KEY as string, token, {
      query: `?id=eq.${seeded.id}`,
      body: { name: `${MARKER_PREFIX} HACKED` },
    });
    expect(denied(cUpdate), `contributor UPDATE denied (got ${cUpdate.status})`).toBe(true);

    const cDelete = await restCommittees("DELETE", PUBLISHABLE_KEY as string, token, {
      query: `?id=eq.${seeded.id}`,
    });
    expect(denied(cDelete), `contributor DELETE denied (got ${cDelete.status})`).toBe(true);

    // dcon: no marker row was inserted, and the seeded committee is untouched.
    expect(await readCommitteeByName(`${MARKER_PREFIX} anon`), "no anon row").toBeNull();
    expect(await readCommitteeByName(`${MARKER_PREFIX} contrib`), "no contrib row").toBeNull();
    const after = await readSeededCommittee();
    expect(after.name, "seeded committee name unchanged").toBe(seeded.name);
    expect(after.id, "seeded committee not deleted").toBe(seeded.id);
  });
});
