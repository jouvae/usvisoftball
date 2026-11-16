import {
  isUsviGame,
  localDateKey,
  type BattingLine,
  type EventDetail,
  type EventWithGame,
  type Game,
  type GameState,
  type GameWithTeams,
  type Inning,
  type Side,
  type StatLineInput,
} from "@/lib/schedule-view";

// ---------------------------------------------------------------------------
// Feature softball/schedule, Slice S4 — scorekeeper contract, CLIENT-SAFE half
// (overview.md §6.1). No `server-only`: Client Components (the scoring screen) and Vitest
// import this directly.
//
// Persistence model: the client never sends "+1". Every tap computes the NEW ABSOLUTE value
// locally and sends a SET operation, so replaying an op is harmless and the offline queue may
// retry freely. Undo = enqueue a set op restoring the previous value.
// ---------------------------------------------------------------------------

// ── Set operations ───────────────────────────────────────────────────────────────

// Fields every op carries. `seq` is the client sequence number stamped by the op queue —
// strictly increasing per game (survives reloads), used for FIFO replay and ack.
export interface ScoringOpBase {
  gameId: string;
  seq: number;
}

// Set one half-inning's runs (game_innings upsert on (game_id, inning, side)).
export interface SetInningRunsOp extends ScoringOpBase {
  kind: "setInningRuns";
  inning: number; // ≥ 1
  side: Side;
  runs: number; // ≥ 0, absolute
}

// Set a side's H and E (games.{side}_hits / {side}_errors).
export interface SetTeamTotalsOp extends ScoringOpBase {
  kind: "setTeamTotals";
  side: Side;
  hits: number; // ≥ 0, absolute
  errors: number; // ≥ 0, absolute
}

// Set game state + current inning (games.state / current_inning). Start game =
// { state: 'live', currentInning: 1 }; Final keeps the last inning.
export interface SetGameStateOp extends ScoringOpBase {
  kind: "setGameState";
  state: GameState;
  currentInning: number | null; // null only for 'pregame'
}

// Set one player's whole box-score line (game_player_stats upsert on (game_id, player_id)).
// `line.pitching === null` clears the pitching columns (did not pitch).
export interface SetStatLineOp extends ScoringOpBase {
  kind: "setStatLine";
  playerId: string;
  line: StatLineInput;
}

// Set who played: ensures a (zero) line exists for each id; removes lines of players NOT in
// the list only when that line is all-zero (a line with stats is never deleted — the action
// refuses with a plain-language error instead).
export interface SetLineupOp extends ScoringOpBase {
  kind: "setLineup";
  playerIds: string[];
}

// Discriminated on `kind`.
export type ScoringOp =
  | SetInningRunsOp
  | SetTeamTotalsOp
  | SetGameStateOp
  | SetStatLineOp
  | SetLineupOp;

// The op kinds, for exhaustive switches / validation.
export type ScoringOpKind = ScoringOp["kind"];

// Omit distributed over a union (plain Omit collapses the discriminant).
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// An op before the queue stamps its `seq` — what the UI hands to OpQueue.enqueue().
export type ScoringOpDraft = DistributiveOmit<ScoringOp, "seq">;

// What every scoring Server Action returns. Never throws to the client; `error` is a
// plain-language sentence safe to show the scorekeeper.
export type ActionResult = { ok: true } | { ok: false; error: string };

// ── Offline op queue ─────────────────────────────────────────────────────────────

// The subset of the Web Storage API the queue needs. `window.localStorage` satisfies it;
// Vitest passes an in-memory fake.
export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Per-game FIFO of pending ops, persisted in storage after every mutation.
export interface OpQueue {
  // Stamp `draft` with the next seq (strictly greater than any seq previously issued for
  // this game, including across reloads), append it, persist, and return the stamped op.
  // Throws if draft.gameId differs from the queue's gameId.
  enqueue(draft: ScoringOpDraft): ScoringOp;
  // The oldest pending op, or null when empty. Does not remove it.
  peek(): ScoringOp | null;
  // Remove the op with this seq (normally the head after a successful send). Unknown seq is
  // a no-op, so a duplicate ack is harmless.
  ack(seq: number): void;
  // Number of pending ops.
  size(): number;
  // Every pending op, oldest first (a copy) — the screen re-applies them over server state.
  list(): ScoringOp[];
}

// Storage key prefix; the queue for game G lives at `${SCORING_QUEUE_KEY_PREFIX}${G}`.
export const SCORING_QUEUE_KEY_PREFIX = "scoring-queue:";

// Create (or rehydrate from `storage`) the queue for `gameId`. Pure apart from the injected
// storage; corrupt stored JSON is treated as an empty queue.
export function createOpQueue(storage: QueueStorage, gameId: string): OpQueue {
  const key = `${SCORING_QUEUE_KEY_PREFIX}${gameId}`;
  let { ops, lastSeq } = readStoredQueue(storage, key, gameId);

  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify({ lastSeq, ops } satisfies StoredQueue));
    } catch {
      // Storage full / unavailable: the in-memory queue still works for this page view.
    }
  };

  return {
    enqueue(draft) {
      if (draft.gameId !== gameId) {
        throw new Error(`OpQueue for game ${gameId} refused an op for game ${draft.gameId}`);
      }
      lastSeq += 1;
      const op = { ...draft, seq: lastSeq } as ScoringOp;
      ops = [...ops, op];
      persist();
      return op;
    },
    peek() {
      return ops[0] ?? null;
    },
    ack(seq) {
      const next = ops.filter((o) => o.seq !== seq);
      if (next.length === ops.length) return;
      ops = next;
      persist();
    },
    size() {
      return ops.length;
    },
    list() {
      return [...ops];
    },
  };
}

// What the queue persists: the pending ops plus the highest seq ever issued, so seq keeps
// increasing after the queue drains and the page reloads.
interface StoredQueue {
  lastSeq: number;
  ops: ScoringOp[];
}

const OP_KINDS: readonly ScoringOpKind[] = [
  "setInningRuns",
  "setTeamTotals",
  "setGameState",
  "setStatLine",
  "setLineup",
];

function isStoredOp(v: unknown, gameId: string): v is ScoringOp {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.gameId === gameId &&
    Number.isInteger(o.seq) &&
    typeof o.kind === "string" &&
    (OP_KINDS as readonly string[]).includes(o.kind)
  );
}

// Corrupt / foreign JSON → an empty queue (never throws).
function readStoredQueue(storage: QueueStorage, key: string, gameId: string): StoredQueue {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw == null) return { lastSeq: 0, ops: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { lastSeq: 0, ops: [] };
  }
  if (parsed == null || typeof parsed !== "object" || !Array.isArray((parsed as StoredQueue).ops)) {
    return { lastSeq: 0, ops: [] };
  }
  const ops = (parsed as StoredQueue).ops
    .filter((o) => isStoredOp(o, gameId))
    .sort((a, b) => a.seq - b.seq);
  const stored = (parsed as StoredQueue).lastSeq;
  const lastSeq = Math.max(Number.isInteger(stored) ? stored : 0, ...ops.map((o) => o.seq), 0);
  return { lastSeq, ops };
}

// ── Optimistic local state ───────────────────────────────────────────────────────

// What the scoring screen holds and renders optimistically. `statLines` is keyed by
// playerId (a key present = the player played).
export interface ScoringState
  extends Pick<
    Game,
    "id" | "state" | "currentInning" | "awayHits" | "awayErrors" | "homeHits" | "homeErrors"
  > {
  innings: Inning[];
  statLines: Record<string, StatLineInput>;
}

// Return a NEW state with `op` applied (never mutates `state`). Same semantics as the server:
// set ops overwrite absolute values; setLineup adds zero lines for new ids and drops only
// all-zero lines for absent ids. An op for a different game id returns `state` unchanged.
export function applyOp(state: ScoringState, op: ScoringOp | ScoringOpDraft): ScoringState {
  if (op.gameId !== state.id) return state;
  switch (op.kind) {
    case "setGameState":
      return { ...state, state: op.state, currentInning: op.currentInning };
    case "setInningRuns": {
      const cell: Inning = { inning: op.inning, side: op.side, runs: op.runs };
      const others = state.innings.filter((c) => !(c.inning === op.inning && c.side === op.side));
      const innings = [...others, cell].sort(
        (a, b) => a.inning - b.inning || (a.side === b.side ? 0 : a.side === "away" ? -1 : 1),
      );
      return { ...state, innings };
    }
    case "setTeamTotals":
      return op.side === "away"
        ? { ...state, awayHits: op.hits, awayErrors: op.errors }
        : { ...state, homeHits: op.hits, homeErrors: op.errors };
    case "setStatLine":
      return { ...state, statLines: { ...state.statLines, [op.playerId]: cloneLine(op.line) } };
    case "setLineup": {
      const keep = new Set(op.playerIds);
      const statLines: Record<string, StatLineInput> = {};
      for (const [id, line] of Object.entries(state.statLines)) {
        if (keep.has(id) || !isZeroLine(line)) statLines[id] = line;
      }
      for (const id of op.playerIds) statLines[id] ??= zeroStatLine();
      return { ...state, statLines };
    }
  }
}

function cloneLine(line: StatLineInput): StatLineInput {
  return { ...line, pitching: line.pitching ? { ...line.pitching } : null };
}

// The stat sheet's batting steppers, in scorebook order (polish 2026-11-15): the counting stats a
// scorekeeper taps most — AB H R RBI BB SO — then the extra-base hits and steals.
export const BATTING_FIELDS: readonly { key: keyof BattingLine; label: string }[] = [
  { key: "ab", label: "At bats" },
  { key: "h", label: "Hits" },
  { key: "r", label: "Runs" },
  { key: "rbi", label: "Runs batted in" },
  { key: "bb", label: "Walks" },
  { key: "so", label: "Strikeouts" },
  { key: "doubles", label: "Doubles" },
  { key: "triples", label: "Triples" },
  { key: "hr", label: "Home runs" },
  { key: "sb", label: "Stolen bases" },
];

// A fresh all-zero batting line that did not pitch — what a lineup check creates.
export function zeroStatLine(): StatLineInput {
  return { ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, so: 0, sb: 0, pitching: null };
}

// True when the line records nothing (every batting stat 0 and no pitching, or all-zero
// pitching). Only such a line may be dropped from the lineup.
export function isZeroLine(line: StatLineInput): boolean {
  const { pitching, ...batting } = line;
  if (Object.values(batting).some((v) => v !== 0)) return false;
  return pitching == null || Object.values(pitching).every((v) => v === 0);
}

// ── Read shapes for the scoring pages ────────────────────────────────────────────

// A /admin/scoring list row — always a game event.
export type ScoringGameRow = EventWithGame & { game: GameWithTeams };

// Everything /admin/scoring/[slug] renders (rosters = active players, statLines = box score).
export type ScoringGameDetail = EventDetail & { game: GameWithTeams };

// Order rows for /admin/scoring relative to `nowIso`: today's games (venue-local date of
// each row's timezone) first, then upcoming, then recent finals; within a day, games
// involving USVI first, then by start time. Pure; does not filter.
export function orderScoringGames(
  rows: readonly ScoringGameRow[],
  nowIso: string,
): ScoringGameRow[] {
  const keyed = rows.map((row) => {
    const day = localDateKey(row.startsAt, row.timezone);
    return { row, day, group: scoringDayGroup(row, nowIso), usvi: isUsviGame(row.game) ? 0 : 1 };
  });
  keyed.sort((a, b) => {
    if (a.group !== b.group) return GROUP_RANK[a.group] - GROUP_RANK[b.group];
    const past = a.group === "past" ? -1 : 1; // past days: most recent first
    if (a.day !== b.day) return a.day < b.day ? -past : past;
    if (a.usvi !== b.usvi) return a.usvi - b.usvi;
    const t = Date.parse(a.row.startsAt) - Date.parse(b.row.startsAt);
    if (t !== 0) return past * t;
    return a.row.sortOrder - b.row.sortOrder || a.row.slug.localeCompare(b.row.slug);
  });
  return keyed.map((k) => k.row);
}

const GROUP_RANK = { today: 0, upcoming: 1, past: 2 } as const;

// Which /admin/scoring section a row belongs to, by its venue-local date vs `nowIso`'s.
export function scoringDayGroup(
  row: Pick<ScoringGameRow, "startsAt" | "timezone">,
  nowIso: string,
): "today" | "upcoming" | "past" {
  const day = localDateKey(row.startsAt, row.timezone);
  const today = localDateKey(nowIso, row.timezone);
  return day === today ? "today" : day > today ? "upcoming" : "past";
}
