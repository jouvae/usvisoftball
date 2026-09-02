/*
---
id: events-e2e-003
name: "events-e2e-003: Events admin CRUD w/ logo; upload lifecycle, date-grouping, reap, authz + RLS"
feature: softball/events
stack: web
priority: P1
group: A
references:
  - app/admin/(protected)/events/page.tsx (editor-gated /admin/events; requireRole('editor'))
  - app/admin/(protected)/events/actions.ts (create/update/deleteEventAction; logo reap)
  - components/client/event-form.tsx (add/edit form; event-* fields; logo upload block)
  - components/client/event-delete-button.tsx (event-delete)
  - lib/events.ts (createEvent/updateEvent/deleteEvent; slug stable; getEventLogoUrl)
  - lib/board-photos.ts (uploadBoardPhoto: declared-type + magic-byte validation; reap by URL)
  - components/ui/events-directory.tsx (public /events: events-upcoming/-past, event-card, event-name link)
  - app/(public)/events/[slug]/page.tsx (event-detail + event-detail-logo)
  - supabase/migrations/0017_events.sql (events; 3 seeded rows; public-read)
  - supabase/migrations/0018_events_admin.sql (editor-only events write RLS)
  - supabase/migrations/0009_board_photos_storage.sql (board-photos bucket, editor-only write)
---

The events admin-CRUD slice, all writes through the real editor session (0018 RLS is the boundary).

(a) An EDITOR creates an event (marker name, island "" = territory-wide, start 2098-05-01 /
    end 2098-05-05, uploaded PNG logo). It persists (service read: island IS NULL,
    start_date 2098-05-01, logo_url is a board-photos URL, object EXISTS via LIST api), renders
    on /events in the events-upcoming group, and its /events/[slug] detail shows an
    event-detail-logo img.
(b) Editing the event (venue + move dates to 2019-05-01/2019-05-05) persists (service read) and
    the slug stays STABLE; the event now lands in the events-past group (date-driven grouping).
(c) A magic-byte-SPOOFED logo upload is rejected with event-add-error, creates NO event, and —
    validation runs BEFORE upload — leaves NO new Storage object.
(d) Deleting an event removes it from /events and reaps its logo Storage object (GONE via the
    LIST api); the 3 seeded events remain.
(e) A CONTRIBUTOR is redirected /admin/events → /admin; ANON → /admin/login; a direct PostgREST
    INSERT/UPDATE/DELETE on `events` with the contributor JWT / anon key is denied (RLS/grant).

MANDATORY TEARDOWN (shared prod DB + Storage): every event uses a unique marker name. afterAll
(service key) collects each marker event's logo object, DELETEs marker events, removes the
collected board-photos objects, then asserts: events back to the 3 seeded rows, 0 marker events,
and none of the collected objects remain (LIST api). Desktop-gated. The service-key admin client
is teardown + out-of-band verification ONLY — every app write goes through the real editor session.
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

const MARKER_PREFIX = "e2e-003-marker";
const SEEDED_EVENT_COUNT = 3;
const PHOTO_PUBLIC_BASE = `${(SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${BOARD_PHOTOS_BUCKET}/`;

// A minimal but genuine 1x1 PNG (correct magic bytes) — passes the magic-byte sniff.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function pngUpload() {
  return { name: "logo.png", mimeType: "image/png", buffer: PNG_BYTES };
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

type EventRow = {
  id: string;
  name: string;
  slug: string;
  island: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string;
  logo_url: string;
};

const EVENT_COLUMNS = "id,name,slug,island,start_date,end_date,venue,logo_url";

async function readMarkerEvents(): Promise<EventRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .select(EVENT_COLUMNS)
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
  return (data as EventRow[] | null) ?? [];
}

// Collect every marker event's logo object, delete the marker events, then remove the collected
// board-photos objects. Returns the reaped keys.
async function deleteMarkerData(): Promise<string[]> {
  const admin = createAdminClient();
  const events = await readMarkerEvents();
  const keys = new Set<string>();
  for (const e of events) {
    const k = keyFromPhotoUrl(e.logo_url);
    if (k) keys.add(k);
  }
  const { error } = await admin
    .from("events")
    .delete()
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
  const keyList = [...keys];
  if (keyList.length > 0) {
    await admin.storage.from(BOARD_PHOTOS_BUCKET).remove(keyList);
  }
  return keyList;
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

async function restEvents(
  method: "POST" | "PATCH" | "DELETE",
  bearer: string,
  body: Record<string, unknown> | null,
  query = "",
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events${query}`, {
    method,
    headers: {
      apikey: PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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

// Create a marker event through the real editor UI (optionally with a PNG logo), returning its
// service-read row once persisted. The add form lives at the top of /admin/events.
async function createMarkerEvent(
  page: Page,
  name: string,
  opts: { island: string; startDate: string; endDate: string; withLogo?: boolean; venue?: string },
): Promise<EventRow> {
  await page.goto("/admin/events");
  await expect(page.getByTestId("events-admin")).toBeVisible();
  const form = page.getByTestId("event-add-form");
  await form.getByTestId("event-name").fill(name);
  await form.getByTestId("event-island").selectOption(opts.island);
  await form.getByTestId("event-start").fill(opts.startDate);
  await form.getByTestId("event-end").fill(opts.endDate);
  if (opts.venue) await form.getByTestId("event-venue").fill(opts.venue);
  if (opts.withLogo) await form.getByTestId("event-logo-file").setInputFiles(pngUpload());
  await page.getByTestId("event-add").click();
  await expect(
    page.locator('[data-testid="event-admin-item"]', { hasText: name }),
  ).toBeVisible();

  let row: EventRow | undefined;
  await expect
    .poll(async () => {
      row = (await readMarkerEvents()).find((e) => e.name === name);
      return row?.id ?? null;
    }, { timeout: 10_000 })
    .not.toBeNull();
  return row!;
}

// MVP launch: the Events section is flag-gated OFF (lib/flags.ts). With the flag
// unset every Events route returns 404, so these seed-backed specs cannot pass.
// Skip the whole file unless NEXT_PUBLIC_EVENTS_ENABLED=true — they stay meaningful
// and are exercised the moment the flag is flipped on.
test.beforeEach(() => {
  test.skip(
    process.env.NEXT_PUBLIC_EVENTS_ENABLED !== "true",
    "Events feature flag is OFF for the MVP launch",
  );
});

test.describe("events-e2e-003 — events admin CRUD w/ logo + date-grouping + reap + authz (desktop)", () => {
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

    const { count: markerLeft, error: mErr } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker events may remain").toBe(0);

    const { count: eventsTotal, error: tErr } = await admin
      .from("events")
      .select("*", { count: "exact", head: true });
    if (tErr) throw tErr;
    expect(eventsTotal, "TEARDOWN: events back to the 3 seeded rows").toBe(
      SEEDED_EVENT_COUNT,
    );

    for (const key of reapedKeys) {
      expect(
        await objectExists(key),
        `TEARDOWN: marker Storage object ${key} must be gone`,
      ).toBe(false);
    }
  });

  test("(a+b) editor creates a territory-wide upcoming event w/ PNG logo → persists + object + renders + detail-logo; edit moves it to Past, slug stable", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} A ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const created = await createMarkerEvent(page, name, {
      island: "", // Territory-wide → island IS NULL
      startDate: "2098-05-01",
      endDate: "2098-05-05",
      withLogo: true,
    });

    // THEN (a): persisted territory-wide, with the start date and a board-photos logo_url…
    expect(created.island, "territory-wide event persists island IS NULL").toBeNull();
    expect(created.start_date, "start_date persisted").toBe("2098-05-01");
    const logoKey = keyFromPhotoUrl(created.logo_url);
    expect(logoKey, "logo_url points at a board-photos object").not.toBeNull();
    // …whose Storage object actually EXISTS (LIST api, not the cached public URL).
    expect(await objectExists(logoKey!), "uploaded logo object exists").toBe(true);

    // …and it renders on /events in the UPCOMING group…
    await page.goto("/events");
    const upcomingCard = page
      .getByTestId("events-upcoming")
      .locator('[data-testid="event-card"]', { hasText: name });
    await expect(upcomingCard).toBeVisible();

    // …and its detail page shows a rendered event-detail-logo img.
    await page.goto(`/events/${created.slug}`);
    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-detail-logo")).toBeVisible();

    // WHEN (b): the editor edits venue + moves the dates into the past.
    await page.goto("/admin/events");
    const item = page.locator('[data-testid="event-admin-item"]', { hasText: name });
    const editForm = item.getByTestId("event-edit-form");
    await editForm.getByTestId("event-venue").fill("Lionel Roberts Stadium");
    await editForm.getByTestId("event-start").fill("2019-05-01");
    await editForm.getByTestId("event-end").fill("2019-05-05");
    await item.getByTestId("event-save").click();

    // THEN (b): venue + dates persist AND the slug stays stable (service read).
    await expect
      .poll(async () => (await readMarkerEvents()).find((e) => e.name === name)?.end_date, {
        timeout: 10_000,
      })
      .toBe("2019-05-05");
    const after = (await readMarkerEvents()).find((e) => e.name === name);
    expect(after!.venue, "venue change persisted").toBe("Lionel Roberts Stadium");
    expect(after!.slug, "slug is stable across an edit").toBe(created.slug);

    // …and the event now lands in the PAST group on /events (date-driven grouping).
    await page.goto("/events");
    await expect(
      page.getByTestId("events-past").locator('[data-testid="event-card"]', { hasText: name }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("events-upcoming")
        .locator('[data-testid="event-card"]', { hasText: name }),
    ).toHaveCount(0);
  });

  test("(c) a magic-byte-spoofed logo upload is rejected: event-add-error, no event, no object", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} C ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.goto("/admin/events");
    await expect(page.getByTestId("events-admin")).toBeVisible();

    const form = page.getByTestId("event-add-form");
    await form.getByTestId("event-name").fill(name);
    await form.getByTestId("event-start").fill("2098-06-01");
    await form.getByTestId("event-end").fill("2098-06-05");
    // A file with content-type image/png but non-PNG bytes — fails the magic-byte sniff.
    await form.getByTestId("event-logo-file").setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/> not really a png"),
    });
    await page.getByTestId("event-add").click();

    // THEN: a form error, and NO event row was created (validation runs BEFORE upload, so no
    // object is ever written — there is no key to have leaked).
    await expect(form.getByTestId("event-add-error")).toBeVisible();
    expect(
      (await readMarkerEvents()).some((e) => e.name === name),
      "rejected upload creates no event row",
    ).toBe(false);
  });

  test("(d) deleting an event removes it from /events and reaps its logo object; seeded events remain", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} D ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const event = await createMarkerEvent(page, name, {
      island: "st_croix",
      startDate: "2098-07-01",
      endDate: "2098-07-05",
      withLogo: true,
    });
    const logoKey = keyFromPhotoUrl(event.logo_url);
    expect(logoKey, "event has a board-photos logo object").not.toBeNull();
    expect(await objectExists(logoKey!), "logo object exists before delete").toBe(true);

    // WHEN: the editor deletes the event from /admin/events.
    await page.goto("/admin/events");
    const item = page.locator('[data-testid="event-admin-item"]', { hasText: name });
    await item.getByTestId("event-delete").click();
    await expect(item).toHaveCount(0);

    // THEN: gone from the public directory…
    await page.goto("/events");
    await expect(
      page.locator('[data-testid="event-card"]', { hasText: name }),
    ).toHaveCount(0);

    // …the event row is gone…
    await expect
      .poll(async () => (await readMarkerEvents()).some((e) => e.name === name), {
        timeout: 10_000,
      })
      .toBe(false);

    // …the logo Storage object was reaped (LIST api, not the cached public URL)…
    await expect
      .poll(async () => objectExists(logoKey!), { timeout: 10_000 })
      .toBe(false);

    // …and the 3 seeded (non-marker) events remain untouched. (Tests run serially against one
    // DB; earlier tests' marker rows are only reaped in afterAll, so count NON-marker rows.)
    const admin = createAdminClient();
    const { count: seededLeft, error } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .not("name", "like", `${MARKER_PREFIX}%`);
    if (error) throw error;
    expect(seededLeft, "the 3 seeded events remain after the delete").toBe(SEEDED_EVENT_COUNT);
  });

  test("(e) contributor → /admin, anon → /admin/login, and direct PostgREST writes on events are denied", async ({
    page,
  }) => {
    // Anon (no session): /admin/events redirects to the login page.
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("events-admin")).toHaveCount(0);

    // Contributor: signs in, but is a non-editor → redirected off /admin/events to /admin.
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("events-admin")).toHaveCount(0);

    // Create a real marker event (editor UI) to target with the denied writes.
    const context = page.context();
    const editorPage = await context.browser()!.newPage();
    await signIn(editorPage, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const name = `${MARKER_PREFIX} E ${randomUUID()}`;
    const event = await createMarkerEvent(editorPage, name, {
      island: "st_thomas",
      startDate: "2098-08-01",
      endDate: "2098-08-05",
    });
    await editorPage.close();

    const token = await contributorAccessToken();

    // anon INSERT — no insert grant (0017 revokes all, grants only SELECT to anon) → denied.
    const anonInsert = await restEvents("POST", PUBLISHABLE_KEY as string, {
      name: `${MARKER_PREFIX} anon`,
      slug: `${MARKER_PREFIX}-anon-${randomUUID()}`,
    });
    expect(denied(anonInsert), `anon INSERT denied (got ${anonInsert.status})`).toBe(true);

    // contributor INSERT — has grant but editor-only with_check → denied.
    const cInsert = await restEvents("POST", token, {
      name: `${MARKER_PREFIX} contrib`,
      slug: `${MARKER_PREFIX}-contrib-${randomUUID()}`,
    });
    expect(denied(cInsert), `contributor INSERT denied (got ${cInsert.status})`).toBe(true);

    // contributor UPDATE of the real event — editor-only using/with_check → 0 rows.
    const cUpdate = await restEvents(
      "PATCH",
      token,
      { venue: "hijacked" },
      `?id=eq.${event.id}`,
    );
    expect(denied(cUpdate), `contributor UPDATE denied (got ${cUpdate.status})`).toBe(true);

    // contributor DELETE of the real event — editor-only using → 0 rows.
    const cDelete = await restEvents("DELETE", token, null, `?id=eq.${event.id}`);
    expect(denied(cDelete), `contributor DELETE denied (got ${cDelete.status})`).toBe(true);

    // dcon: the target event is untouched (still present, venue unchanged).
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("events")
      .select("id,venue")
      .eq("id", event.id)
      .maybeSingle();
    if (error) throw error;
    expect(data, "target event survives the denied writes").not.toBeNull();
    expect((data as { venue: string }).venue, "venue not hijacked").not.toBe("hijacked");
  });
});
