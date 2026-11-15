// Shared e2e fixtures for the softball/schedule S3 specs (schedule-web-010 … 020).
//
// Same conventions as tests/support/sports-fixtures.ts: every row is clearly marked (names
// start "E2E ", slugs "e2e-"), it is seeded in `beforeAll` with the service-role client and
// removed in `afterAll`, and cleanup touches ONLY the exact fixture slugs listed here (never a
// wildcard), in FK-safe order:
//   game_player_stats → game_innings → games → calendar_events → tournaments → team_players → teams
// (0026 FKs are `on delete restrict`, so the order matters; team_players cascade from teams is
// not relied on because stat lines restrict it).
//
// Shape (overview §5, scenarios S3): one tournament `e2e-cup` (America/El_Salvador, UTC−6) with
// five events in 2099 across two venue-local days and two venues:
//
//   2099-03-14  E2E Field Alpha  18:30  Opening Ceremony                    (ceremony)
//   2099-03-14  E2E Field Alpha  19:00  Colombia @ Mexico     FINAL 3–1      (away wins)
//   2099-03-15  E2E Field Alpha  09:00  Colombia @ USVI       PREGAME        (USVI, roster, stream)
//   2099-03-15  E2E Field Bravo  12:00  USVI-empty @ Mexico  PREGAME        (USVI, roster TBA)
//   2099-03-15  E2E Field Bravo  15:00  USVI @ Mexico        FINAL 4–2      (USVI, box score)
//
// The ceremony and the CO–MX final start on 2099-03-15 in UTC but on 2099-03-14 venue-local —
// they prove day grouping uses the tournament timezone, not UTC.
//
// Real Pan Am rows share these tables and also render on /events; specs scope every
// assertion to fixture rows (data-slug in FX_EVENT_SLUGS).

import { createAdminClient } from "@/lib/supabase/admin";
import type { GameState, Side } from "@/lib/schedule-view";

export const SFX_TZ = "America/El_Salvador";

export const SFX_TOURNAMENT = {
  slug: "e2e-cup",
  name: "E2E Cup",
  nameEs: "Copa E2E",
  city: "E2E City",
  countryCode: "SV",
  timezone: SFX_TZ,
} as const;

export const SFX_VENUES = {
  alpha: "E2E Field Alpha",
  bravo: "E2E Field Bravo",
} as const;

type FxTeam = {
  slug: string;
  name: string;
  kind: "national" | "guest";
  countryCode: string;
  division: string;
};

export const SFX_TEAMS = {
  usvi: {
    slug: "e2e-usvi",
    name: "E2E USVI U18 Women",
    kind: "national",
    countryCode: "VI",
    division: "E2E U18 Women",
  },
  usviEmpty: {
    slug: "e2e-usvi-empty",
    name: "E2E USVI Empty",
    kind: "national",
    countryCode: "VI",
    division: "E2E U18 Women",
  },
  colombia: {
    slug: "e2e-colombia",
    name: "E2E Colombia U18 Women",
    kind: "guest",
    countryCode: "CO",
    division: "E2E U18 Women",
  },
  mexico: {
    slug: "e2e-mexico",
    name: "E2E Mexico U18 Women",
    kind: "guest",
    countryCode: "MX",
    division: "E2E U18 Women",
  },
} as const satisfies Record<string, FxTeam>;

export type SfxTeamKey = keyof typeof SFX_TEAMS;

type FxPlayer = {
  team: SfxTeamKey;
  name: string;
  num: number;
  pos: string;
  active: boolean;
  sort: number;
};

// e2e-usvi: 2 active + 1 inactive. e2e-usvi-empty: none (→ "Roster to be announced").
export const SFX_PLAYERS = {
  one: { team: "usvi", name: "E2E Player One", num: 7, pos: "SS", active: true, sort: 10 },
  two: { team: "usvi", name: "E2E Player Two", num: 21, pos: "P", active: true, sort: 20 },
  benched: { team: "usvi", name: "E2E Player Inactive", num: 99, pos: "OF", active: false, sort: 30 },
} as const satisfies Record<string, FxPlayer>;

export type SfxPlayerKey = keyof typeof SFX_PLAYERS;

type FxInning = { inning: number; side: Side; runs: number };

type FxGame = {
  away: SfxTeamKey;
  home: SfxTeamKey;
  state: GameState;
  currentInning: number | null;
  awayHits: number;
  awayErrors: number;
  homeHits: number;
  homeErrors: number;
  innings: readonly FxInning[];
};

type FxEvent = {
  slug: string;
  type: "game" | "ceremony";
  title: string;
  titleEs: string;
  startsAt: string; // ISO UTC
  localDate: string; // venue-local YYYY-MM-DD (the events-day data-date)
  venue: string;
  streamUrl: string | null;
  sortOrder: number;
  usvi: boolean;
  game: FxGame | null;
};

export const SFX_EVENTS = {
  ceremony: {
    slug: "e2e-cup-opening-ceremony",
    type: "ceremony",
    title: "E2E Opening Ceremony",
    titleEs: "E2E Ceremonia de inauguración",
    startsAt: "2099-03-15T00:30:00Z", // 18:30 local on 03-14
    localDate: "2099-03-14",
    venue: SFX_VENUES.alpha,
    streamUrl: null,
    sortOrder: 10,
    usvi: false,
    game: null,
  },
  finalCoMx: {
    slug: "e2e-colombia-vs-mexico-2099-03-14",
    type: "game",
    title: "",
    titleEs: "",
    startsAt: "2099-03-15T01:00:00Z", // 19:00 local on 03-14
    localDate: "2099-03-14",
    venue: SFX_VENUES.alpha,
    streamUrl: null,
    sortOrder: 20,
    usvi: false,
    game: {
      away: "colombia",
      home: "mexico",
      state: "final",
      currentInning: 7,
      awayHits: 6,
      awayErrors: 1,
      homeHits: 4,
      homeErrors: 2,
      // away R = 3, home R = 1 → away wins
      innings: [
        { inning: 1, side: "away", runs: 2 },
        { inning: 1, side: "home", runs: 0 },
        { inning: 2, side: "away", runs: 0 },
        { inning: 2, side: "home", runs: 1 },
        { inning: 3, side: "away", runs: 1 },
        { inning: 3, side: "home", runs: 0 },
      ],
    },
  },
  usviPregame: {
    slug: "e2e-colombia-vs-us-virgin-islands-2099-03-15",
    type: "game",
    title: "",
    titleEs: "",
    startsAt: "2099-03-15T15:00:00Z", // 09:00 local, 11:00 AM Atlantic
    localDate: "2099-03-15",
    venue: SFX_VENUES.alpha,
    streamUrl: "https://example.com/e2e-stream",
    sortOrder: 10,
    usvi: true,
    game: {
      away: "colombia",
      home: "usvi",
      state: "pregame",
      currentInning: null,
      awayHits: 0,
      awayErrors: 0,
      homeHits: 0,
      homeErrors: 0,
      innings: [],
    },
  },
  usviEmpty: {
    slug: "e2e-us-virgin-islands-vs-mexico-2099-03-15-a",
    type: "game",
    title: "",
    titleEs: "",
    startsAt: "2099-03-15T18:00:00Z", // 12:00 local
    localDate: "2099-03-15",
    venue: SFX_VENUES.bravo,
    streamUrl: null,
    sortOrder: 10,
    usvi: true,
    game: {
      away: "usviEmpty",
      home: "mexico",
      state: "pregame",
      currentInning: null,
      awayHits: 0,
      awayErrors: 0,
      homeHits: 0,
      homeErrors: 0,
      innings: [],
    },
  },
  usviFinal: {
    slug: "e2e-us-virgin-islands-vs-mexico-2099-03-15-b",
    type: "game",
    title: "",
    titleEs: "",
    startsAt: "2099-03-15T21:00:00Z", // 15:00 local
    localDate: "2099-03-15",
    venue: SFX_VENUES.bravo,
    streamUrl: null,
    sortOrder: 20,
    usvi: true,
    game: {
      away: "usvi",
      home: "mexico",
      state: "final",
      currentInning: 7,
      awayHits: 7,
      awayErrors: 0,
      homeHits: 5,
      homeErrors: 1,
      // away R = 4, home R = 2
      innings: [
        { inning: 1, side: "away", runs: 3 },
        { inning: 1, side: "home", runs: 2 },
        { inning: 2, side: "away", runs: 1 },
        { inning: 2, side: "home", runs: 0 },
      ],
    },
  },
} as const satisfies Record<string, FxEvent>;

export type SfxEventKey = keyof typeof SFX_EVENTS;

// The single USVI stat line (box score) — Player One in the USVI final.
export const SFX_STAT_LINE = {
  event: "usviFinal" as SfxEventKey,
  player: "one" as SfxPlayerKey,
  ab: 3,
  r: 1,
  h: 2,
  rbi: 2,
  bb: 1,
  so: 0,
};

export const SFX_EVENT_SLUGS: readonly string[] = Object.values(SFX_EVENTS).map((e) => e.slug);
export const SFX_USVI_EVENT_SLUGS: readonly string[] = Object.values(SFX_EVENTS)
  .filter((e) => e.usvi)
  .map((e) => e.slug);
export const SFX_TEAM_SLUGS: readonly string[] = Object.values(SFX_TEAMS).map((t) => t.slug);

// Delete every schedule fixture row, children first. Scoped to the exact fixture slugs —
// never a wildcard — so real rows and other suites' fixtures are untouched.
export async function cleanupScheduleFixtures(): Promise<void> {
  const db = createAdminClient();

  const teams = await db.from("teams").select("id").in("slug", SFX_TEAM_SLUGS as string[]);
  if (teams.error) throw teams.error;
  const teamIds = (teams.data ?? []).map((r) => r.id as string);

  const events = await db
    .from("calendar_events")
    .select("id")
    .in("slug", SFX_EVENT_SLUGS as string[]);
  if (events.error) throw events.error;
  const eventIds = (events.data ?? []).map((r) => r.id as string);

  // Games attached to a fixture event OR played by a fixture team.
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
  const t = await db.from("tournaments").delete().eq("slug", SFX_TOURNAMENT.slug);
  if (t.error) throw t.error;
  if (teamIds.length) {
    const p = await db.from("team_players").delete().in("team_id", teamIds);
    if (p.error) throw p.error;
    const tm = await db.from("teams").delete().in("id", teamIds);
    if (tm.error) throw tm.error;
  }
}

export type ScheduleFixtureIds = {
  tournamentId: string;
  teamIds: Record<SfxTeamKey, string>;
  playerIds: Record<SfxPlayerKey, string>;
  eventIds: Record<SfxEventKey, string>;
  gameIds: Partial<Record<SfxEventKey, string>>;
};

// (Re)create the full schedule fixture set. Idempotent: clears leftovers from an aborted run
// first.
export async function seedScheduleFixtures(): Promise<ScheduleFixtureIds> {
  await cleanupScheduleFixtures();
  const db = createAdminClient();

  const tournament = await db
    .from("tournaments")
    .insert({
      name: SFX_TOURNAMENT.name,
      name_es: SFX_TOURNAMENT.nameEs,
      slug: SFX_TOURNAMENT.slug,
      description: "E2E fixture tournament.",
      city: SFX_TOURNAMENT.city,
      country_code: SFX_TOURNAMENT.countryCode,
      timezone: SFX_TOURNAMENT.timezone,
      sort_order: 999,
    })
    .select("id")
    .single();
  if (tournament.error) throw tournament.error;
  const tournamentId = tournament.data.id as string;

  const teams = await db
    .from("teams")
    .insert(
      Object.values(SFX_TEAMS).map((t, i) => ({
        name: t.name,
        slug: t.slug,
        kind: t.kind,
        island: null,
        country_code: t.countryCode,
        division: t.division,
        description: "E2E fixture team.",
        sort_order: 900 + i,
      })),
    )
    .select("id,slug");
  if (teams.error) throw teams.error;
  const teamIdBySlug = new Map(teams.data.map((r) => [r.slug as string, r.id as string]));
  const teamIds = Object.fromEntries(
    Object.entries(SFX_TEAMS).map(([k, t]) => [k, teamIdBySlug.get(t.slug)!]),
  ) as Record<SfxTeamKey, string>;

  const players = await db
    .from("team_players")
    .insert(
      Object.values(SFX_PLAYERS).map((p) => ({
        team_id: teamIds[p.team],
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
    Object.entries(SFX_PLAYERS).map(([k, p]) => [k, playerIdByName.get(p.name)!]),
  ) as Record<SfxPlayerKey, string>;

  const events = await db
    .from("calendar_events")
    .insert(
      Object.values(SFX_EVENTS).map((e) => ({
        tournament_id: tournamentId,
        type: e.type,
        slug: e.slug,
        title: e.title,
        title_es: e.titleEs,
        starts_at: e.startsAt,
        venue: e.venue,
        round: "opening_round",
        status: "scheduled",
        stream_url: e.streamUrl,
        sort_order: e.sortOrder,
      })),
    )
    .select("id,slug");
  if (events.error) throw events.error;
  const eventIdBySlug = new Map(events.data.map((r) => [r.slug as string, r.id as string]));
  const eventIds = Object.fromEntries(
    Object.entries(SFX_EVENTS).map(([k, e]) => [k, eventIdBySlug.get(e.slug)!]),
  ) as Record<SfxEventKey, string>;

  const gameIds: Partial<Record<SfxEventKey, string>> = {};
  for (const [key, e] of Object.entries(SFX_EVENTS) as [SfxEventKey, FxEvent][]) {
    if (!e.game) continue;
    const g = e.game;
    const game = await db
      .from("games")
      .insert({
        event_id: eventIds[key],
        away_team_id: teamIds[g.away],
        home_team_id: teamIds[g.home],
        state: g.state,
        current_inning: g.currentInning,
        away_hits: g.awayHits,
        away_errors: g.awayErrors,
        home_hits: g.homeHits,
        home_errors: g.homeErrors,
      })
      .select("id")
      .single();
    if (game.error) throw game.error;
    const gameId = game.data.id as string;
    gameIds[key] = gameId;
    if (g.innings.length) {
      const inn = await db
        .from("game_innings")
        .insert(g.innings.map((c) => ({ game_id: gameId, ...c })));
      if (inn.error) throw inn.error;
    }
  }

  const line = SFX_STAT_LINE;
  const player = SFX_PLAYERS[line.player];
  const stat = await db.from("game_player_stats").insert({
    game_id: gameIds[line.event],
    player_id: playerIds[line.player],
    team_id: teamIds[player.team],
    ab: line.ab,
    r: line.r,
    h: line.h,
    rbi: line.rbi,
    bb: line.bb,
    so: line.so,
  });
  if (stat.error) throw stat.error;

  return { tournamentId, teamIds, playerIds, eventIds, gameIds };
}
