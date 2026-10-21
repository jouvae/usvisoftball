// Shared e2e fixtures for the teams + events specs (home-layout slice 5b).
//
// The teams/events specs used to read the SAMPLE rows seeded by migrations 0013/0014/0017/
// 0019. Those samples are gone from the shared DB (= prod) — real national teams and real
// events live there now — so each spec seeds THESE fixtures in `beforeAll` and removes them
// in `afterAll`. Every fixture is clearly marked: names start with "E2E ", slugs with
// "e2e-", and cleanup deletes ONLY those slugs (team_players and event_teams cascade). Real
// rows are never touched, and specs scope their assertions to fixture rows (FX_* below) so
// real data can't change a result.
//
// Fixture content mirrors the retired samples (same shapes, dates, rosters, links) so the
// scenarios keep their meaning. Writes use the service-role client (tests only — the
// `server-only` fence is aliased to a no-op by tests/tsconfig.json).
//
// ⚠️ Fixtures are briefly visible on the public site while a spec runs, if the Teams/Events
// flags are on for the DB the run targets. The real fix is a non-prod Supabase project
// for e2e (see docs/features/softball/redesign/status.md, "Test-suite hazard").

import { createAdminClient } from "@/lib/supabase/admin";
import type { Island } from "@/lib/teams-view";

export const FX_PREFIX = "e2e-";
export const FX_NAME_PREFIX = "E2E ";

type FxTeam = {
  slug: string;
  name: string;
  island: Island;
  division: string;
  description: string;
  homeVenue: string;
  foundedYear: number;
  sortOrder: number;
};

export const FX_TEAMS = {
  frenchtown: {
    slug: "e2e-frenchtown-sluggers",
    name: "E2E Frenchtown Sluggers",
    island: "st_thomas",
    division: "Men's",
    description: "A St. Thomas men's club competing in the territorial fast-pitch league.",
    homeVenue: "Lionel Roberts Stadium",
    foundedYear: 1998,
    sortOrder: 10,
  },
  storm: {
    slug: "e2e-charlotte-amalie-storm",
    name: "E2E Charlotte Amalie Storm",
    island: "st_thomas",
    division: "Women's",
    description: "St. Thomas women's softball, three-time territorial finalists.",
    homeVenue: "Lionel Roberts Stadium",
    foundedYear: 2005,
    sortOrder: 20,
  },
  cruzBay: {
    slug: "e2e-cruz-bay-waves",
    name: "E2E Cruz Bay Waves",
    island: "st_john",
    division: "Coed",
    description: "St. John's community coed club, playing out of Cruz Bay.",
    homeVenue: "Winston Wells Ballfield",
    foundedYear: 2012,
    sortOrder: 10,
  },
  crushers: {
    slug: "e2e-christiansted-crushers",
    name: "E2E Christiansted Crushers",
    island: "st_croix",
    division: "Men's",
    description: "St. Croix men's powerhouse on the east end.",
    homeVenue: "Canegata Ballpark",
    foundedYear: 1991,
    sortOrder: 10,
  },
  fire: {
    slug: "e2e-frederiksted-fire",
    name: "E2E Frederiksted Fire",
    island: "st_croix",
    division: "Coed",
    description: "West-end St. Croix coed club and youth development pipeline.",
    homeVenue: "Paul E. Joseph Stadium",
    foundedYear: 2008,
    sortOrder: 20,
  },
} as const satisfies Record<string, FxTeam>;

type FxTeamKey = keyof typeof FX_TEAMS;

type FxPlayer = { team: FxTeamKey; name: string; num: number; pos: string; bt: string; sort: number };

export const FX_PLAYERS: FxPlayer[] = [
  { team: "frenchtown", name: "Malik Prince", num: 7, pos: "SS", bt: "R/R", sort: 10 },
  { team: "frenchtown", name: "Andre Petersen", num: 12, pos: "P", bt: "L/L", sort: 20 },
  { team: "frenchtown", name: "Tyrone Baptiste", num: 24, pos: "C", bt: "R/R", sort: 30 },
  { team: "frenchtown", name: "Jamal Herbert", num: 3, pos: "CF", bt: "L/R", sort: 40 },
  { team: "storm", name: "Keisha Williams", num: 9, pos: "P", bt: "R/R", sort: 10 },
  { team: "storm", name: "Tamara Joseph", num: 5, pos: "SS", bt: "R/R", sort: 20 },
  { team: "storm", name: "Nadia Charles", num: 21, pos: "1B", bt: "L/L", sort: 30 },
  { team: "cruzBay", name: "Devon Sewer", num: 10, pos: "OF", bt: "R/R", sort: 10 },
  { team: "cruzBay", name: "Alicia George", num: 14, pos: "2B", bt: "R/R", sort: 20 },
  { team: "cruzBay", name: "Marcus Penn", num: 6, pos: "3B", bt: "R/R", sort: 30 },
  { team: "crushers", name: "Rueben Santos", num: 4, pos: "SS", bt: "R/R", sort: 10 },
  { team: "crushers", name: "Elias Gomez", num: 18, pos: "P", bt: "R/R", sort: 20 },
  { team: "crushers", name: "Josiah Bryan", num: 22, pos: "1B", bt: "L/L", sort: 30 },
  { team: "crushers", name: "Nathaniel Frett", num: 8, pos: "C", bt: "R/R", sort: 40 },
  { team: "fire", name: "Shanice Moorehead", num: 11, pos: "P", bt: "L/R", sort: 10 },
  { team: "fire", name: "Kwame Richardson", num: 2, pos: "2B", bt: "R/R", sort: 20 },
  { team: "fire", name: "Latoya Benjamin", num: 16, pos: "OF", bt: "R/R", sort: 30 },
];

type FxEvent = {
  slug: string;
  name: string;
  description: string;
  venue: string;
  island: Island | null;
  startDate: string;
  endDate: string;
  sortOrder: number;
};

// Dates stay wide (2099 / 2020) so the Upcoming/Past split is stable.
export const FX_EVENTS = {
  championship: {
    slug: "e2e-territorial-championship",
    name: "E2E Territorial Championship (Upcoming)",
    description: "E2E fixture — the flagship territorial championship.",
    venue: "Lionel Roberts Stadium",
    island: "st_thomas",
    startDate: "2099-06-01",
    endDate: "2099-06-07",
    sortOrder: 10,
  },
  cup: {
    slug: "e2e-inter-island-cup",
    name: "E2E Inter-Island Cup (Upcoming)",
    description: "E2E fixture — an inter-island tournament across all three islands.",
    venue: "Multiple venues",
    island: null,
    startDate: "2099-08-15",
    endDate: "2099-08-18",
    sortOrder: 20,
  },
  classic: {
    slug: "e2e-youth-classic",
    name: "E2E Youth Classic (Past)",
    description: "E2E fixture — a past youth development tournament.",
    venue: "Canegata Ballpark",
    island: "st_croix",
    startDate: "2020-04-10",
    endDate: "2020-04-12",
    sortOrder: 30,
  },
} as const satisfies Record<string, FxEvent>;

type FxEventKey = keyof typeof FX_EVENTS;

export const FX_EVENT_TEAMS: { event: FxEventKey; team: FxTeamKey; sort: number }[] = [
  { event: "championship", team: "frenchtown", sort: 10 },
  { event: "championship", team: "storm", sort: 20 },
  { event: "championship", team: "crushers", sort: 30 },
  { event: "cup", team: "frenchtown", sort: 10 },
  { event: "cup", team: "cruzBay", sort: 20 },
  { event: "cup", team: "crushers", sort: 30 },
  { event: "cup", team: "fire", sort: 40 },
  { event: "classic", team: "fire", sort: 10 },
  { event: "classic", team: "cruzBay", sort: 20 },
];

export const FX_TEAM_COUNT = Object.keys(FX_TEAMS).length; // 5
export const FX_PLAYER_COUNT = FX_PLAYERS.length; // 17
export const FX_EVENT_COUNT = Object.keys(FX_EVENTS).length; // 3

// Delete every fixture row (by the e2e- slug prefix). Cascades remove their team_players
// and event_teams. Never touches a row without the prefix.
export async function cleanupSportsFixtures(): Promise<void> {
  const db = createAdminClient();
  const ev = await db.from("events").delete().like("slug", `${FX_PREFIX}%`);
  if (ev.error) throw ev.error;
  const tm = await db.from("teams").delete().like("slug", `${FX_PREFIX}%`);
  if (tm.error) throw tm.error;
}

// (Re)create the full fixture set. Idempotent: clears any leftovers from an aborted run
// first. Returns the id of each fixture team and event, keyed like FX_TEAMS / FX_EVENTS.
export async function seedSportsFixtures(): Promise<{
  teamIds: Record<FxTeamKey, string>;
  eventIds: Record<FxEventKey, string>;
}> {
  await cleanupSportsFixtures();
  const db = createAdminClient();

  const teamRows = Object.values(FX_TEAMS).map((t) => ({
    name: t.name,
    slug: t.slug,
    kind: "club",
    island: t.island,
    division: t.division,
    description: t.description,
    home_venue: t.homeVenue,
    founded_year: t.foundedYear,
    sort_order: t.sortOrder,
  }));
  const teams = await db.from("teams").insert(teamRows).select("id,slug");
  if (teams.error) throw teams.error;
  const teamIdBySlug = new Map(teams.data.map((r) => [r.slug as string, r.id as string]));
  const teamIds = Object.fromEntries(
    Object.entries(FX_TEAMS).map(([k, t]) => [k, teamIdBySlug.get(t.slug)!]),
  ) as Record<FxTeamKey, string>;

  const players = await db.from("team_players").insert(
    FX_PLAYERS.map((p) => ({
      team_id: teamIds[p.team],
      name: p.name,
      jersey_number: p.num,
      position: p.pos,
      bats_throws: p.bt,
      sort_order: p.sort,
    })),
  );
  if (players.error) throw players.error;

  const events = await db
    .from("events")
    .insert(
      Object.values(FX_EVENTS).map((e) => ({
        name: e.name,
        slug: e.slug,
        description: e.description,
        venue: e.venue,
        island: e.island,
        start_date: e.startDate,
        end_date: e.endDate,
        sort_order: e.sortOrder,
      })),
    )
    .select("id,slug");
  if (events.error) throw events.error;
  const eventIdBySlug = new Map(events.data.map((r) => [r.slug as string, r.id as string]));
  const eventIds = Object.fromEntries(
    Object.entries(FX_EVENTS).map(([k, e]) => [k, eventIdBySlug.get(e.slug)!]),
  ) as Record<FxEventKey, string>;

  const links = await db.from("event_teams").insert(
    FX_EVENT_TEAMS.map((l) => ({
      event_id: eventIds[l.event],
      team_id: teamIds[l.team],
      sort_order: l.sort,
    })),
  );
  if (links.error) throw links.error;

  return { teamIds, eventIds };
}
