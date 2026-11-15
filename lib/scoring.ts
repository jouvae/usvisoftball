import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEventBySlug, listEvents } from "@/lib/schedule";
import { USVI_COUNTRY, type GameState, type StatLineInput } from "@/lib/schedule-view";
import {
  isZeroLine,
  orderScoringGames,
  type ScoringGameDetail,
  type ScoringGameRow,
  type SetGameStateOp,
  type SetInningRunsOp,
  type SetLineupOp,
  type SetStatLineOp,
  type SetTeamTotalsOp,
} from "@/lib/scoring-view";

// ---------------------------------------------------------------------------
// Feature softball/schedule, Slice S4 — scorekeeper Data Access Layer (overview.md §6.1).
//
// SERVER ONLY. Every read and write goes through the COOKIE SESSION client
// (createSupabaseServerClient), never the admin/service client — RLS (0026) and the 0027
// column triggers are the boundary. Callers (app/admin/(protected)/scoring/actions.ts) have
// already run requireAnyRole(['scorekeeper','editor']) and shape-validated the op; these
// functions THROW on DB/transport errors or a missing game, and the action maps that to a
// plain-language ActionResult. All writes are absolute SETs (idempotent on replay).
// `seq` is ignored server-side.
// ---------------------------------------------------------------------------

export * from "@/lib/scoring-view";

// Upsert game_innings (game_id, inning, side) → runs.
export async function saveInningRuns(op: Omit<SetInningRunsOp, "seq">): Promise<void> {
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("game_innings")
    .upsert(
      { game_id: op.gameId, inning: op.inning, side: op.side, runs: op.runs },
      { onConflict: "game_id,inning,side" },
    );
  if (error) throw error;
}

// Update games.{side}_hits / {side}_errors for op.gameId.
export async function saveTeamTotals(op: Omit<SetTeamTotalsOp, "seq">): Promise<void> {
  const db = await createSupabaseServerClient();
  const patch =
    op.side === "away"
      ? { away_hits: op.hits, away_errors: op.errors }
      : { home_hits: op.hits, home_errors: op.errors };
  await updateGame(db, op.gameId, patch);
}

// Update games.state / current_inning for op.gameId.
export async function saveGameState(op: Omit<SetGameStateOp, "seq">): Promise<void> {
  const db = await createSupabaseServerClient();
  await updateGame(db, op.gameId, { state: op.state, current_inning: op.currentInning });
}

// An UPDATE that RLS silently filters affects 0 rows without an error — select the row back
// so a refused write throws instead of reporting success.
async function updateGame(
  db: SupabaseClient,
  gameId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await db.from("games").update(patch).eq("id", gameId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`game ${gameId} not updated`);
}

function statColumns(line: StatLineInput) {
  const p = line.pitching;
  return {
    ab: line.ab,
    r: line.r,
    h: line.h,
    doubles: line.doubles,
    triples: line.triples,
    hr: line.hr,
    rbi: line.rbi,
    bb: line.bb,
    so: line.so,
    sb: line.sb,
    outs_pitched: p ? p.outsPitched : null,
    p_h: p ? p.h : null,
    p_r: p ? p.r : null,
    p_er: p ? p.er : null,
    p_bb: p ? p.bb : null,
    p_so: p ? p.so : null,
  };
}

// Resolve each player's team SERVER-SIDE (never trusted from the client).
async function teamIdsFor(db: SupabaseClient, playerIds: readonly string[]): Promise<Map<string, string>> {
  if (playerIds.length === 0) return new Map();
  const { data, error } = await db
    .from("team_players")
    .select("id,team_id")
    .in("id", playerIds as string[])
    .limit(playerIds.length);
  if (error) throw error;
  return new Map(((data as { id: string; team_id: string }[] | null) ?? []).map((r) => [r.id, r.team_id]));
}

// Upsert game_player_stats (game_id, player_id). team_id is resolved SERVER-SIDE from
// team_players (never trusted from the client); pitching null → pitching columns NULL.
export async function saveStatLine(op: Omit<SetStatLineOp, "seq">): Promise<void> {
  const db = await createSupabaseServerClient();
  const teamId = (await teamIdsFor(db, [op.playerId])).get(op.playerId);
  if (!teamId) throw new Error(`player ${op.playerId} not found`);
  const { error } = await db
    .from("game_player_stats")
    .upsert(
      { game_id: op.gameId, player_id: op.playerId, team_id: teamId, ...statColumns(op.line) },
      { onConflict: "game_id,player_id" },
    );
  if (error) throw error;
}

// Thrown by saveLineup when RLS refused to remove a line (game_player_stats DELETE is
// editor-only in 0026), so the action can explain it instead of reporting success.
export class LineupRemovalRefused extends Error {}

// Insert zero lines for op.playerIds lacking one; delete lines of absent players only when
// all-zero. Never deletes a line with stats (the action pre-checks and refuses).
export async function saveLineup(op: Omit<SetLineupOp, "seq">): Promise<void> {
  const db = await createSupabaseServerClient();
  const teams = await teamIdsFor(db, op.playerIds);
  const rows = op.playerIds.map((id) => {
    const teamId = teams.get(id);
    if (!teamId) throw new Error(`player ${id} not found`);
    return { game_id: op.gameId, player_id: id, team_id: teamId };
  });
  if (rows.length > 0) {
    const ins = await db
      .from("game_player_stats")
      .upsert(rows, { onConflict: "game_id,player_id", ignoreDuplicates: true });
    if (ins.error) throw ins.error;
  }

  const existing = await readStatLines(db, op.gameId);
  const keep = new Set(op.playerIds);
  const drop = [...existing.entries()]
    .filter(([id, line]) => !keep.has(id) && isZeroLine(line))
    .map(([id]) => id);
  if (drop.length === 0) return;
  const del = await db
    .from("game_player_stats")
    .delete()
    .eq("game_id", op.gameId)
    .in("player_id", drop)
    .select("id");
  if (del.error) throw del.error;
  if ((del.data ?? []).length < drop.length) throw new LineupRemovalRefused();
}

type StatColumnsRow = ReturnType<typeof statColumns> & { player_id: string };

function toLine(r: StatColumnsRow): StatLineInput {
  return {
    ab: r.ab,
    r: r.r,
    h: r.h,
    doubles: r.doubles,
    triples: r.triples,
    hr: r.hr,
    rbi: r.rbi,
    bb: r.bb,
    so: r.so,
    sb: r.sb,
    pitching:
      r.outs_pitched == null
        ? null
        : {
            outsPitched: r.outs_pitched,
            h: r.p_h ?? 0,
            r: r.p_r ?? 0,
            er: r.p_er ?? 0,
            bb: r.p_bb ?? 0,
            so: r.p_so ?? 0,
          },
  };
}

async function readStatLines(db: SupabaseClient, gameId: string): Promise<Map<string, StatLineInput>> {
  const { data, error } = await db
    .from("game_player_stats")
    .select("player_id,ab,r,h,doubles,triples,hr,rbi,bb,so,sb,outs_pitched,p_h,p_r,p_er,p_bb,p_so")
    .eq("game_id", gameId)
    .limit(200);
  if (error) throw error;
  return new Map(((data as StatColumnsRow[] | null) ?? []).map((r) => [r.player_id, toLine(r)]));
}

// What the actions need to validate an op against the CURRENT game (never the client's view).
export interface ScoringGameMeta {
  id: string;
  state: GameState;
  usviTeamIds: string[];
  // Active players of the game's USVI side(s) → their team id. Filled only on request.
  activeUsviPlayers: Map<string, string>;
  // Existing stat lines by player id. Filled only on request.
  statLines: Map<string, StatLineInput>;
}

// The game `gameId` (null when it does not exist), plus — when `withPlayers` — its USVI
// active roster and current stat lines. Cookie session client; public-read RLS.
export async function readScoringGameMeta(
  gameId: string,
  withPlayers = false,
): Promise<ScoringGameMeta | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("games")
    .select(
      "id,state,away_team_id,home_team_id," +
        "away:teams!games_away_team_id_fkey(country_code),home:teams!games_home_team_id_fkey(country_code)",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  type Row = {
    id: string;
    state: GameState;
    away_team_id: string;
    home_team_id: string;
    away: { country_code: string | null } | { country_code: string | null }[] | null;
    home: { country_code: string | null } | { country_code: string | null }[] | null;
  };
  const row = data as unknown as Row;
  const cc = (t: Row["away"]) => (Array.isArray(t) ? t[0] : t)?.country_code ?? null;
  const usviTeamIds = [
    cc(row.away) === USVI_COUNTRY ? row.away_team_id : null,
    cc(row.home) === USVI_COUNTRY ? row.home_team_id : null,
  ].filter((id): id is string => id != null);

  const meta: ScoringGameMeta = {
    id: row.id,
    state: row.state,
    usviTeamIds,
    activeUsviPlayers: new Map(),
    statLines: new Map(),
  };
  if (!withPlayers) return meta;

  if (usviTeamIds.length > 0) {
    const players = await db
      .from("team_players")
      .select("id,team_id")
      .in("team_id", usviTeamIds)
      .eq("active", true)
      .limit(200);
    if (players.error) throw players.error;
    for (const p of (players.data as { id: string; team_id: string }[] | null) ?? []) {
      meta.activeUsviPlayers.set(p.id, p.team_id);
    }
  }
  meta.statLines = await readStatLines(db, gameId);
  return meta;
}

// Game events for the /admin/scoring list, ordered by orderScoringGames(rows, nowIso):
// today (venue-local) first, then upcoming, then recent finals; USVI first within a day.
export async function listScoringGames(nowIso: string): Promise<ScoringGameRow[]> {
  const db = await createSupabaseServerClient();
  const events = await listEvents({}, db);
  const games = events.filter(
    (e): e is ScoringGameRow => e.type === "game" && e.game != null,
  );
  return orderScoringGames(games, nowIso);
}

// The game event at `slug` with teams, innings, box score and ACTIVE rosters; null when the
// slug is unknown or the event is not a game.
export async function getScoringGame(slug: string): Promise<ScoringGameDetail | null> {
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
  const db = await createSupabaseServerClient();
  const event = await getEventBySlug(slug, db);
  if (!event || event.type !== "game" || !event.game) return null;
  return event as ScoringGameDetail;
}
