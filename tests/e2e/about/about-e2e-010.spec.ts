/*
---
id: about-e2e-010
name: "about-e2e-010: Editor edits contact info; validation + authz + RLS boundaries"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/contact/page.tsx (requireRole('editor') → contact-admin)
  - app/admin/(protected)/contact/actions.ts (updateContactAction → contact-error)
  - components/client/contact-edit-form.tsx (contact-form + inputs + contact-save/error)
  - lib/contact.ts (assertSocialUrlAllowed: https + facebook/instagram host allowlist)
  - supabase/migrations/0010_contact_info.sql (public read; UPDATE requires editor)
  - lib/roles.ts / lib/auth.ts (requireRole('editor') → /admin; requireUser → /admin/login)
---

Three boundaries on the shared `contact_info` singleton:

(a) An EDITOR edits a field via /admin/contact and saves; /about reflects it
    (verified both in the browser AND by an out-of-band service read).

(b) An INVALID social URL is rejected. `javascript:alert(1)`, a non-https
    `http://www.facebook.com/x`, and an off-allowlist `https://evil.example.com/x`
    each surface `contact-error`, do NOT persist (service read proves facebook_url
    unchanged), and do NOT break the page (the form stays rendered).

(c) A signed-in CONTRIBUTOR is redirected off /admin/contact (never sees
    contact-admin); an ANON request is redirected to /admin/login; and a direct
    PostgREST PATCH of contact_info with the anon key / a contributor JWT is denied
    by RLS (401/403 or 0 rows) — email/facebook_url unchanged.

MANDATORY TEARDOWN: beforeAll snapshots the singleton via the service key; afterAll
PATCHes it back to those exact values and asserts equality. The service-key admin
client is setup/teardown + out-of-band verification ONLY — every app-level write
goes through the real editor session (Server Action → 0010 editor RLS). Desktop-
gated so the mobile project does not double-run the shared-state mutations.
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

type ContactRow = {
  email: string;
  phone: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
};

// The pristine singleton, snapshotted in beforeAll and restored (exactly) in afterAll.
let ORIGINAL: ContactRow;

async function readContact(): Promise<ContactRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_info")
    .select("email,phone,address,facebook_url,instagram_url")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data as ContactRow;
}

async function restoreContact(row: ContactRow): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_info")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
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

// Real Supabase Auth password grant → an access_token, so we can drive a raw
// PostgREST PATCH as a genuine contributor (no minted/forged JWT — the real flow).
async function contributorAccessToken(): Promise<string> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY must be set.");
  }
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: CONTRIBUTOR_EMAIL,
        password: CONTRIBUTOR_PASSWORD,
      }),
    },
  );
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`contributor sign-in failed: ${res.status}`);
  }
  return body.access_token;
}

// Raw PostgREST PATCH of the singleton with a caller-supplied bearer token.
// Returns the HTTP status and (when 2xx with representation) the affected rows.
async function patchContact(
  bearer: string,
  patch: Record<string, string>,
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contact_info?id=eq.true`,
    {
      method: "PATCH",
      headers: {
        apikey: PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
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

test.describe("about-e2e-010 — editor edit + validation + authz/RLS (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "real sign-in + shared-singleton mutation against one DB — run once (desktop)",
    ),
  );

  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    ORIGINAL = await readContact();
  });

  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    // Restore the singleton to its pristine, snapshotted values...
    await restoreContact(ORIGINAL);
    // ...and PROVE the shared row is exactly as we found it.
    const now = await readContact();
    expect(now.email, "TEARDOWN: email restored").toBe(ORIGINAL.email);
    expect(now.phone, "TEARDOWN: phone restored").toBe(ORIGINAL.phone);
    expect(now.address, "TEARDOWN: address restored").toBe(ORIGINAL.address);
    expect(now.facebook_url, "TEARDOWN: facebook restored").toBe(
      ORIGINAL.facebook_url,
    );
    expect(now.instagram_url, "TEARDOWN: instagram restored").toBe(
      ORIGINAL.instagram_url,
    );
  });

  test("(a) an editor edits the email; /about and the DB reflect the new value", async ({
    page,
  }) => {
    const marker = `e2e-010-${randomUUID().slice(0, 8)}@usvisoftball.vi`;

    // GIVEN: a signed-in editor on the contact admin screen (reached via the nav link).
    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.getByTestId("admin-contact-link").click();
    await expect(page).toHaveURL(/\/admin\/contact$/);
    await expect(page.getByTestId("contact-admin")).toBeVisible();

    // WHEN: they change the email and save (Server Action → editor session → 0010 RLS).
    await page.getByTestId("contact-email-input").fill(marker);
    await page.getByTestId("contact-save").click();

    // THEN: the write lands in the singleton (out-of-band, auto-retried).
    await expect
      .poll(async () => (await readContact()).email, { timeout: 10_000 })
      .toBe(marker);

    // ...and the public page reflects it (mailto: href + visible text).
    await page.goto("/about");
    const emailLink = page.getByTestId("contact-email");
    await expect(emailLink).toHaveAttribute("href", `mailto:${marker}`);
    await expect(emailLink).toContainText(marker);
  });

  test("(b) invalid social URLs are rejected, do not persist, and do not break the page", async ({
    page,
  }) => {
    const before = await readContact();
    const badUrls = [
      "javascript:alert(1)",
      "http://www.facebook.com/x",
      "https://evil.example.com/x",
    ];

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.goto("/admin/contact");
    await expect(page.getByTestId("contact-admin")).toBeVisible();

    for (const bad of badUrls) {
      // WHEN: the Facebook field is set to a disallowed URL and saved.
      const fb = page.getByTestId("contact-facebook-input");
      await fb.fill(bad);
      await page.getByTestId("contact-save").click();

      // THEN: a friendly form error surfaces and the form stays rendered (no crash).
      await expect(
        page.getByTestId("contact-error"),
        `"${bad}" must surface contact-error`,
      ).toBeVisible();
      await expect(page.getByTestId("contact-form")).toBeVisible();

      // ...and nothing persisted: facebook_url is unchanged from before this test.
      expect(
        (await readContact()).facebook_url,
        `"${bad}" must not persist to facebook_url`,
      ).toBe(before.facebook_url);
    }
  });

  test("(c) contributor and anon are gated; a raw PostgREST PATCH is denied by RLS", async ({
    page,
  }) => {
    const before = await readContact();

    // --- contributor: signed in, but not an editor → redirected off /admin/contact.
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");
    await page.goto("/admin/contact");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("contact-admin")).toHaveCount(0);
    await expect(page.getByTestId("contact-form")).toHaveCount(0);

    // --- anon: no session → redirected to the login screen.
    await page.context().clearCookies();
    await page.goto("/admin/contact");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByTestId("contact-admin")).toHaveCount(0);

    // --- raw PostgREST PATCH with the ANON (publishable) key: no UPDATE grant → denied.
    const anonPatch = await patchContact(PUBLISHABLE_KEY as string, {
      facebook_url: "https://www.facebook.com/HACKED-anon",
      email: "hacked-anon@evil.example.com",
    });
    expect(
      anonPatch.status >= 400 ||
        (Array.isArray(anonPatch.rows) && anonPatch.rows.length === 0),
      `anon PATCH must be denied by RLS (got ${anonPatch.status}, rows=${anonPatch.rows?.length})`,
    ).toBe(true);

    // --- raw PostgREST PATCH with a real CONTRIBUTOR JWT: has UPDATE grant but the
    //     editor-only policy matches 0 rows → the write affects nothing.
    const token = await contributorAccessToken();
    const contribPatch = await patchContact(token, {
      facebook_url: "https://www.facebook.com/HACKED-contrib",
      email: "hacked-contrib@evil.example.com",
    });
    expect(
      contribPatch.status >= 400 ||
        (Array.isArray(contribPatch.rows) && contribPatch.rows.length === 0),
      `contributor PATCH must be denied by RLS (got ${contribPatch.status}, rows=${contribPatch.rows?.length})`,
    ).toBe(true);

    // dcon: neither denied write moved the singleton.
    const after = await readContact();
    expect(after.email, "email unchanged by denied PATCHes").toBe(before.email);
    expect(after.facebook_url, "facebook_url unchanged by denied PATCHes").toBe(
      before.facebook_url,
    );
  });
});
