/*
---
id: teams-e2e-004
name: "teams-e2e-004: Team roster (player) admin CRUD; photo lifecycle, reap, authz + RLS"
feature: softball/teams
stack: web
priority: P1
group: A
references:
  - app/admin/(protected)/teams/page.tsx (editor-gated /admin/teams; each row's manage-roster-link)
  - app/admin/(protected)/teams/[slug]/page.tsx (roster-admin; requireRole('editor'); notFound)
  - app/admin/(protected)/teams/[slug]/actions.ts (create/update/deletePlayerAction; photo reap)
  - components/client/player-form.tsx (add/edit form; pl-* fields; photo upload block)
  - components/client/player-delete-button.tsx (pl-delete)
  - lib/teams.ts (createTeamPlayer/updateTeamPlayer/deleteTeamPlayer; getTeamPlayerPhotoUrl)
  - lib/board-photos.ts (uploadBoardPhoto: declared-type + magic-byte validation; reap by URL)
  - components/ui/team-roster.tsx (public /teams/[slug]: team-roster, team-roster-row, player-*)
  - supabase/migrations/0014_team_players.sql (team_players; FK cascade; 17 seeded across 5 teams)
  - supabase/migrations/0016_team_players_admin.sql (editor-only team_players write RLS)
  - supabase/migrations/0009_board_photos_storage.sql (board-photos bucket, editor-only write)
---

The roster (player) admin-CRUD slice against the seeded team `cruz-bay-waves` (3 seeded players).
Every write goes through the real editor session; the RLS on team_players is the boundary. Only
MARKER-named players are ever created/edited/deleted — the 3 seeded Cruz Bay players are untouched.

(a) From /admin/teams the Cruz Bay Waves row exposes a manage-roster-link → /admin/teams/
    cruz-bay-waves; navigating there shows roster-admin.
(b) An EDITOR adds a player (marker name, #99, position P, uploaded PNG). It persists (service
    read: jersey_number=99, photo_url is a board-photos URL, object EXISTS via LIST api) and
    renders on /teams/cruz-bay-waves as a team-roster-row with a player-photo avatar img.
(c) Editing the player (position → SS) persists (service read + public detail).
(d) A magic-byte-SPOOFED photo upload is rejected with pl-add-error, creates NO player and —
    validation runs BEFORE upload — leaves NO new Storage object.
(e) Deleting the player removes it from /teams/cruz-bay-waves and reaps its photo object (GONE
    via LIST api); the 3 seeded Cruz Bay players remain.
(f) A CONTRIBUTOR is redirected /admin/teams/cruz-bay-waves → /admin; ANON → /admin/login; a
    direct PostgREST INSERT/UPDATE/DELETE on `team_players` with the contributor JWT / anon key
    is denied (RLS).

MANDATORY TEARDOWN (shared prod DB + Storage): every player uses a unique marker name. afterAll
(service key) collects each marker player's photo object, DELETEs the marker players, removes the
collected board-photos objects, then asserts: 0 marker players, team_players back to 17 seeded
rows, and none of the collected objects remain (LIST api). Desktop-gated. The service-key admin
client is teardown + out-of-band verification ONLY — every app write goes through the editor.
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

const MARKER_PREFIX = "e2e-004-marker";
const TEAM_SLUG = "cruz-bay-waves";
const SEEDED_PLAYER_TOTAL = 17; // across all 5 teams
const SEEDED_CRUZ_BAY_TOTAL = 3; // must survive untouched
const PHOTO_PUBLIC_BASE = `${(SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${BOARD_PHOTOS_BUCKET}/`;

// A minimal but genuine 1x1 PNG (correct magic bytes) — passes the magic-byte sniff.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function pngUpload() {
  return { name: "p.png", mimeType: "image/png", buffer: PNG_BYTES };
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

type PlayerRow = {
  id: string;
  name: string;
  jersey_number: number | null;
  position: string;
  photo_url: string | null;
  team_id: string;
};

async function readMarkerPlayers(): Promise<PlayerRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_players")
    .select("id,name,jersey_number,position,photo_url,team_id")
    .like("name", `${MARKER_PREFIX}%`);
  if (error) throw error;
  return (data as PlayerRow[] | null) ?? [];
}

async function cruzBayTeamId(): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .select("id")
    .eq("slug", TEAM_SLUG)
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// Collect each marker player's photo object, DELETE the marker players, then remove the collected
// objects. Returns the reaped keys (for post-teardown GONE assertions).
async function deleteMarkerData(): Promise<string[]> {
  const admin = createAdminClient();
  const players = await readMarkerPlayers();
  const keys = new Set<string>();
  for (const p of players) {
    const k = keyFromPhotoUrl(p.photo_url);
    if (k) keys.add(k);
  }
  const { error } = await admin
    .from("team_players")
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

async function restPlayers(
  method: "POST" | "PATCH" | "DELETE",
  bearer: string,
  body: Record<string, unknown> | null,
  query = "",
): Promise<{ status: number; rows: unknown[] | null }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_players${query}`, {
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

// Navigate from /admin/teams via the Cruz Bay row's manage-roster-link into the roster editor.
async function openCruzBayRoster(page: Page): Promise<void> {
  await page.goto("/admin/teams");
  await expect(page.getByTestId("teams-admin")).toBeVisible();
  const cruz = page.locator('[data-testid="team-admin-item"]', {
    hasText: "Cruz Bay Waves",
  });
  const link = cruz.getByTestId("manage-roster-link");
  await expect(link).toHaveAttribute("href", `/admin/teams/${TEAM_SLUG}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/admin/teams/${TEAM_SLUG}$`));
  await expect(page.getByTestId("roster-admin")).toBeVisible();
}

// Add a marker player through the real editor add form, then poll the service read for its row.
async function addMarkerPlayer(
  page: Page,
  name: string,
  opts: { number: number; position: string; withPhoto?: boolean },
): Promise<PlayerRow> {
  const form = page.getByTestId("pl-add-form");
  await form.getByTestId("pl-name").fill(name);
  await form.getByTestId("pl-number").fill(String(opts.number));
  await form.getByTestId("pl-position").fill(opts.position);
  if (opts.withPhoto) await form.getByTestId("pl-photo-file").setInputFiles(pngUpload());
  await page.getByTestId("pl-add").click();

  await expect(
    page.locator('[data-testid="player-admin-item"]', { hasText: name }),
  ).toBeVisible();

  let row: PlayerRow | undefined;
  await expect
    .poll(async () => {
      row = (await readMarkerPlayers()).find((p) => p.name === name);
      return row?.id ?? null;
    }, { timeout: 10_000 })
    .not.toBeNull();
  return row!;
}

test.describe("teams-e2e-004 — roster (player) admin CRUD + photo reap + authz (desktop)", () => {
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
      .from("team_players")
      .select("*", { count: "exact", head: true })
      .like("name", `${MARKER_PREFIX}%`);
    if (mErr) throw mErr;
    expect(markerLeft, "TEARDOWN: no marker players may remain").toBe(0);

    const { count: playersTotal, error: pErr } = await admin
      .from("team_players")
      .select("*", { count: "exact", head: true });
    if (pErr) throw pErr;
    expect(playersTotal, "TEARDOWN: team_players back to 17 seeded rows").toBe(
      SEEDED_PLAYER_TOTAL,
    );

    const teamId = await cruzBayTeamId();
    const { count: cruzTotal, error: cErr } = await admin
      .from("team_players")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);
    if (cErr) throw cErr;
    expect(cruzTotal, "TEARDOWN: 3 seeded Cruz Bay players remain").toBe(
      SEEDED_CRUZ_BAY_TOTAL,
    );

    for (const key of reapedKeys) {
      expect(
        await objectExists(key),
        `TEARDOWN: marker Storage object ${key} must be gone`,
      ).toBe(false);
    }
  });

  test("(a→c,e) manage-roster link → add w/ PNG → persists+renders → edit position → delete reaps photo", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} A ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");

    // (a) reach the roster editor via the Cruz Bay row's manage-roster-link.
    await openCruzBayRoster(page);

    // (b) add a player (marker, #99, position P, uploaded PNG).
    const created = await addMarkerPlayer(page, name, {
      number: 99,
      position: "P",
      withPhoto: true,
    });

    // THEN (b): persisted with #99 and a board-photos photo_url whose object EXISTS.
    expect(created.jersey_number, "jersey_number persisted as 99").toBe(99);
    const photoKey = keyFromPhotoUrl(created.photo_url);
    expect(photoKey, "photo_url points at a board-photos object").not.toBeNull();
    expect(await objectExists(photoKey!), "uploaded photo object exists").toBe(true);

    // …and it renders on the public detail as a team-roster-row with a player-photo avatar.
    await page.goto(`/teams/${TEAM_SLUG}`);
    const row = page.locator('[data-testid="team-roster-row"]', { hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("player-photo")).toBeVisible();

    // (c) edit the player's position → SS.
    await openCruzBayRoster(page);
    const item = page.locator('[data-testid="player-admin-item"]', { hasText: name });
    const editForm = item.getByTestId("pl-edit-form");
    await editForm.getByTestId("pl-position").fill("SS");
    await item.getByTestId("pl-save").click();

    // THEN (c): the position change persists (service read) and shows on the public detail.
    await expect
      .poll(async () => (await readMarkerPlayers()).find((p) => p.name === name)?.position, {
        timeout: 10_000,
      })
      .toBe("SS");
    await page.goto(`/teams/${TEAM_SLUG}`);
    const editedRow = page.locator('[data-testid="team-roster-row"]', { hasText: name });
    await expect(editedRow.getByTestId("player-position")).toHaveText("SS");

    // (e) delete the player.
    await openCruzBayRoster(page);
    const delItem = page.locator('[data-testid="player-admin-item"]', { hasText: name });
    await delItem.getByTestId("pl-delete").click();
    await expect(delItem).toHaveCount(0);

    // THEN (e): gone from the public roster…
    await page.goto(`/teams/${TEAM_SLUG}`);
    await expect(
      page.locator('[data-testid="team-roster-row"]', { hasText: name }),
    ).toHaveCount(0);

    // …the row is gone…
    await expect
      .poll(async () => (await readMarkerPlayers()).some((p) => p.name === name), {
        timeout: 10_000,
      })
      .toBe(false);

    // …and its photo Storage object was reaped (LIST api, not the cached public URL).
    await expect
      .poll(async () => objectExists(photoKey!), { timeout: 10_000 })
      .toBe(false);

    // …while the 3 seeded Cruz Bay players survive untouched.
    const teamId = created.team_id;
    const admin = createAdminClient();
    const { count: cruzTotal, error: cErr } = await admin
      .from("team_players")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId);
    if (cErr) throw cErr;
    expect(cruzTotal, "3 seeded Cruz Bay players remain after delete").toBe(
      SEEDED_CRUZ_BAY_TOTAL,
    );
  });

  test("(d) a magic-byte-spoofed photo upload is rejected: pl-add-error, no player, no object", async ({
    page,
  }) => {
    const name = `${MARKER_PREFIX} D ${randomUUID()}`;

    await signIn(page, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await openCruzBayRoster(page);

    const form = page.getByTestId("pl-add-form");
    await form.getByTestId("pl-name").fill(name);
    await form.getByTestId("pl-number").fill("77");
    await form.getByTestId("pl-position").fill("P");
    // Content-type image/png but non-PNG bytes — fails the magic-byte sniff.
    await form.getByTestId("pl-photo-file").setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg/> not really a png"),
    });
    await page.getByTestId("pl-add").click();

    // THEN: a form error, and NO player row created (validation runs BEFORE upload, so no
    // object is ever written — there is no key to have leaked).
    await expect(form.getByTestId("pl-add-error")).toBeVisible();
    expect(
      (await readMarkerPlayers()).some((p) => p.name === name),
      "rejected upload creates no player row",
    ).toBe(false);
    await expect(
      page.locator('[data-testid="player-admin-item"]', { hasText: name }),
    ).toHaveCount(0);
  });

  test("(f) contributor → /admin, anon → /admin/login, and direct PostgREST writes on team_players are denied", async ({
    page,
  }) => {
    // Anon (no session): /admin/teams/[slug] redirects to the login page.
    await page.goto(`/admin/teams/${TEAM_SLUG}`);
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByTestId("roster-admin")).toHaveCount(0);

    // Contributor: signs in, but is a non-editor → redirected off the roster editor to /admin.
    await signIn(page, CONTRIBUTOR_EMAIL, CONTRIBUTOR_PASSWORD, "contributor");
    await page.goto(`/admin/teams/${TEAM_SLUG}`);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("roster-admin")).toHaveCount(0);

    // Create a real marker player (editor UI) to target with the denied UPDATE/DELETE.
    const context = page.context();
    const editorPage = await context.browser()!.newPage();
    await signIn(editorPage, EDITOR_EMAIL, EDITOR_PASSWORD, "editor");
    await openCruzBayRoster(editorPage);
    const name = `${MARKER_PREFIX} F ${randomUUID()}`;
    const player = await addMarkerPlayer(editorPage, name, { number: 88, position: "C" });
    await editorPage.close();

    const teamId = await cruzBayTeamId();
    const token = await contributorAccessToken();

    // anon INSERT — no insert grant → denied.
    const anonInsert = await restPlayers("POST", PUBLISHABLE_KEY as string, {
      team_id: teamId,
      name: `${MARKER_PREFIX} anon`,
      jersey_number: 1,
      sort_order: 999,
    });
    expect(denied(anonInsert), `anon INSERT denied (got ${anonInsert.status})`).toBe(true);

    // contributor INSERT — has grant but editor-only with_check → denied.
    const cInsert = await restPlayers("POST", token, {
      team_id: teamId,
      name: `${MARKER_PREFIX} contrib`,
      jersey_number: 2,
      sort_order: 999,
    });
    expect(denied(cInsert), `contributor INSERT denied (got ${cInsert.status})`).toBe(true);

    // contributor UPDATE of the real player — editor-only using/with_check → 0 rows.
    const cUpdate = await restPlayers(
      "PATCH",
      token,
      { position: "hijacked" },
      `?id=eq.${player.id}`,
    );
    expect(denied(cUpdate), `contributor UPDATE denied (got ${cUpdate.status})`).toBe(true);

    // contributor DELETE of the real player — editor-only using → 0 rows.
    const cDelete = await restPlayers("DELETE", token, null, `?id=eq.${player.id}`);
    expect(denied(cDelete), `contributor DELETE denied (got ${cDelete.status})`).toBe(true);

    // dcon: the target player is untouched (still present, position unchanged).
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("team_players")
      .select("id,position")
      .eq("id", player.id)
      .maybeSingle();
    if (error) throw error;
    expect(data, "target player survives the denied writes").not.toBeNull();
    expect((data as { position: string }).position, "position not hijacked").not.toBe(
      "hijacked",
    );
  });
});
