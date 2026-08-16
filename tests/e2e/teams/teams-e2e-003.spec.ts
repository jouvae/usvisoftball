/*
---
id: teams-e2e-003
name: "teams-e2e-003: Teams admin CRUD w/ logo; upload lifecycle, cascade+reap, authz + RLS"
feature: softball/teams
stack: web
priority: P1
group: A
references:
  - app/admin/(protected)/teams/page.tsx (editor-gated /admin/teams; requireRole('editor'))
  - app/admin/(protected)/teams/actions.ts (create/update/deleteTeamAction; logo reap)
  - components/client/team-form.tsx (add/edit form; team-* fields; logo upload block)
  - components/client/team-delete-button.tsx (team-delete)
  - lib/teams.ts (createTeam/updateTeam/deleteTeam; slug stable; getTeamOwnedPhotoUrls)
  - lib/board-photos.ts (uploadBoardPhoto: declared-type + magic-byte validation; reap by URL)
  - components/ui/teams-directory.tsx (public /teams: team-island-group/-name, team-card, team-logo)
  - supabase/migrations/0013_teams.sql (teams; 5 seeded rows; public-read)
  - supabase/migrations/0014_team_players.sql (team_players; FK on delete cascade; 17 seeded)
  - supabase/migrations/0015_teams_admin.sql (editor-only teams write RLS)
  - supabase/migrations/0009_board_photos_storage.sql (board-photos bucket, editor-only write)
---

The teams admin-CRUD slice, all writes through the real editor session (0015 RLS is the boundary).

(a) An EDITOR creates a team (marker name, island st_croix, uploaded PNG logo). It persists
    (service read: island=st_croix, logo_url is a board-photos URL, object EXISTS via LIST api)
    and renders on /teams in the St. Croix group with a rendered team-logo img.
(b) Editing the team (division) persists (service read) and the slug stays STABLE.
(c) A magic-byte-SPOOFED logo upload is rejected with team-add-error, creates NO team, and —
    validation runs BEFORE upload — leaves NO new Storage object.
(d) Deleting a team removes it from /teams, cascade-deletes its team_players (a service-inserted
    player row with a photo_url), and reaps its logo Storage object (GONE via the LIST api).
(e) A CONTRIBUTOR is redirected /admin/teams → /admin; ANON → /admin/login; a direct PostgREST
    INSERT/UPDATE/DELETE on `teams` with the contributor JWT / anon key is denied (RLS).

MANDATORY TEARDOWN (shared prod DB + Storage): every team uses a unique marker name. afterAll
(service key) collects each marker team's logo + players' photo objects, DELETEs marker teams
(cascade players), removes the collected board-photos objects, then asserts: teams back to the
5 seeded rows, 0 marker teams, team_players back to 17, and none of the collected objects remain
(LIST api). Desktop-gated. The service-key admin client is teardown + out-of-band verification
ONLY — every app write goes through the real editor session.
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
const SEEDED_TEAM_COUNT = 5;
const SEEDED_PLAYER_COUNT = 17;
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

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  island: string;
  division: string;
  logo_url: string;
};

async function readMarkerTeams(): Promise<TeamRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .select("id,name,slug,island,division,logo_url")
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
  return (data as TeamRow[] | null) ?? [];
}

// Collect every Storage object owned by a marker team (its logo + its players' photos), delete
// the marker teams (cascade players), then remove the collected objects. Returns reaped keys.
async function deleteMarkerData(): Promise<string[]> {
  const admin = createAdminClient();
  const teams = await readMarkerTeams();
  const keys = new Set<string>();
  for (const t of teams) {
    const k = keyFromPhotoUrl(t.logo_url);
    if (k) keys.add(k);
    const { data: players } = await admin
      .from("team_players")
      .select("photo_url")
      .eq("team_id", t.id);
    for (const p of players ?? []) {
      const pk = keyFromPhotoUrl((p as { photo_url: string | null }).photo_url);
      if (pk) keys.add(pk);
    }
  }
  const { error } = await admin
    .from("teams")
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

async function restTeams(
  method: "POST" | "PATCH" | "DELETE",
  bearer: string,
  body: Record<string, unknown> | null,
  query = "",
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams${query}`, {
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

// Create a marker team through the real editor UI (optionally with a PNG logo), returning its
// service-read row once persisted. The add form lives at the top of /admin/teams.
async function createMarkerTeam(
  page: Page,
  name: string,
  opts: { island: string; withLogo?: boolean; division?: string },
): Promise<TeamRow> {
  await page.goto("/admin/teams");
  await expect(page.getByTestId("teams-admin")).toBeVisible();
  const form = page.getByTestId("team-add-form");
  await form.getByTestId("team-name").fill(name);
  await form.getByTestId("team-island").selectOption(opts.island);
  if (opts.division) await form.getByTestId("team-division").fill(opts.division);
  if (opts.withLogo) await form.getByTestId("team-logo-file").setInputFiles(pngUpload());
  await page.getByTestId("team-add").click();
  await expect(
    page.locator('[data-testid="team-admin-item"]', { hasText: name }),
  ).toBeVisible();

  let row: TeamRow | undefined;
  await expect
    .poll(async () => {
      row = (await readMarkerTeams()).find((t) => t.name === name);
      return row?.id ?? null;
    }, { timeout: 10_000 })
    .not.toBeNull();
  return row!;
}

test.describe("teams-e2e-003 — teams admin CRUD w/ logo + cascade/reap + authz (desktop)", () => {
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
      .from("teams")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker teams may remain").toBe(0);

    const { count: teamsTotal, error: tErr } = await admin
      .from("teams")
      .select("*", { count: "exact", head: true });
    if (tErr) throw tErr;
    expect(teamsTotal, "TEARDOWN: teams back to the 5 seeded rows").toBe(
      SEEDED_TEAM_COUNT,
    );

    const { count: playersTotal, error: pErr } = await admin
      .from("team_players")
      .select("*", { count: "exact", head: true });
    if (pErr) throw pErr;
    expect(playersTotal, "TEARDOWN: team_players back to 17 seeded rows").toBe(
      SEEDED_PLAYER_COUNT,
    );

    for (const key of reapedKeys) {
      expect(
        await objectExists(key),
        `TEARDOWN: marker Storage object ${key} must be gone`,
      ).toBe(false);
    }
  });

  test("(a+b) editor creates a St. Croix team w/ PNG logo → persists + object + renders; edit keeps slug stable", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} A ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const created = await createMarkerTeam(page, name, {
      island: "st_croix",
      withLogo: true,
      division: "Open",
    });

    // THEN (a): persisted with island=st_croix and a board-photos logo_url…
    expect(created.island, "team persisted on st_croix").toBe("st_croix");
    const logoKey = keyFromPhotoUrl(created.logo_url);
    expect(logoKey, "logo_url points at a board-photos object").not.toBeNull();
    // …whose Storage object actually EXISTS (LIST api, not the cached public URL).
    expect(await objectExists(logoKey!), "uploaded logo object exists").toBe(true);

    // …and it renders on /teams in the St. Croix group with a rendered logo img.
    await page.goto("/teams");
    const group = page.locator('[data-testid="team-island-group"]', {
      has: page.locator('[data-testid="team-island-name"]', { hasText: "St. Croix" }),
    });
    const card = group.locator('[data-testid="team-card"]', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("team-logo")).toBeVisible();

    // WHEN (b): the editor edits the team's division.
    await page.goto("/admin/teams");
    const item = page.locator('[data-testid="team-admin-item"]', { hasText: name });
    const editForm = item.getByTestId("team-edit-form");
    await editForm.getByTestId("team-division").fill("Masters");
    await item.getByTestId("team-save").click();

    // THEN (b): the division change persists AND the slug stays stable (service read).
    await expect
      .poll(async () => (await readMarkerTeams()).find((t) => t.name === name)?.division, {
        timeout: 10_000,
      })
      .toBe("Masters");
    const after = (await readMarkerTeams()).find((t) => t.name === name);
    expect(after!.slug, "slug is stable across an edit").toBe(created.slug);
  });

  test("(c) a magic-byte-spoofed logo upload is rejected: team-add-error, no team, no object", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} C ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await page.goto("/admin/teams");
    await expect(page.getByTestId("teams-admin")).toBeVisible();

    const form = page.getByTestId("team-add-form");
    await form.getByTestId("team-name").fill(name);
    await form.getByTestId("team-island").selectOption("st_thomas");
    // A file with content-type image/png but non-PNG bytes — fails the magic-byte sniff.
    await form.getByTestId("team-logo-file").setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/> not really a png"),
    });
    await page.getByTestId("team-add").click();

    // THEN: a form error, and NO team row was created (validation runs BEFORE upload, so no
    // object is ever written — there is no key to have leaked).
    await expect(form.getByTestId("team-add-error")).toBeVisible();
    expect(
      (await readMarkerTeams()).some((t) => t.name === name),
      "rejected upload creates no team row",
    ).toBe(false);
  });

  test("(d) deleting a team removes it from /teams, cascades team_players, and reaps its logo object", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} D ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const team = await createMarkerTeam(page, name, {
      island: "st_croix",
      withLogo: true,
    });
    const logoKey = keyFromPhotoUrl(team.logo_url);
    expect(logoKey, "team has a board-photos logo object").not.toBeNull();
    expect(await objectExists(logoKey!), "logo object exists before delete").toBe(true);

    // Service-key insert a roster row for the team, reusing the logo object as its photo_url,
    // so the delete must cascade the player AND reap the object.
    const admin = createAdminClient();
    const playerName = `${MARKER_PREFIX} player ${randomUUID()}`;
    const { error: insErr } = await admin.from("team_players").insert({
      team_id: team.id,
      name: playerName,
      photo_url: team.logo_url,
      sort_order: 99,
    });
    if (insErr) throw insErr;

    // WHEN: the editor deletes the team from /admin/teams.
    await page.goto("/admin/teams");
    const item = page.locator('[data-testid="team-admin-item"]', { hasText: name });
    await item.getByTestId("team-delete").click();
    await expect(item).toHaveCount(0);

    // THEN: gone from the public directory…
    await page.goto("/teams");
    await expect(
      page.locator('[data-testid="team-card"]', { hasText: name }),
    ).toHaveCount(0);

    // …the team row is gone…
    await expect
      .poll(async () => (await readMarkerTeams()).some((t) => t.name === name), {
        timeout: 10_000,
      })
      .toBe(false);

    // …the player cascade-deleted…
    const { count: playerCount, error: pcErr } = await admin
      .from("team_players")
      .select("*", { count: "exact", head: true })
      .eq("name", playerName);
    if (pcErr) throw pcErr;
    expect(playerCount, "team_players row cascade-deleted with its team").toBe(0);

    // …and the logo Storage object was reaped (LIST api, not the cached public URL).
    await expect
      .poll(async () => objectExists(logoKey!), { timeout: 10_000 })
      .toBe(false);
  });

  test("(e) contributor → /admin, anon → /admin/login, and direct PostgREST writes on teams are denied", async ({
    page,
  }) => {
    // Anon (no session): /admin/teams redirects to the login page.
    await page.goto("/admin/teams");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("teams-admin")).toHaveCount(0);

    // Contributor: signs in, but is a non-editor → redirected off /admin/teams to /admin.
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");
    await page.goto("/admin/teams");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("teams-admin")).toHaveCount(0);

    // Create a real marker team (editor UI) to target with the denied writes.
    const context = page.context();
    const editorPage = await context.browser()!.newPage();
    await signIn(editorPage, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    const name = `${MARKER_PREFIX} E ${randomUUID()}`;
    const team = await createMarkerTeam(editorPage, name, { island: "st_thomas" });
    await editorPage.close();

    const token = await contributorAccessToken();

    // anon INSERT — no insert grant → denied.
    const anonInsert = await restTeams("POST", PUBLISHABLE_KEY as string, {
      name: `${MARKER_PREFIX} anon`,
      slug: `${MARKER_PREFIX}-anon-${randomUUID()}`,
      island: "st_thomas",
    });
    expect(denied(anonInsert), `anon INSERT denied (got ${anonInsert.status})`).toBe(true);

    // contributor INSERT — has grant but editor-only with_check → denied.
    const cInsert = await restTeams("POST", token, {
      name: `${MARKER_PREFIX} contrib`,
      slug: `${MARKER_PREFIX}-contrib-${randomUUID()}`,
      island: "st_thomas",
    });
    expect(denied(cInsert), `contributor INSERT denied (got ${cInsert.status})`).toBe(true);

    // contributor UPDATE of the real team — editor-only using/with_check → 0 rows.
    const cUpdate = await restTeams(
      "PATCH",
      token,
      { division: "hijacked" },
      `?id=eq.${team.id}`,
    );
    expect(denied(cUpdate), `contributor UPDATE denied (got ${cUpdate.status})`).toBe(true);

    // contributor DELETE of the real team — editor-only using → 0 rows.
    const cDelete = await restTeams("DELETE", token, null, `?id=eq.${team.id}`);
    expect(denied(cDelete), `contributor DELETE denied (got ${cDelete.status})`).toBe(true);

    // dcon: the target team is untouched (still present, division unchanged).
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teams")
      .select("id,division")
      .eq("id", team.id)
      .maybeSingle();
    if (error) throw error;
    expect(data, "target team survives the denied writes").not.toBeNull();
    expect((data as { division: string }).division, "division not hijacked").not.toBe(
      "hijacked",
    );
  });
});
