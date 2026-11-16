"use server";

import { revalidatePath } from "next/cache";
import { checkAnyRole } from "@/lib/roles";
import {
  LineupRemovalRefused,
  isZeroLine,
  readScoringGameMeta,
  saveGameState,
  saveInningRuns,
  saveLineup,
  saveStatLine,
  saveTeamTotals,
  type ScoringGameMeta,
} from "@/lib/scoring";
import { validateStatLine, type StatLineInput } from "@/lib/schedule-view";
import type {
  ActionResult,
  ScoringOp,
  ScoringOpDraft,
  SetGameStateOp,
  SetInningRunsOp,
  SetLineupOp,
  SetStatLineOp,
  SetTeamTotalsOp,
} from "@/lib/scoring-view";

// Feature softball/schedule, Slice S4 — scorekeeper Server Actions (overview.md §6.1).
//
// Contract shared by every action below:
//   * AUTH — first statement is the role check for ['scorekeeper', 'editor'] (lib/roles
//     checkAnyRole, the non-redirecting twin of requireAnyRole). These actions are called
//     programmatically by the offline queue, where a redirect would yank the scorekeeper off
//     the game screen mid-inning (redirect.md: in a Server Action it becomes a client
//     navigation), so an anon / role-less / disabled caller gets { ok: false } instead and
//     nothing is written.
//   * VALIDATION — the op is re-validated server-side (never trust the client): gameId a
//     UUID of an existing GAME, integers within sane bounds, enums checked. A bad op returns
//     { ok: false, error } with a plain-language sentence.
//   * WRITE — via lib/scoring.ts on the cookie session client (RLS + 0027 triggers are the
//     boundary). Absolute SETs, so a replayed op is harmless; `seq` is accepted and ignored.
//   * NEVER THROWS to the client — DB/transport errors are caught and mapped to
//     { ok: false, error }.
//   * revalidatePath of the public event page and the public events list on success.
// Args may be a stamped ScoringOp (queue replay) or a draft without seq.

const SCORING_ROLES = ["scorekeeper", "editor"] as const;

// Sane upper bounds — a softball game never gets near them; they stop garbage, not play.
const MAX_INNING = 30;
const MAX_COUNT = 99; // runs in a half-inning, team H/E, any one stat
const MAX_LINEUP = 60;

const SIGNED_OUT = "You're signed out or not allowed to keep score. Please sign in again.";
const NO_GAME = "We couldn't find that game. Go back to the games list and open it again.";
const NOT_SAVED = "That change didn't save. Please try again.";
// Shown when RLS removed fewer lines than asked (0028: a scorekeeper may only delete an
// all-zero line — a stat was added meanwhile, e.g. from another phone).
const LINEUP_REMOVAL = "That player now has stats, so they can't be taken off. Clear their stats first.";
const FINAL_LOCKED = "This game is over. Ask an editor to reopen it to change the score.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Caller = { isEditor: boolean };

async function authorize(): Promise<Caller | null> {
  try {
    const auth = await checkAnyRole(SCORING_ROLES);
    return auth ? { isEditor: auth.profile.roles.includes("editor") } : null;
  } catch {
    return null;
  }
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isCount(v: unknown, max = MAX_COUNT): v is number {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
}

function isInning(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_INNING;
}

function isSide(v: unknown): v is "away" | "home" {
  return v === "away" || v === "home";
}

// Loads the target game, or a failure result. `withPlayers` also loads the USVI roster +
// current stat lines (lineup / box score validation).
async function loadGame(
  gameId: unknown,
  withPlayers = false,
): Promise<{ game: ScoringGameMeta } | { result: ActionResult }> {
  if (typeof gameId !== "string" || !UUID.test(gameId)) return { result: fail(NO_GAME) };
  try {
    const game = await readScoringGameMeta(gameId, withPlayers);
    return game ? { game } : { result: fail(NO_GAME) };
  } catch {
    return { result: fail(NOT_SAVED) };
  }
}

async function write(save: () => Promise<void>): Promise<ActionResult> {
  try {
    await save();
  } catch (e) {
    if (e instanceof LineupRemovalRefused) {
      return fail(LINEUP_REMOVAL);
    }
    return fail(NOT_SAVED);
  }
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/events");
  return { ok: true };
}

// Validates: inning integer ≥ 1, side 'away'|'home', runs integer ≥ 0.
export async function setInningRuns(
  op: SetInningRunsOp | Omit<SetInningRunsOp, "seq">,
): Promise<ActionResult> {
  const caller = await authorize();
  if (!caller) return fail(SIGNED_OUT);
  if (!isObject(op) || !isInning(op.inning) || !isSide(op.side) || !isCount(op.runs)) {
    return fail("That run count isn't valid.");
  }
  const loaded = await loadGame(op.gameId);
  if ("result" in loaded) return loaded.result;
  if (loaded.game.state === "final" && !caller.isEditor) return fail(FINAL_LOCKED);
  return write(() =>
    saveInningRuns({ kind: "setInningRuns", gameId: loaded.game.id, inning: op.inning, side: op.side, runs: op.runs }),
  );
}

// Validates: side 'away'|'home', hits and errors integers ≥ 0.
export async function setTeamTotals(
  op: SetTeamTotalsOp | Omit<SetTeamTotalsOp, "seq">,
): Promise<ActionResult> {
  const caller = await authorize();
  if (!caller) return fail(SIGNED_OUT);
  if (!isObject(op) || !isSide(op.side) || !isCount(op.hits) || !isCount(op.errors)) {
    return fail("That hits or errors count isn't valid.");
  }
  const loaded = await loadGame(op.gameId);
  if ("result" in loaded) return loaded.result;
  if (loaded.game.state === "final" && !caller.isEditor) return fail(FINAL_LOCKED);
  return write(() =>
    saveTeamTotals({ kind: "setTeamTotals", gameId: loaded.game.id, side: op.side, hits: op.hits, errors: op.errors }),
  );
}

// Validates: state 'pregame'|'live'|'final'; currentInning integer ≥ 1 for live/final, null
// for pregame. Re-opening a FINAL game (final → live/pregame) requires the `editor` role
// (scoring-reopen is editor-only); a scorekeeper gets { ok: false, error }.
export async function setGameState(
  op: SetGameStateOp | Omit<SetGameStateOp, "seq">,
): Promise<ActionResult> {
  const caller = await authorize();
  if (!caller) return fail(SIGNED_OUT);
  if (!isObject(op)) return fail("That game change isn't valid.");
  const { state, currentInning } = op;
  const shapeOk =
    state === "pregame"
      ? currentInning === null
      : (state === "live" || state === "final") && isInning(currentInning);
  if (!shapeOk) return fail("That game change isn't valid.");
  const loaded = await loadGame(op.gameId);
  if ("result" in loaded) return loaded.result;
  if (loaded.game.state === "final" && state !== "final" && !caller.isEditor) {
    return fail("This game is over. Only an editor can reopen it.");
  }
  return write(() =>
    saveGameState({ kind: "setGameState", gameId: loaded.game.id, state, currentInning }),
  );
}

const BATTING_KEYS = ["ab", "r", "h", "doubles", "triples", "hr", "rbi", "bb", "so", "sb"] as const;
const PITCHING_KEYS = ["outsPitched", "h", "r", "er", "bb", "so"] as const;

// A well-formed StatLineInput (exact keys copied, bounded integers), or null.
function parseLine(v: unknown): StatLineInput | null {
  if (!isObject(v)) return null;
  const line = {} as Record<string, unknown>;
  for (const k of BATTING_KEYS) {
    if (!isCount(v[k])) return null;
    line[k] = v[k];
  }
  if (v.pitching === null) {
    line.pitching = null;
  } else {
    const p = v.pitching;
    if (!isObject(p)) return null;
    const pitching = {} as Record<string, unknown>;
    for (const k of PITCHING_KEYS) {
      if (!isCount(p[k])) return null;
      pitching[k] = p[k];
    }
    line.pitching = pitching;
  }
  return line as unknown as StatLineInput;
}

// Validates: playerId is an ACTIVE player of a USVI side of this game; the line passes
// validateStatLine (lib/schedule-view) — its message becomes `error` (e.g. H above AB).
export async function setStatLine(
  op: SetStatLineOp | Omit<SetStatLineOp, "seq">,
): Promise<ActionResult> {
  const caller = await authorize();
  if (!caller) return fail(SIGNED_OUT);
  if (!isObject(op) || typeof op.playerId !== "string" || !UUID.test(op.playerId)) {
    return fail("We couldn't find that player.");
  }
  const line = parseLine(op.line);
  if (!line) return fail("Those numbers aren't valid.");
  const check = validateStatLine(line);
  if (!check.ok) return fail(check.message);
  const loaded = await loadGame(op.gameId, true);
  if ("result" in loaded) return loaded.result;
  if (!loaded.game.activeUsviPlayers.has(op.playerId)) {
    return fail("That player isn't on the USVI roster for this game.");
  }
  return write(() =>
    saveStatLine({ kind: "setStatLine", gameId: loaded.game.id, playerId: op.playerId, line }),
  );
}

// Validates: the game is a USVI game; playerIds unique, each an ACTIVE player of the USVI
// side. Refuses (no write) if it would remove a player whose line has non-zero stats.
export async function setLineup(
  op: SetLineupOp | Omit<SetLineupOp, "seq">,
): Promise<ActionResult> {
  const caller = await authorize();
  if (!caller) return fail(SIGNED_OUT);
  if (
    !isObject(op) ||
    !Array.isArray(op.playerIds) ||
    op.playerIds.length > MAX_LINEUP ||
    !op.playerIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    new Set(op.playerIds).size !== op.playerIds.length
  ) {
    return fail("That lineup isn't valid.");
  }
  const playerIds = op.playerIds as string[];
  const loaded = await loadGame(op.gameId, true);
  if ("result" in loaded) return loaded.result;
  const game = loaded.game;
  if (game.usviTeamIds.length === 0) return fail("Lineups are only kept for USVI games.");
  if (!playerIds.every((id) => game.activeUsviPlayers.has(id))) {
    return fail("Someone in that lineup isn't on the USVI roster for this game.");
  }
  const keep = new Set(playerIds);
  for (const [id, existing] of game.statLines) {
    // A zero line may be removed by a scorekeeper too (0028 RLS); one with stats never is.
    if (!keep.has(id) && !isZeroLine(existing)) {
      return fail("A player who already has stats can't be taken off. Clear their stats first.");
    }
  }
  return write(() => saveLineup({ kind: "setLineup", gameId: game.id, playerIds }));
}

// Queue-replay convenience: dispatches on op.kind to the matching action above (same auth +
// validation, since it calls them). An unknown kind returns { ok: false, error }.
export async function submitScoringOp(op: ScoringOp | ScoringOpDraft): Promise<ActionResult> {
  if (!isObject(op)) return fail("That change isn't valid.");
  switch (op.kind) {
    case "setInningRuns":
      return setInningRuns(op);
    case "setTeamTotals":
      return setTeamTotals(op);
    case "setGameState":
      return setGameState(op);
    case "setStatLine":
      return setStatLine(op);
    case "setLineup":
      return setLineup(op);
    default:
      return fail("That change isn't valid.");
  }
}
