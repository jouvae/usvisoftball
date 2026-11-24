import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { PLAYER_COLUMNS, toPlayer, type PlayerRow } from "@/lib/teams";
import {
  ATLANTIC_TZ,
  isUsviTeam,
  tournamentWindow,
  type EventDetail,
  type EventStatus,
  type EventType,
  type EventWithGame,
  type GameStandout,
  type GameState,
  type GameWithTeams,
  type Inning,
  type PlayerStatLineWithPlayer,
  type ScheduleTeam,
  type Side,
  type StandoutKind,
  type Tournament,
  type TournamentWindow,
} from "@/lib/schedule-view";
import type { TeamKind, TeamPlayer } from "@/lib/teams-view";

// ---------------------------------------------------------------------------
// Feature softball/schedule — tournaments, calendar events, games (read side).
//
// SERVER ONLY. Reads go through the RLS-enforced publishable client (the 0026 public-read
// policies). Scorekeeper/editor writes (S4) arrive later as Server Actions on the cookie
// session client. Client-safe types + pure helpers live in lib/schedule-view.ts (re-exported
// below) so Client Components can import them without dragging `server-only` in.
// ---------------------------------------------------------------------------

export * from "@/lib/schedule-view";

// Filters for listEvents(). All optional; combined with AND.
export interface ListEventsOptions {
  tournamentId?: string; // only this tournament's events
  from?: string; // ISO instant; only events whose coalesce(ends_at, starts_at) >= from
  teamCountry?: string; // ISO alpha-2 (e.g. USVI_COUNTRY); only games involving a team of it
}

// ── Row shapes + mappers ─────────────────────────────────────────────────────────

// Upper bound on any list read (a tournament is ~33 events; this leaves ample headroom).
const LIST_LIMIT = 500;

type TournamentRow = {
  id: string;
  name: string;
  name_es: string;
  slug: string;
  description: string;
  description_es: string;
  city: string;
  country_code: string | null;
  timezone: string;
  logo_url: string;
  cover_image_url: string;
  stream_url: string | null;
  announced_start: string | null;
  announced_end: string | null;
  sort_order: number;
};

const TOURNAMENT_COLUMNS =
  "id,name,name_es,slug,description,description_es,city,country_code,timezone,logo_url,cover_image_url,stream_url,announced_start,announced_end,sort_order";

function toTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    nameEs: row.name_es,
    slug: row.slug,
    description: row.description,
    descriptionEs: row.description_es,
    city: row.city,
    countryCode: row.country_code,
    timezone: row.timezone,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    streamUrl: row.stream_url,
    announcedStart: row.announced_start,
    announcedEnd: row.announced_end,
    sortOrder: row.sort_order,
  };
}

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  kind: TeamKind;
  short_name: string;
  country_code: string | null;
  division: string;
  logo_url: string;
};

const TEAM_COLUMNS = "id,name,slug,kind,short_name,country_code,division,logo_url";

function toScheduleTeam(row: TeamRow): ScheduleTeam {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    shortName: row.short_name,
    countryCode: row.country_code,
    division: row.division,
    logoUrl: row.logo_url,
  };
}

type GameRow = {
  id: string;
  event_id: string;
  away_team_id: string;
  home_team_id: string;
  state: GameState;
  current_inning: number | null;
  away_hits: number;
  away_errors: number;
  home_hits: number;
  home_errors: number;
  away_runs: number | null;
  home_runs: number | null;
  away_walks: number | null;
  home_walks: number | null;
  away_strikeouts: number | null;
  home_strikeouts: number | null;
  away: TeamRow | TeamRow[] | null;
  home: TeamRow | TeamRow[] | null;
  game_innings: Inning[] | null;
};

// games has TWO FKs to teams, so each embed names its FK explicitly.
const GAME_SELECT =
  "id,event_id,away_team_id,home_team_id,state,current_inning,away_hits,away_errors,home_hits,home_errors," +
  "away_runs,home_runs,away_walks,home_walks,away_strikeouts,home_strikeouts," +
  `away:teams!games_away_team_id_fkey(${TEAM_COLUMNS}),` +
  `home:teams!games_home_team_id_fkey(${TEAM_COLUMNS}),` +
  "game_innings(inning,side,runs)";

type EventRow = {
  id: string;
  tournament_id: string | null;
  type: EventType;
  slug: string;
  title: string;
  title_es: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  round: string;
  status: EventStatus;
  stream_url: string | null;
  sort_order: number;
  tournaments: TournamentRow | TournamentRow[] | null;
  games: GameRow | GameRow[] | null;
};

const EVENT_COLUMNS =
  "id,tournament_id,type,slug,title,title_es,starts_at,ends_at,venue,round,status,stream_url,sort_order";

// One embedded read: event + tournament + game (+ both teams + innings). `gamesEmbed` lets a
// caller switch the game embed to `games!inner` so filters on it narrow the events.
function eventSelect(gamesEmbed = "games"): string {
  return `${EVENT_COLUMNS},tournaments(${TOURNAMENT_COLUMNS}),${gamesEmbed}(${GAME_SELECT})`;
}

// A to-one embed returns an object; be defensive if it ever arrives as an array.
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function toGame(row: GameRow): GameWithTeams | null {
  const away = one(row.away);
  const home = one(row.home);
  if (!away || !home) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    awayTeamId: row.away_team_id,
    homeTeamId: row.home_team_id,
    state: row.state,
    currentInning: row.current_inning,
    awayHits: row.away_hits,
    awayErrors: row.away_errors,
    homeHits: row.home_hits,
    homeErrors: row.home_errors,
    awayRuns: row.away_runs,
    homeRuns: row.home_runs,
    awayWalks: row.away_walks,
    homeWalks: row.home_walks,
    awayStrikeouts: row.away_strikeouts,
    homeStrikeouts: row.home_strikeouts,
    away: toScheduleTeam(away),
    home: toScheduleTeam(home),
    innings: (row.game_innings ?? [])
      .map((c) => ({ inning: c.inning, side: c.side, runs: c.runs }))
      .sort((a, b) => a.inning - b.inning || (a.side === "away" ? -1 : 1)),
  };
}

function toEventWithGame(row: EventRow): EventWithGame {
  const tournament = one(row.tournaments);
  const game = one(row.games);
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    titleEs: row.title_es,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venue: row.venue,
    round: row.round,
    status: row.status,
    streamUrl: row.stream_url,
    sortOrder: row.sort_order,
    timezone: tournament?.timezone ?? ATLANTIC_TZ,
    tournament: tournament
      ? { id: tournament.id, name: tournament.name, nameEs: tournament.name_es, slug: tournament.slug }
      : null,
    game: game ? toGame(game) : null,
  };
}

// Canonical ISO instant for a filter value — throws on garbage so nothing unparsed reaches
// the PostgREST filter string.
function isoInstant(value: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Invalid instant: ${value}`);
  return new Date(ms).toISOString();
}

// ── Reads ────────────────────────────────────────────────────────────────────────

// Calendar events with their game + teams + innings, ordered (starts_at, sort_order). Bounded.
export async function listEvents(
  opts: ListEventsOptions = {},
  supabase: SupabaseClient = createPublicClient(),
): Promise<EventWithGame[]> {
  let teamIds: string[] | null = null;
  if (opts.teamCountry !== undefined) {
    const country = opts.teamCountry.toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) throw new Error(`Invalid country code: ${opts.teamCountry}`);
    const { data, error } = await supabase
      .from("teams")
      .select("id")
      .eq("country_code", country)
      .limit(100);
    if (error) throw error;
    teamIds = ((data as { id: string }[] | null) ?? []).map((t) => t.id);
    if (teamIds.length === 0) return [];
  }

  let query = supabase.from("calendar_events").select(eventSelect(teamIds ? "games!inner" : "games"));
  if (opts.tournamentId) query = query.eq("tournament_id", opts.tournamentId);
  if (opts.from) {
    const from = isoInstant(opts.from);
    query = query.or(`ends_at.gte."${from}",and(ends_at.is.null,starts_at.gte."${from}")`);
  }
  if (teamIds) {
    const ids = teamIds.join(",");
    query = query.or(`away_team_id.in.(${ids}),home_team_id.in.(${ids})`, {
      referencedTable: "games",
    });
  }
  const { data, error } = await query
    .order("starts_at", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return ((data as unknown as EventRow[] | null) ?? []).map(toEventWithGame);
}

type StatRow = {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  sb: number;
  outs_pitched: number | null;
  p_h: number | null;
  p_r: number | null;
  p_er: number | null;
  p_bb: number | null;
  p_so: number | null;
  player: PlayerRow | PlayerRow[] | null;
};

// game_player_stats has two FKs to team_players (player_id, and the composite
// (player_id, team_id)), so the player embed names its FK.
const STAT_SELECT =
  "id,game_id,player_id,team_id,ab,r,h,doubles,triples,hr,rbi,bb,so,sb," +
  "outs_pitched,p_h,p_r,p_er,p_bb,p_so," +
  "player:team_players!game_player_stats_player_id_fkey(id,name,jersey_number,position)";

function toStatLine(row: StatRow): PlayerStatLineWithPlayer | null {
  const p = one(row.player);
  if (!p) return null;
  return {
    id: row.id,
    gameId: row.game_id,
    playerId: row.player_id,
    teamId: row.team_id,
    ab: row.ab,
    r: row.r,
    h: row.h,
    doubles: row.doubles,
    triples: row.triples,
    hr: row.hr,
    rbi: row.rbi,
    bb: row.bb,
    so: row.so,
    sb: row.sb,
    pitching:
      row.outs_pitched == null
        ? null
        : {
            outsPitched: row.outs_pitched,
            h: row.p_h ?? 0,
            r: row.p_r ?? 0,
            er: row.p_er ?? 0,
            bb: row.p_bb ?? 0,
            so: row.p_so ?? 0,
          },
    player: { id: p.id, name: p.name, jerseyNumber: p.jersey_number, position: p.position },
  };
}

// One event by slug with game, teams, innings, stat lines and USVI active rosters; null → 404.
export async function getEventBySlug(
  slug: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select(eventSelect())
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as EventRow;
  const event = toEventWithGame(row);
  const tournamentRow = one(row.tournaments);
  const rosters: Record<Side, TeamPlayer[]> = { away: [], home: [] };
  let statLines: PlayerStatLineWithPlayer[] = [];

  const game = event.game;
  if (game) {
    // Rosters only for USVI sides (D5), active players only (D4).
    const usviIds = [game.away, game.home].filter(isUsviTeam).map((t) => t.id);
    const [statsRes, playersRes] = await Promise.all([
      supabase
        .from("game_player_stats")
        .select(STAT_SELECT)
        .eq("game_id", game.id)
        .limit(LIST_LIMIT),
      usviIds.length
        ? supabase
            .from("team_players")
            .select(`team_id,${PLAYER_COLUMNS}`)
            .in("team_id", usviIds)
            .eq("active", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .limit(LIST_LIMIT)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (statsRes.error) throw statsRes.error;
    if (playersRes.error) throw playersRes.error;

    statLines = ((statsRes.data as unknown as StatRow[] | null) ?? [])
      .map(toStatLine)
      .filter((l): l is PlayerStatLineWithPlayer => l != null);

    for (const p of (playersRes.data as (PlayerRow & { team_id: string })[] | null) ?? []) {
      if (p.team_id === game.away.id) rosters.away.push(toPlayer(p));
      if (p.team_id === game.home.id) rosters.home.push(toPlayer(p));
    }
  }

  return {
    ...event,
    tournamentDetail: tournamentRow ? toTournament(tournamentRow) : null,
    statLines,
    rosters,
  };
}

// One tournament by slug; null → 404. Its events come from listEvents({ tournamentId }).
export async function getTournamentBySlug(
  slug: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toTournament(data as TournamentRow) : null;
}

// Every game event a team plays (away or home), ordered by starts_at — guest team pages.
export async function listGamesForTeam(
  teamId: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<EventWithGame[]> {
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return [];
  const { data, error } = await supabase
    .from("calendar_events")
    .select(eventSelect("games!inner"))
    .eq("type", "game")
    .or(`away_team_id.eq.${teamId},home_team_id.eq.${teamId}`, { referencedTable: "games" })
    .order("starts_at", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) throw error;
  return ((data as unknown as EventRow[] | null) ?? []).map(toEventWithGame);
}

// The game events for a set of game ids (home feed: recap score bars + final highlights).
export async function listEventsByGameIds(
  gameIds: readonly string[],
  supabase: SupabaseClient = createPublicClient(),
): Promise<EventWithGame[]> {
  const ids = gameIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("calendar_events")
    .select(eventSelect("games!inner"))
    .in("games.id", ids)
    .limit(LIST_LIMIT);
  if (error) throw error;
  return ((data as unknown as EventRow[] | null) ?? []).map(toEventWithGame);
}

// A game's editor-picked standouts (0030), award kinds first then sort_order.
const KIND_ORDER: Record<StandoutKind, number> = { player_of_game: 0, pitching: 1, standout: 2 };
export async function listGameStandouts(
  gameId: string,
  supabase: SupabaseClient = createPublicClient(),
): Promise<GameStandout[]> {
  if (!/^[0-9a-f-]{36}$/i.test(gameId)) return [];
  const { data, error } = await supabase
    .from("game_standouts")
    .select("id,game_id,team_id,kind,player_name,stat_line,note,sort_order")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) throw error;
  type Row = {
    id: string;
    game_id: string;
    team_id: string | null;
    kind: StandoutKind;
    player_name: string;
    stat_line: string;
    note: string;
    sort_order: number;
  };
  return ((data as Row[] | null) ?? [])
    .map((r) => ({
      id: r.id,
      gameId: r.game_id,
      teamId: r.team_id,
      kind: r.kind,
      playerName: r.player_name,
      statLine: r.stat_line,
      note: r.note,
      sortOrder: r.sort_order,
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sortOrder - b.sortOrder);
}

// The next tournament for the home "Upcoming Event" band: the tournament of the earliest event
// that has not ended yet (window derived from ALL its events, D2); failing that, the soonest
// tournament with announced dates still ahead and no events yet. null → no band.
export async function getNextTournament(
  now: Date,
  supabase: SupabaseClient = createPublicClient(),
): Promise<{ tournament: Tournament; window: TournamentWindow | null } | null> {
  const from = now.toISOString();
  const next = await supabase
    .from("calendar_events")
    .select("tournament_id")
    .not("tournament_id", "is", null)
    .or(`ends_at.gte."${from}",and(ends_at.is.null,starts_at.gte."${from}")`)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (next.error) throw next.error;

  let tournamentId = (next.data as { tournament_id: string } | null)?.tournament_id ?? null;
  if (!tournamentId) {
    const today = from.slice(0, 10);
    const announced = await supabase
      .from("tournaments")
      .select("id,calendar_events(id)")
      .gte("announced_end", today)
      .order("announced_start", { ascending: true })
      .limit(20);
    if (announced.error) throw announced.error;
    const rows = (announced.data as { id: string; calendar_events: { id: string }[] | null }[] | null) ?? [];
    tournamentId = rows.find((r) => (r.calendar_events ?? []).length === 0)?.id ?? null;
  }
  if (!tournamentId) return null;

  const [tRes, eRes] = await Promise.all([
    supabase.from("tournaments").select(TOURNAMENT_COLUMNS).eq("id", tournamentId).maybeSingle(),
    supabase
      .from("calendar_events")
      .select("starts_at,ends_at")
      .eq("tournament_id", tournamentId)
      .limit(LIST_LIMIT),
  ]);
  if (tRes.error) throw tRes.error;
  if (eRes.error) throw eRes.error;
  if (!tRes.data) return null;
  const tournament = toTournament(tRes.data as TournamentRow);
  const spans = ((eRes.data as { starts_at: string; ends_at: string | null }[] | null) ?? []).map(
    (r) => ({ startsAt: r.starts_at, endsAt: r.ends_at }),
  );
  return { tournament, window: tournamentWindow(spans, tournament) };
}
