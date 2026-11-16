// Feature softball/schedule — slice S4 unit tests (overview.md §6.1, scenarios S4).
// Pure, client-safe scorekeeper helpers: the offline op queue (createOpQueue), the optimistic
// reducer (applyOp), the /admin/scoring ordering (orderScoringGames) and the admin home for a
// role list (homeForRoles). RED until lib/scoring-view.ts + lib/roles-view.ts are implemented.

import { describe, expect, it } from "vitest";
import {
  SCORING_QUEUE_KEY_PREFIX,
  applyOp,
  createOpQueue,
  orderScoringGames,
  type QueueStorage,
  type ScoringGameRow,
  type ScoringOpDraft,
  type ScoringState,
} from "@/lib/scoring-view";
import { homeForRoles } from "@/lib/roles-view";
import type { GameState, ScheduleTeam, StatLineInput } from "@/lib/schedule-view";

// ── helpers ──────────────────────────────────────────────────────────────────────

class MemoryStorage implements QueueStorage {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const P3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const runs = (gameId: string, inning: number, value: number): ScoringOpDraft => ({
  kind: "setInningRuns",
  gameId,
  inning,
  side: "away",
  runs: value,
});

function zeroLine(): StatLineInput {
  return { ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, so: 0, sb: 0, pitching: null };
}

function line(overrides: Partial<StatLineInput>): StatLineInput {
  return { ...zeroLine(), ...overrides };
}

function baseState(overrides: Partial<ScoringState> = {}): ScoringState {
  return {
    id: G1,
    state: "pregame",
    currentInning: null,
    awayHits: 0,
    awayErrors: 0,
    homeHits: 0,
    homeErrors: 0,
    innings: [],
    statLines: {},
    ...overrides,
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

// ── createOpQueue ─────────────────────────────────────────────────────────────────

describe("createOpQueue (offline FIFO, per game, persisted)", () => {
  it("starts empty", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    expect(q.size()).toBe(0);
    expect(q.peek()).toBeNull();
  });

  it("stamps strictly increasing seq numbers and keeps FIFO order", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    const a = q.enqueue(runs(G1, 1, 1));
    const b = q.enqueue(runs(G1, 1, 2));
    const c = q.enqueue(runs(G1, 1, 3));
    expect(b.seq).toBeGreaterThan(a.seq);
    expect(c.seq).toBeGreaterThan(b.seq);
    expect(a).toMatchObject({ kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 1 });
    expect(q.size()).toBe(3);
    expect(q.peek()).toEqual(a);
    q.ack(a.seq);
    expect(q.peek()).toEqual(b);
    q.ack(b.seq);
    expect(q.peek()).toEqual(c);
    q.ack(c.seq);
    expect(q.peek()).toBeNull();
    expect(q.size()).toBe(0);
  });

  it("peek does not remove", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    const a = q.enqueue(runs(G1, 1, 1));
    expect(q.peek()).toEqual(a);
    expect(q.peek()).toEqual(a);
    expect(q.size()).toBe(1);
  });

  it("ack removes only the op with that seq (not the head, not others)", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    const a = q.enqueue(runs(G1, 1, 1));
    const b = q.enqueue(runs(G1, 1, 2));
    const c = q.enqueue(runs(G1, 1, 3));
    q.ack(b.seq);
    expect(q.size()).toBe(2);
    expect(q.peek()).toEqual(a);
    q.ack(a.seq);
    expect(q.peek()).toEqual(c);
  });

  it("an unknown or duplicate ack is a harmless no-op", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    const a = q.enqueue(runs(G1, 1, 1));
    q.ack(a.seq + 1000);
    expect(q.size()).toBe(1);
    q.ack(a.seq);
    q.ack(a.seq);
    expect(q.size()).toBe(0);
  });

  it("persists under `${SCORING_QUEUE_KEY_PREFIX}${gameId}` and rehydrates pending ops in order", () => {
    const storage = new MemoryStorage();
    const q1 = createOpQueue(storage, G1);
    const a = q1.enqueue(runs(G1, 1, 1));
    const b = q1.enqueue(runs(G1, 2, 4));
    expect(storage.getItem(`${SCORING_QUEUE_KEY_PREFIX}${G1}`)).not.toBeNull();

    const q2 = createOpQueue(storage, G1);
    expect(q2.size()).toBe(2);
    expect(q2.peek()).toEqual(a);
    q2.ack(a.seq);
    expect(q2.peek()).toEqual(b);

    // The ack was persisted too.
    const q3 = createOpQueue(storage, G1);
    expect(q3.size()).toBe(1);
    expect(q3.peek()).toEqual(b);
  });

  it("seq keeps increasing across re-creation, even after the queue was drained", () => {
    const storage = new MemoryStorage();
    const q1 = createOpQueue(storage, G1);
    const a = q1.enqueue(runs(G1, 1, 1));
    const b = q1.enqueue(runs(G1, 1, 2));
    q1.ack(a.seq);
    q1.ack(b.seq);
    expect(q1.size()).toBe(0);

    const q2 = createOpQueue(storage, G1);
    const c = q2.enqueue(runs(G1, 1, 3));
    expect(c.seq).toBeGreaterThan(b.seq);

    const q3 = createOpQueue(storage, G1);
    const d = q3.enqueue(runs(G1, 1, 4));
    expect(d.seq).toBeGreaterThan(c.seq);
  });

  it("queues of different games are isolated", () => {
    const storage = new MemoryStorage();
    const q1 = createOpQueue(storage, G1);
    const q2 = createOpQueue(storage, G2);
    const a = q1.enqueue(runs(G1, 1, 1));
    q1.enqueue(runs(G1, 1, 2));
    const x = q2.enqueue(runs(G2, 3, 9));
    expect(q1.size()).toBe(2);
    expect(q2.size()).toBe(1);
    expect(q2.peek()).toEqual(x);
    q2.ack(x.seq);
    expect(q1.size()).toBe(2);
    expect(q1.peek()).toEqual(a);
    expect(createOpQueue(storage, G2).size()).toBe(0);
    expect(createOpQueue(storage, G1).size()).toBe(2);
  });

  it("refuses an op for another game", () => {
    const q = createOpQueue(new MemoryStorage(), G1);
    expect(() => q.enqueue(runs(G2, 1, 1))).toThrow();
    expect(q.size()).toBe(0);
  });

  it.each([
    ["not json", "{not json"],
    ["wrong shape", JSON.stringify({ hello: "world" })],
    ["null", "null"],
    ["a number", "42"],
  ])("corrupt stored value (%s) → empty queue, no crash, still usable", (_label, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(`${SCORING_QUEUE_KEY_PREFIX}${G1}`, raw);
    const q = createOpQueue(storage, G1);
    expect(q.size()).toBe(0);
    expect(q.peek()).toBeNull();
    const a = q.enqueue(runs(G1, 1, 1));
    expect(q.peek()).toEqual(a);
    expect(createOpQueue(storage, G1).size()).toBe(1);
  });

  it("every op kind round-trips through storage intact", () => {
    const storage = new MemoryStorage();
    const q = createOpQueue(storage, G1);
    const drafts: ScoringOpDraft[] = [
      { kind: "setInningRuns", gameId: G1, inning: 3, side: "home", runs: 2 },
      { kind: "setTeamTotals", gameId: G1, side: "away", hits: 4, errors: 1 },
      { kind: "setGameState", gameId: G1, state: "live", currentInning: 1 },
      {
        kind: "setStatLine",
        gameId: G1,
        playerId: P1,
        line: line({ ab: 3, h: 1, rbi: 1, pitching: { outsPitched: 14, h: 3, r: 2, er: 1, bb: 1, so: 5 } }),
      },
      { kind: "setLineup", gameId: G1, playerIds: [P1, P2] },
    ];
    const stamped = drafts.map((d) => q.enqueue(d));
    const q2 = createOpQueue(storage, G1);
    for (const op of stamped) {
      expect(q2.peek()).toEqual(op);
      q2.ack(op.seq);
    }
    expect(q2.size()).toBe(0);
  });
});

// ── applyOp ─────────────────────────────────────────────────────────────────────

describe("applyOp (optimistic reducer, immutable)", () => {
  it("setGameState sets state + current inning", () => {
    const s0 = deepFreeze(baseState());
    const s1 = applyOp(s0, { kind: "setGameState", gameId: G1, state: "live", currentInning: 1 });
    expect(s1.state).toBe("live");
    expect(s1.currentInning).toBe(1);
    expect(s0.state).toBe("pregame");
    expect(s0.currentInning).toBeNull();
    const s2 = applyOp(s1, { kind: "setGameState", gameId: G1, state: "final", currentInning: 7 });
    expect(s2).toMatchObject({ state: "final", currentInning: 7 });
  });

  it("setInningRuns creates a missing inning cell", () => {
    const s0 = deepFreeze(baseState());
    const s1 = applyOp(s0, { kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 1 });
    expect(s1.innings).toEqual([{ inning: 1, side: "away", runs: 1 }]);
    expect(s0.innings).toEqual([]);
  });

  it("setInningRuns updates an existing cell (absolute, no duplicate) and leaves other cells", () => {
    const s0 = deepFreeze(
      baseState({
        innings: [
          { inning: 1, side: "away", runs: 1 },
          { inning: 1, side: "home", runs: 3 },
        ],
      }),
    );
    const s1 = applyOp(s0, { kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 2 });
    expect(s1.innings).toHaveLength(2);
    expect(s1.innings).toContainEqual({ inning: 1, side: "away", runs: 2 });
    expect(s1.innings).toContainEqual({ inning: 1, side: "home", runs: 3 });
    // replaying the same set is idempotent
    const s2 = applyOp(s1, { kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 2 });
    expect(s2.innings).toEqual(s1.innings);
    // setting to 0 keeps a cell with 0 (undo restores an absolute value)
    const s3 = applyOp(s2, { kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 0 });
    const cell = s3.innings.find((c) => c.inning === 1 && c.side === "away");
    expect(cell?.runs ?? 0).toBe(0);
    expect(s0.innings).toContainEqual({ inning: 1, side: "away", runs: 1 });
  });

  it("setTeamTotals sets only that side's H and E", () => {
    const s0 = deepFreeze(baseState({ homeHits: 5, homeErrors: 2 }));
    const s1 = applyOp(s0, { kind: "setTeamTotals", gameId: G1, side: "away", hits: 3, errors: 1 });
    expect(s1).toMatchObject({ awayHits: 3, awayErrors: 1, homeHits: 5, homeErrors: 2 });
    const s2 = applyOp(s1, { kind: "setTeamTotals", gameId: G1, side: "home", hits: 0, errors: 0 });
    expect(s2).toMatchObject({ awayHits: 3, awayErrors: 1, homeHits: 0, homeErrors: 0 });
    expect(s0).toMatchObject({ awayHits: 0, awayErrors: 0, homeHits: 5, homeErrors: 2 });
  });

  it("setStatLine creates and overwrites the player's whole line", () => {
    const s0 = deepFreeze(baseState({ statLines: { [P2]: line({ ab: 2 }) } }));
    const l1 = line({ ab: 3, h: 1, rbi: 1 });
    const s1 = applyOp(s0, { kind: "setStatLine", gameId: G1, playerId: P1, line: l1 });
    expect(s1.statLines[P1]).toEqual(l1);
    expect(s1.statLines[P2]).toEqual(line({ ab: 2 }));
    const l2 = line({ ab: 4, h: 2, pitching: { outsPitched: 3, h: 0, r: 0, er: 0, bb: 0, so: 2 } });
    const s2 = applyOp(s1, { kind: "setStatLine", gameId: G1, playerId: P1, line: l2 });
    expect(s2.statLines[P1]).toEqual(l2);
    const s3 = applyOp(s2, { kind: "setStatLine", gameId: G1, playerId: P1, line: { ...l2, pitching: null } });
    expect(s3.statLines[P1].pitching).toBeNull();
    expect(s0.statLines[P1]).toBeUndefined();
  });

  it("setLineup adds zero lines for new players and keeps existing lines untouched", () => {
    const kept = line({ ab: 3, h: 1 });
    const s0 = deepFreeze(baseState({ statLines: { [P1]: kept } }));
    const s1 = applyOp(s0, { kind: "setLineup", gameId: G1, playerIds: [P1, P2] });
    expect(s1.statLines[P1]).toEqual(kept);
    expect(s1.statLines[P2]).toEqual(zeroLine());
    expect(Object.keys(s1.statLines).sort()).toEqual([P1, P2].sort());
    expect(Object.keys(s0.statLines)).toEqual([P1]);
  });

  it("setLineup drops all-zero lines of absent players but never a line with stats", () => {
    const withStats = line({ ab: 2 });
    const s0 = deepFreeze(baseState({ statLines: { [P1]: withStats, [P2]: zeroLine() } }));
    const s1 = applyOp(s0, { kind: "setLineup", gameId: G1, playerIds: [P3] });
    expect(s1.statLines[P1]).toEqual(withStats);
    expect(s1.statLines[P2]).toBeUndefined();
    expect(s1.statLines[P3]).toEqual(zeroLine());
  });

  it("accepts a stamped op (with seq) the same as a draft", () => {
    const s0 = deepFreeze(baseState());
    const s1 = applyOp(s0, { kind: "setInningRuns", gameId: G1, seq: 7, inning: 2, side: "home", runs: 1 });
    expect(s1.innings).toEqual([{ inning: 2, side: "home", runs: 1 }]);
  });

  it("an op for a different game leaves the state unchanged", () => {
    const s0 = deepFreeze(baseState());
    const snapshot = structuredClone(s0);
    const ops: ScoringOpDraft[] = [
      { kind: "setGameState", gameId: G2, state: "live", currentInning: 1 },
      { kind: "setInningRuns", gameId: G2, inning: 1, side: "away", runs: 3 },
      { kind: "setTeamTotals", gameId: G2, side: "home", hits: 1, errors: 1 },
      { kind: "setStatLine", gameId: G2, playerId: P1, line: line({ ab: 1 }) },
      { kind: "setLineup", gameId: G2, playerIds: [P1] },
    ];
    for (const op of ops) expect(applyOp(s0, op)).toEqual(snapshot);
  });

  it("never mutates the input for any op kind (deep-frozen input, snapshot unchanged)", () => {
    const s0 = deepFreeze(
      baseState({
        state: "live",
        currentInning: 2,
        innings: [{ inning: 1, side: "away", runs: 1 }],
        statLines: { [P1]: line({ ab: 1 }), [P2]: zeroLine() },
      }),
    );
    const snapshot = structuredClone(s0);
    const ops: ScoringOpDraft[] = [
      { kind: "setGameState", gameId: G1, state: "final", currentInning: 2 },
      { kind: "setInningRuns", gameId: G1, inning: 1, side: "away", runs: 4 },
      { kind: "setInningRuns", gameId: G1, inning: 2, side: "home", runs: 1 },
      { kind: "setTeamTotals", gameId: G1, side: "home", hits: 1, errors: 1 },
      { kind: "setStatLine", gameId: G1, playerId: P1, line: line({ ab: 2 }) },
      { kind: "setLineup", gameId: G1, playerIds: [P3] },
    ];
    for (const op of ops) {
      const next = applyOp(s0, op);
      expect(next).not.toBe(s0);
    }
    expect(s0).toEqual(snapshot);
  });
});

// ── orderScoringGames ────────────────────────────────────────────────────────────

const SV_TZ = "America/El_Salvador"; // UTC−6, no DST

function team(overrides: Partial<ScheduleTeam>): ScheduleTeam {
  return {
    id: "t",
    name: "Team",
    slug: "team",
    kind: "guest",
    shortName: "",
    countryCode: null,
    division: "",
    logoUrl: "",
    ...overrides,
  };
}

const USVI = team({ id: "vi", name: "USVI", slug: "usvi", kind: "national", countryCode: "VI" });
const CO = team({ id: "co", name: "Colombia", slug: "co", countryCode: "CO" });
const MX = team({ id: "mx", name: "Mexico", slug: "mx", countryCode: "MX" });

function row(
  slug: string,
  startsAt: string,
  opts: { usvi?: boolean; state?: GameState; timezone?: string } = {},
): ScoringGameRow {
  const away = opts.usvi ? USVI : CO;
  const home = MX;
  return {
    id: `ev-${slug}`,
    tournamentId: "tour",
    type: "game",
    slug,
    title: "",
    titleEs: "",
    startsAt,
    endsAt: null,
    venue: "Field",
    round: "opening_round",
    status: "scheduled",
    streamUrl: null,
    sortOrder: 0,
    timezone: opts.timezone ?? SV_TZ,
    tournament: { id: "tour", name: "Cup", nameEs: "Copa", slug: "cup" },
    game: {
      id: `g-${slug}`,
      eventId: `ev-${slug}`,
      awayTeamId: away.id,
      homeTeamId: home.id,
      state: opts.state ?? "pregame",
      currentInning: null,
      awayHits: 0,
      awayErrors: 0,
      homeHits: 0,
      homeErrors: 0,
      away,
      home,
      innings: [],
    },
  };
}

describe("orderScoringGames", () => {
  // 2026-11-21 14:00 in El Salvador.
  const NOW = "2026-11-21T20:00:00Z";

  const rows = {
    todayGuestFinal: row("today-0900-final", "2026-11-21T15:00:00Z", { state: "final" }),
    todayUsvi: row("today-1500-usvi", "2026-11-21T21:00:00Z", { usvi: true }),
    // 18:00 local on 11-21, but 2026-11-22 in UTC — still TODAY venue-local.
    todayLateGuest: row("today-1800", "2026-11-22T00:00:00Z"),
    upNextDayGuest: row("up-1122-0900", "2026-11-22T15:00:00Z"),
    upNextDayUsvi: row("up-1122-2100-usvi", "2026-11-23T03:00:00Z", { usvi: true }),
    upLaterGuest: row("up-1123-1200", "2026-11-23T18:00:00Z"),
    // 19:00 local on 11-20 (yesterday) though 2026-11-21 in UTC — NOT today.
    finalYesterday: row("final-1120", "2026-11-21T01:00:00Z", { state: "final" }),
    finalOlder: row("final-1119", "2026-11-19T21:00:00Z", { state: "final" }),
  };

  const expected = [
    "today-1500-usvi",
    "today-0900-final",
    "today-1800",
    "up-1122-2100-usvi",
    "up-1122-0900",
    "up-1123-1200",
    "final-1120",
    "final-1119",
  ];

  it("today (venue-local) first with USVI first, then upcoming asc (USVI first within a day), then recent finals desc", () => {
    const shuffled = [
      rows.finalOlder,
      rows.upLaterGuest,
      rows.todayLateGuest,
      rows.finalYesterday,
      rows.upNextDayGuest,
      rows.todayGuestFinal,
      rows.upNextDayUsvi,
      rows.todayUsvi,
    ];
    expect(orderScoringGames(shuffled, NOW).map((r) => r.slug)).toEqual(expected);
  });

  it("is stable regardless of input order and does not filter", () => {
    const all = Object.values(rows);
    const reversed = [...all].reverse();
    expect(orderScoringGames(all, NOW).map((r) => r.slug)).toEqual(expected);
    expect(orderScoringGames(reversed, NOW).map((r) => r.slug)).toEqual(expected);
    expect(orderScoringGames(all, NOW)).toHaveLength(all.length);
  });

  it("does not mutate the input array", () => {
    const input = Object.freeze([rows.finalOlder, rows.todayUsvi, rows.upNextDayGuest]);
    const before = input.map((r) => r.slug);
    const out = orderScoringGames(input, NOW);
    expect(input.map((r) => r.slug)).toEqual(before);
    expect(out).not.toBe(input);
  });

  it("uses each row's own timezone to decide 'today'", () => {
    // NOW is 16:00 on 11-21 in St Thomas (UTC−4). 2026-11-21T03:30Z is 23:30 on 11-20 there
    // (yesterday, though the UTC date is today); 22:00Z is 18:00 on 11-21 (today).
    const NOW_ATL = "2026-11-21T20:00:00Z";
    const atlToday = row("atl-today", "2026-11-21T22:00:00Z", { timezone: "America/St_Thomas" });
    const atlYesterdayFinal = row("atl-yday", "2026-11-21T03:30:00Z", {
      timezone: "America/St_Thomas",
      state: "final",
    });
    const atlTomorrow = row("atl-tomorrow", "2026-11-22T14:00:00Z", { timezone: "America/St_Thomas" });
    expect(
      orderScoringGames([atlYesterdayFinal, atlTomorrow, atlToday], NOW_ATL).map((r) => r.slug),
    ).toEqual(["atl-today", "atl-tomorrow", "atl-yday"]);
  });

  it("empty in → empty out", () => {
    expect(orderScoringGames([], NOW)).toEqual([]);
  });
});

// ── homeForRoles ─────────────────────────────────────────────────────────────────

describe("homeForRoles", () => {
  it.each<[string[], "/admin/scoring" | "/admin"]>([
    [["scorekeeper"], "/admin/scoring"],
    [["editor", "scorekeeper"], "/admin"],
    [["scorekeeper", "contributor"], "/admin"],
    [["contributor"], "/admin"],
    [["editor"], "/admin"],
    [[], "/admin"],
  ])("%j → %s", (roles, home) => {
    expect(homeForRoles(roles)).toBe(home);
  });
});
