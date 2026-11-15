// Shared e2e fixtures for the softball/schedule S4 specs (schedule-e2e-001 … 006).
//
// Same conventions as tests/support/schedule-fixtures.ts (whose timezone + row conventions this
// reuses): names start "E2E ", slugs "e2e-", seeded in `beforeAll` with the service-role client,
// removed in `afterAll`, cleanup scoped to the EXACT slugs/emails below (never a wildcard), in
// FK-safe order:
//   game_player_stats → game_innings → games → calendar_events → tournaments → team_players → teams
//
// The scoring rows are DELIBERATELY a separate set from the S3 `e2e-cup` fixtures (own slugs,
// own teams): the S3 specs assert exact public rendering of their games, and the scoring specs
// mutate games. Sharing rows would let one suite's writes (or one suite's cleanup) break the
// other — including when two agents run different suites against the shared DB.
//
// Shape (tournament `e2e-scoring-cup`, America/El_Salvador):
//   today (venue-local)   Colombia @ Mexico  PREGAME   → list ordering (today first)
//   2099-04-01 09:00      Colombia @ Mexico  PREGAME   → guest game: scoreboard, undo, offline, final
//   2099-04-01 12:00      Colombia @ USVI    PREGAME   → USVI game: lineup + box score
// e2e-scoring-usvi has 2 ACTIVE players + 1 inactive.
//
// Users: one `scorekeeper` and one `contributor`, created through the sanctioned path
// (lib/admin-user provisionUser → auth.admin.createUser; lib/roles assignRoles), with a
// PER-RUN random password (never a known password on the shared/prod DB) and fixed e2e emails.
// They sign in through the REAL /admin/login form; no session is ever minted.

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionUser } from "@/lib/admin-user";
import { assignRoles } from "@/lib/roles";
import { SFX_TZ } from "./schedule-fixtures";
import { expect, test, type Locator, type Page } from "@playwright/test";

export const SCX_TZ = SFX_TZ; // America/El_Salvador, UTC−6, no DST

export const SCX_TOURNAMENT = {
  slug: "e2e-scoring-cup",
  name: "E2E Scoring Cup",
  nameEs: "Copa E2E de anotación",
} as const;

export const SCX_TEAMS = {
  usvi: {
    slug: "e2e-scoring-usvi",
    name: "E2E Scoring USVI",
    kind: "national",
    countryCode: "VI",
  },
  colombia: {
    slug: "e2e-scoring-colombia",
    name: "E2E Scoring Colombia",
    kind: "guest",
    countryCode: "CO",
  },
  mexico: {
    slug: "e2e-scoring-mexico",
    name: "E2E Scoring Mexico",
    kind: "guest",
    countryCode: "MX",
  },
} as const;

export type ScxTeamKey = keyof typeof SCX_TEAMS;

export const SCX_PLAYERS = {
  one: { name: "E2E Scorer One", num: 4, pos: "SS", active: true, sort: 10 },
  two: { name: "E2E Scorer Two", num: 12, pos: "P", active: true, sort: 20 },
  benched: { name: "E2E Scorer Inactive", num: 88, pos: "OF", active: false, sort: 30 },
} as const;

export type ScxPlayerKey = keyof typeof SCX_PLAYERS;

type ScxGameDef = {
  slug: string;
  away: ScxTeamKey;
  home: ScxTeamKey;
  // null → "now" at seed time (always today venue-local).
  startsAt: string | null;
  venue: string;
};

export const SCX_GAMES = {
  today: {
    slug: "e2e-scoring-today",
    away: "colombia",
    home: "mexico",
    startsAt: null,
    venue: "E2E Scoring Field",
  },
  guest: {
    slug: "e2e-scoring-colombia-vs-mexico-2099-04-01",
    away: "colombia",
    home: "mexico",
    startsAt: "2099-04-01T15:00:00Z", // 09:00 venue-local
    venue: "E2E Scoring Field",
  },
  usvi: {
    slug: "e2e-scoring-colombia-vs-us-virgin-islands-2099-04-01",
    away: "colombia",
    home: "usvi",
    startsAt: "2099-04-01T18:00:00Z", // 12:00 venue-local
    venue: "E2E Scoring Field",
  },
} as const satisfies Record<string, ScxGameDef>;

export type ScxGameKey = keyof typeof SCX_GAMES;

export const SCX_EVENT_SLUGS: readonly string[] = Object.values(SCX_GAMES).map((g) => g.slug);
export const SCX_TEAM_SLUGS: readonly string[] = Object.values(SCX_TEAMS).map((t) => t.slug);

export const SCX_USERS = {
  scorekeeper: {
    email: "e2e-scorekeeper@example.com",
    name: "E2E Scorekeeper",
    roles: ["scorekeeper"],
  },
  contributor: {
    email: "e2e-scoring-contributor@example.com",
    name: "E2E Scoring Contributor",
    roles: ["contributor"],
  },
} as const;

export type ScxUserKey = keyof typeof SCX_USERS;

export type ScoringFixtures = {
  tournamentId: string;
  teamIds: Record<ScxTeamKey, string>;
  playerIds: Record<ScxPlayerKey, string>;
  eventIds: Record<ScxGameKey, string>;
  gameIds: Record<ScxGameKey, string>;
  users: Record<ScxUserKey, { id: string; email: string; password: string }>;
};

// ── users ────────────────────────────────────────────────────────────────────────

async function findUserIdByEmail(email: string): Promise<string | null> {
  const db = createAdminClient();
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function deleteUserByEmail(email: string): Promise<void> {
  const id = await findUserIdByEmail(email);
  if (!id) return;
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) throw error;
}

// ── cleanup ──────────────────────────────────────────────────────────────────────

// Delete every scoring fixture row + the two e2e users. Exact slugs/emails only.
export async function cleanupScoringFixtures(): Promise<void> {
  const db = createAdminClient();

  const teams = await db.from("teams").select("id").in("slug", SCX_TEAM_SLUGS as string[]);
  if (teams.error) throw teams.error;
  const teamIds = (teams.data ?? []).map((r) => r.id as string);

  const events = await db
    .from("calendar_events")
    .select("id")
    .in("slug", SCX_EVENT_SLUGS as string[]);
  if (events.error) throw events.error;
  const eventIds = (events.data ?? []).map((r) => r.id as string);

  const gameIds = new Set<string>();
  if (eventIds.length) {
    const g = await db.from("games").select("id").in("event_id", eventIds);
    if (g.error) throw g.error;
    for (const r of g.data ?? []) gameIds.add(r.id as string);
  }
  if (teamIds.length) {
    const list = teamIds.join(",");
    const g = await db
      .from("games")
      .select("id")
      .or(`away_team_id.in.(${list}),home_team_id.in.(${list})`);
    if (g.error) throw g.error;
    for (const r of g.data ?? []) gameIds.add(r.id as string);
  }
  const games = [...gameIds];

  if (games.length) {
    const s = await db.from("game_player_stats").delete().in("game_id", games);
    if (s.error) throw s.error;
  }
  if (teamIds.length) {
    const s = await db.from("game_player_stats").delete().in("team_id", teamIds);
    if (s.error) throw s.error;
  }
  if (games.length) {
    const i = await db.from("game_innings").delete().in("game_id", games);
    if (i.error) throw i.error;
    const g = await db.from("games").delete().in("id", games);
    if (g.error) throw g.error;
  }
  if (eventIds.length) {
    const e = await db.from("calendar_events").delete().in("id", eventIds);
    if (e.error) throw e.error;
  }
  const t = await db.from("tournaments").delete().eq("slug", SCX_TOURNAMENT.slug);
  if (t.error) throw t.error;
  if (teamIds.length) {
    const p = await db.from("team_players").delete().in("team_id", teamIds);
    if (p.error) throw p.error;
    const tm = await db.from("teams").delete().in("id", teamIds);
    if (tm.error) throw tm.error;
  }

  for (const u of Object.values(SCX_USERS)) await deleteUserByEmail(u.email);
}

// ── seed ─────────────────────────────────────────────────────────────────────────

// (Re)create the full scoring fixture set + users. Idempotent: clears leftovers first.
export async function seedScoringFixtures(): Promise<ScoringFixtures> {
  await cleanupScoringFixtures();
  const db = createAdminClient();

  const tournament = await db
    .from("tournaments")
    .insert({
      name: SCX_TOURNAMENT.name,
      name_es: SCX_TOURNAMENT.nameEs,
      slug: SCX_TOURNAMENT.slug,
      description: "E2E scoring fixture tournament.",
      city: "E2E City",
      country_code: "SV",
      timezone: SCX_TZ,
      sort_order: 998,
    })
    .select("id")
    .single();
  if (tournament.error) throw tournament.error;
  const tournamentId = tournament.data.id as string;

  const teams = await db
    .from("teams")
    .insert(
      Object.values(SCX_TEAMS).map((t, i) => ({
        name: t.name,
        slug: t.slug,
        kind: t.kind,
        island: null,
        country_code: t.countryCode,
        division: "E2E U18 Women",
        description: "E2E scoring fixture team.",
        sort_order: 950 + i,
      })),
    )
    .select("id,slug");
  if (teams.error) throw teams.error;
  const teamIdBySlug = new Map(teams.data.map((r) => [r.slug as string, r.id as string]));
  const teamIds = Object.fromEntries(
    Object.entries(SCX_TEAMS).map(([k, t]) => [k, teamIdBySlug.get(t.slug)!]),
  ) as Record<ScxTeamKey, string>;

  const players = await db
    .from("team_players")
    .insert(
      Object.values(SCX_PLAYERS).map((p) => ({
        team_id: teamIds.usvi,
        name: p.name,
        jersey_number: p.num,
        position: p.pos,
        active: p.active,
        sort_order: p.sort,
      })),
    )
    .select("id,name");
  if (players.error) throw players.error;
  const playerIdByName = new Map(players.data.map((r) => [r.name as string, r.id as string]));
  const playerIds = Object.fromEntries(
    Object.entries(SCX_PLAYERS).map(([k, p]) => [k, playerIdByName.get(p.name)!]),
  ) as Record<ScxPlayerKey, string>;

  const nowIso = new Date().toISOString();
  const events = await db
    .from("calendar_events")
    .insert(
      Object.values(SCX_GAMES).map((g, i) => ({
        tournament_id: tournamentId,
        type: "game",
        slug: g.slug,
        title: "",
        title_es: "",
        starts_at: g.startsAt ?? nowIso,
        venue: g.venue,
        round: "opening_round",
        status: "scheduled",
        stream_url: null,
        sort_order: 10 * (i + 1),
      })),
    )
    .select("id,slug");
  if (events.error) throw events.error;
  const eventIdBySlug = new Map(events.data.map((r) => [r.slug as string, r.id as string]));
  const eventIds = Object.fromEntries(
    Object.entries(SCX_GAMES).map(([k, g]) => [k, eventIdBySlug.get(g.slug)!]),
  ) as Record<ScxGameKey, string>;

  const gameIds = {} as Record<ScxGameKey, string>;
  for (const [key, g] of Object.entries(SCX_GAMES) as [ScxGameKey, ScxGameDef][]) {
    const game = await db
      .from("games")
      .insert({
        event_id: eventIds[key],
        away_team_id: teamIds[g.away],
        home_team_id: teamIds[g.home],
        state: "pregame",
        current_inning: null,
      })
      .select("id")
      .single();
    if (game.error) throw game.error;
    gameIds[key] = game.data.id as string;
  }

  const users = {} as ScoringFixtures["users"];
  for (const [key, u] of Object.entries(SCX_USERS) as [ScxUserKey, (typeof SCX_USERS)[ScxUserKey]][]) {
    const password = `E2e-${randomUUID()}`;
    const { userId } = await provisionUser({ email: u.email, password, name: u.name });
    await assignRoles({ userId, name: u.name, roles: [...u.roles] });
    users[key] = { id: userId, email: u.email, password };
  }

  return { tournamentId, teamIds, playerIds, eventIds, gameIds, users };
}

// Put one game back to a clean pregame: no innings, no stat lines, zero H/E. Mutating specs
// call this in beforeEach so every test (and each project) starts from the same state.
export async function resetScoringGame(gameId: string): Promise<void> {
  const db = createAdminClient();
  const s = await db.from("game_player_stats").delete().eq("game_id", gameId);
  if (s.error) throw s.error;
  const i = await db.from("game_innings").delete().eq("game_id", gameId);
  if (i.error) throw i.error;
  const g = await db
    .from("games")
    .update({
      state: "pregame",
      current_inning: null,
      away_hits: 0,
      away_errors: 0,
      home_hits: 0,
      home_errors: 0,
    })
    .eq("id", gameId);
  if (g.error) throw g.error;
}

// ── browser helpers ──────────────────────────────────────────────────────────────

// Drive the REAL sign-in form (init-e2e-003/004 shape). The login action lands on /admin; a
// scorekeeper-only user is then redirected on to /admin/scoring (overview §6.1), so the
// caller passes the expected landing URL.
export async function signIn(
  page: Page,
  user: { email: string; password: string },
  landing: RegExp,
): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(user.email);
  await page.getByTestId("admin-login-password").fill(user.password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(landing);
}

// Wait until every queued tap has been acknowledged by the server.
export async function expectSaved(page: Page, timeout = 15_000): Promise<void> {
  const pill = page.getByTestId("scoring-sync-status");
  await expect(pill).toHaveAttribute("data-state", "saved", { timeout });
  await expect(pill).toContainText("Saved");
}

// Open the scoring screen for a fixture game and wait for it to be idle.
export async function openScoringGame(page: Page, key: ScxGameKey): Promise<void> {
  await page.goto(`/admin/scoring/${SCX_GAMES[key].slug}`);
  await expect(page.getByTestId("scoring-tab-scoreboard")).toBeVisible();
  await expectSaved(page);
}

// The public event page is server-rendered; re-load until `check` passes (the scoring write
// has been revalidated). Never asserts on the scoring screen's optimistic state.
export async function expectPublicEvent(
  page: Page,
  key: ScxGameKey,
  check: (detail: Locator) => Promise<void>,
  timeout = 20_000,
): Promise<void> {
  if (!EVENTS_ON) {
    test.info().annotations.push({
      type: "skipped-public-check",
      description: `NEXT_PUBLIC_EVENTS_ENABLED is not "true"; /events/${SCX_GAMES[key].slug} not asserted`,
    });
    return;
  }
  await expect(async () => {
    await page.goto(`/events/${SCX_GAMES[key].slug}`);
    const detail = page.getByTestId("event-detail");
    await expect(detail).toBeVisible({ timeout: 5_000 });
    await check(detail);
  }).toPass({ timeout });
}

// The public schedule pages are behind NEXT_PUBLIC_EVENTS_ENABLED (see schedule-web-0xx). The
// scoring screens are not. When the flag is off, specs still verify persistence by reloading
// the scoring screen and record an annotation instead of the public-page check.
export const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
