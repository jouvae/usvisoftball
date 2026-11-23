// Feature softball/schedule — 2026 Central American and Caribbean Games (Santo Domingo) women's
// softball results (scenario schedule-db-003). Pure data, no Supabase: imported by
// scripts/seed-cacg.ts and pinned to the report's own totals in tests/unit/cacg-fixtures.test.ts.
//
// Source: WBSC Americas Softball daily report NR. 6 (July 31, 2026) — schedule, line scores and
// box scores for games 1–20. Times are Santo Domingo local (UTC−4). "A@B" = A away, B home.
// Line scores are as printed (the report prints 0, not X, for an unplayed bottom half).
// Box scores: USVI only (D6 — opponent box scores await the board's decision). Games 21–22
// (bronze, gold) are in the report with no result yet; the final ranking lists Puerto Rico
// 1st, USVI 2nd, Dominican Republic 3rd, Mexico 4th.
import type { PitchingLine, StatLineInput } from "../schedule-view";

export const CACG_TOURNAMENT_SLUG = "2026-central-american-and-caribbean-games-softball";

export const CACG_TOURNAMENT = {
  name: "2026 Central American and Caribbean Games — Women's Softball",
  name_es: "Juegos Centroamericanos y del Caribe 2026 — Sóftbol Femenino",
  description:
    "Women's softball at the XXV Central American and Caribbean Games in Santo Domingo, " +
    "Dominican Republic. The U.S. Virgin Islands reached the gold medal game and finished second of eight.",
  description_es:
    "Sóftbol femenino en los XXV Juegos Centroamericanos y del Caribe en Santo Domingo, " +
    "República Dominicana. Islas Vírgenes de EE. UU. llegó al juego por el oro y terminó segunda de ocho.",
  city: "Santo Domingo",
  country_code: "DO",
  timezone: "America/Santo_Domingo",
  announced_start: null,
  announced_end: null,
} as const;

export const CACG_VENUE = "Centro Olímpico Juan Pablo Duarte — Stadium 2";

// The existing USVI women's national team (country_code 'VI').
export const CACG_USVI_TEAM_SLUG = "womens-national-team";

// The 7 guest opponents (ISO alpha-2).
export const CACG_GUEST_COUNTRIES = ["PR", "DO", "MX", "VE", "CU", "SV", "GT"] as const;

export const CACG_GUEST_DIVISION = "Women's";

// USVI roster as listed on the report's team page (jersey numbers) with each player's most
// frequent position in the box scores.
export const CACG_USVI_ROSTER: readonly { name: string; jersey: number; position: string }[] = [
  { name: "Amanda Thompson", jersey: 1, position: "P" },
  { name: "Taylor White", jersey: 2, position: "RF" },
  { name: "Alexis Hastings", jersey: 4, position: "LF" },
  { name: "Alexandrea Brown", jersey: 8, position: "2B" },
  { name: "Emily Legette", jersey: 9, position: "1B" },
  { name: "Autumn Owen", jersey: 11, position: "C" },
  { name: "Alexis Handley", jersey: 14, position: "P" },
  { name: "T. Edwards", jersey: 15, position: "SS" },
  { name: "H. Cripe", jersey: 18, position: "3B" },
  { name: "Sanaa Thompson", jersey: 19, position: "CF" },
  { name: "Jada Lavon Cooper", jersey: 21, position: "DP" },
  { name: "Molly Katherine Yoo", jersey: 23, position: "P" },
  { name: "Emily Kepple", jersey: 32, position: "C" },
  { name: "Renee Christian", jersey: 41, position: "RF" },
  { name: "Courtney Wyche", jersey: 42, position: "P" },
];

export interface CacgStatLine extends StatLineInput {
  player: string; // CACG_USVI_ROSTER name
}

export interface CacgGame {
  no: number; // game number in the report
  date: string; // venue-local 'YYYY-MM-DD'
  time: string; // venue-local 'HH:MM'
  durationMin: number | null; // "Time:" in the box score; null = not played
  round: string; // dictionary key
  away: string; // ISO alpha-2
  home: string;
  result: {
    awayInnings: number[]; // runs per inning, as printed
    homeInnings: number[];
    awayHits: number;
    awayErrors: number;
    homeHits: number;
    homeErrors: number;
  } | null; // null = no result in the report
  usvi: CacgStatLine[];
}

function pit(outsPitched: number, h: number, r: number, er: number, bb: number, so: number): PitchingLine {
  return { outsPitched, h, r, er, bb, so };
}

function bat(
  player: string,
  ab: number, r: number, h: number, doubles: number, triples: number, hr: number,
  rbi: number, bb: number, so: number, sb: number,
  pitching: PitchingLine | null = null,
): CacgStatLine {
  return { player, ab, r, h, doubles, triples, hr, rbi, bb, so, sb, pitching };
}

export const CACG_GAMES: readonly CacgGame[] = [
  {
    no: 1, date: "2026-07-26", time: "12:00", durationMin: 119, round: "opening_round",
    away: "PR", home: "GT",
    result: {
      awayInnings: [0, 7, 0, 8], homeInnings: [0, 0, 0, 0],
      awayHits: 8, awayErrors: 0, homeHits: 1, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 2, date: "2026-07-26", time: "14:30", durationMin: 128, round: "opening_round",
    away: "VI", home: "CU",
    result: {
      awayInnings: [4, 0, 0, 0, 1, 0, 2], homeInnings: [0, 0, 0, 0, 0, 0, 0],
      awayHits: 13, awayErrors: 3, homeHits: 4, homeErrors: 1,
    },
    usvi: [
      bat("Sanaa Thompson", 3, 2, 1, 1, 0, 0, 0, 1, 0, 0),
      bat("Alexis Hastings", 4, 0, 2, 0, 0, 0, 0, 0, 0, 1),
      bat("Emily Legette", 4, 1, 3, 0, 0, 0, 3, 0, 0, 0),
      bat("Jada Lavon Cooper", 4, 1, 2, 0, 0, 1, 3, 0, 0, 0),
      bat("H. Cripe", 3, 0, 0, 0, 0, 0, 0, 1, 0, 0),
      bat("T. Edwards", 3, 1, 1, 0, 0, 0, 0, 0, 1, 0),
      bat("Emily Kepple", 2, 0, 1, 0, 1, 0, 1, 1, 0, 0),
      bat("Autumn Owen", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      bat("Alexandrea Brown", 3, 0, 1, 0, 0, 0, 0, 0, 0, 0),
      bat("Renee Christian", 3, 2, 2, 0, 0, 0, 0, 0, 1, 0),
      bat("Alexis Handley", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(15, 4, 0, 0, 0, 4)),
      bat("Courtney Wyche", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(6, 0, 0, 0, 0, 3)),
    ],
  },
  {
    no: 3, date: "2026-07-26", time: "17:00", durationMin: 100, round: "opening_round",
    away: "SV", home: "MX",
    result: {
      awayInnings: [0, 0, 0, 0, 0, 0, 0], homeInnings: [1, 1, 1, 1, 0, 2, 0],
      awayHits: 1, awayErrors: 1, homeHits: 10, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 4, date: "2026-07-26", time: "19:30", durationMin: 124, round: "opening_round",
    away: "DO", home: "VE",
    result: {
      awayInnings: [2, 2, 0, 3, 0, 3], homeInnings: [1, 0, 1, 0, 0, 0],
      awayHits: 11, awayErrors: 2, homeHits: 6, homeErrors: 2,
    },
    usvi: [],
  },
  {
    no: 5, date: "2026-07-27", time: "09:00", durationMin: 74, round: "opening_round",
    away: "SV", home: "VI",
    result: {
      awayInnings: [0, 0, 0], homeInnings: [10, 5, 0],
      awayHits: 1, awayErrors: 1, homeHits: 12, homeErrors: 1,
    },
    usvi: [
      bat("Sanaa Thompson", 2, 2, 1, 0, 0, 0, 2, 1, 0, 1),
      bat("Alexis Hastings", 3, 2, 2, 0, 0, 0, 2, 0, 0, 3),
      bat("Emily Legette", 3, 3, 2, 1, 1, 0, 2, 0, 0, 0),
      bat("Jada Lavon Cooper", 2, 0, 2, 1, 0, 0, 3, 0, 0, 0),
      bat("Taylor White", 2, 2, 2, 0, 0, 0, 3, 0, 0, 0),
      bat("H. Cripe", 3, 1, 1, 0, 0, 1, 2, 0, 1, 0),
      bat("T. Edwards", 1, 1, 0, 0, 0, 0, 0, 1, 0, 0),
      bat("Autumn Owen", 2, 1, 0, 0, 0, 0, 0, 0, 0, 0),
      bat("Alexandrea Brown", 1, 2, 1, 0, 0, 0, 0, 1, 0, 1),
      bat("Renee Christian", 1, 1, 1, 0, 0, 0, 0, 0, 0, 0),
      bat("Molly Katherine Yoo", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(9, 1, 0, 0, 0, 4)),
    ],
  },
  {
    no: 6, date: "2026-07-27", time: "11:30", durationMin: 101, round: "opening_round",
    away: "VE", home: "GT",
    result: {
      awayInnings: [1, 2, 7, 1], homeInnings: [1, 0, 0, 0],
      awayHits: 14, awayErrors: 0, homeHits: 2, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 7, date: "2026-07-27", time: "17:00", durationMin: 127, round: "opening_round",
    away: "CU", home: "MX",
    result: {
      awayInnings: [0, 0, 1, 3, 0, 0, 0], homeInnings: [0, 2, 3, 1, 0, 0, 0],
      awayHits: 7, awayErrors: 0, homeHits: 7, homeErrors: 3,
    },
    usvi: [],
  },
  {
    no: 8, date: "2026-07-27", time: "19:30", durationMin: 78, round: "opening_round",
    away: "DO", home: "PR",
    result: {
      awayInnings: [0, 1, 0], homeInnings: [3, 4, 9],
      awayHits: 1, awayErrors: 3, homeHits: 12, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 9, date: "2026-07-28", time: "09:00", durationMin: 159, round: "opening_round",
    away: "MX", home: "VI",
    result: {
      awayInnings: [0, 0, 3, 0, 0, 0, 0], homeInnings: [0, 1, 2, 0, 3, 0, 0],
      awayHits: 5, awayErrors: 0, homeHits: 12, homeErrors: 3,
    },
    usvi: [
      bat("Sanaa Thompson", 4, 0, 1, 0, 0, 0, 0, 0, 1, 0),
      bat("Alexis Hastings", 4, 1, 1, 0, 0, 1, 1, 0, 1, 0),
      bat("Emily Legette", 3, 1, 2, 0, 0, 0, 0, 1, 0, 0),
      bat("Jada Lavon Cooper", 4, 2, 2, 0, 1, 0, 0, 0, 1, 0),
      bat("H. Cripe", 3, 1, 2, 0, 0, 0, 1, 0, 0, 0),
      bat("T. Edwards", 3, 0, 2, 0, 0, 0, 1, 0, 0, 0),
      bat("Taylor White", 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
      bat("Emily Kepple", 3, 0, 0, 0, 0, 0, 0, 0, 1, 0),
      bat("Autumn Owen", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      bat("Alexandrea Brown", 3, 0, 1, 0, 0, 0, 2, 0, 1, 1),
      bat("Renee Christian", 3, 1, 1, 0, 1, 0, 0, 0, 0, 0),
      bat("Amanda Thompson", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(6, 2, 0, 0, 0, 3)),
      bat("Molly Katherine Yoo", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(3, 3, 3, 1, 0, 0)),
      bat("Alexis Handley", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(6, 0, 0, 0, 0, 1)),
      bat("Courtney Wyche", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(6, 0, 0, 0, 2, 3)),
    ],
  },
  {
    no: 10, date: "2026-07-28", time: "11:30", durationMin: 116, round: "opening_round",
    away: "CU", home: "SV",
    result: {
      awayInnings: [0, 0, 0, 3, 1, 0, 2], homeInnings: [0, 0, 0, 0, 0, 0, 0],
      awayHits: 9, awayErrors: 0, homeHits: 6, homeErrors: 3,
    },
    usvi: [],
  },
  {
    no: 11, date: "2026-07-28", time: "17:00", durationMin: 102, round: "opening_round",
    away: "PR", home: "VE",
    result: {
      awayInnings: [0, 1, 0, 0, 0, 1, 1], homeInnings: [0, 0, 0, 0, 0, 0, 0],
      awayHits: 9, awayErrors: 0, homeHits: 0, homeErrors: 3,
    },
    usvi: [],
  },
  {
    no: 12, date: "2026-07-28", time: "19:30", durationMin: 138, round: "opening_round",
    away: "GT", home: "DO",
    result: {
      awayInnings: [1, 0, 0, 0, 0, 1, 0], homeInnings: [2, 0, 0, 1, 0, 1, 0],
      awayHits: 2, awayErrors: 3, homeHits: 7, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 13, date: "2026-07-29", time: "09:00", durationMin: 73, round: "placement_round",
    away: "GT", home: "CU",
    result: {
      awayInnings: [0, 0, 0, 0], homeInnings: [1, 0, 4, 5],
      awayHits: 1, awayErrors: 2, homeHits: 12, homeErrors: 0,
    },
    usvi: [],
  },
  {
    no: 14, date: "2026-07-29", time: "11:30", durationMin: 92, round: "placement_round",
    away: "SV", home: "VE",
    result: {
      awayInnings: [0, 0, 0, 0, 1], homeInnings: [0, 3, 0, 0, 5],
      awayHits: 3, awayErrors: 0, homeHits: 8, homeErrors: 0,
    },
    usvi: [],
  },
  {
    no: 15, date: "2026-07-29", time: "17:00", durationMin: 180, round: "super_round",
    away: "VI", home: "PR",
    result: {
      awayInnings: [3, 2, 0, 2, 0, 1, 0, 1], homeInnings: [0, 1, 2, 3, 0, 2, 0, 2],
      awayHits: 12, awayErrors: 1, homeHits: 10, homeErrors: 0,
    },
    usvi: [
      bat("Sanaa Thompson", 5, 2, 3, 1, 0, 1, 1, 0, 1, 0),
      bat("Alexis Hastings", 3, 3, 1, 0, 0, 0, 0, 0, 0, 0),
      bat("Emily Legette", 4, 2, 3, 0, 0, 0, 3, 1, 0, 1),
      bat("H. Cripe", 4, 0, 1, 1, 0, 0, 2, 0, 1, 0),
      bat("Amanda Thompson", 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, pit(2, 1, 2, 2, 4, 0)),
      bat("Autumn Owen", 2, 0, 0, 0, 0, 0, 0, 1, 1, 0),
      bat("T. Edwards", 4, 0, 2, 0, 0, 0, 2, 1, 1, 0),
      bat("Taylor White", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      bat("Emily Kepple", 5, 0, 0, 0, 0, 0, 0, 0, 1, 0),
      bat("Alexandrea Brown", 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      bat("Renee Christian", 4, 2, 2, 0, 0, 0, 0, 0, 0, 0),
      bat("Alexis Handley", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(6, 1, 1, 1, 2, 0)),
      bat("Courtney Wyche", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(14, 8, 7, 6, 3, 3)),
    ],
  },
  {
    no: 16, date: "2026-07-29", time: "19:30", durationMin: 136, round: "super_round",
    away: "MX", home: "DO",
    result: {
      awayInnings: [2, 0, 1, 0, 1, 0, 0], homeInnings: [0, 3, 0, 0, 0, 2, 0],
      awayHits: 7, awayErrors: 3, homeHits: 7, homeErrors: 3,
    },
    usvi: [],
  },
  {
    no: 17, date: "2026-07-30", time: "09:00", durationMin: 136, round: "placement_round",
    away: "GT", home: "SV",
    result: {
      awayInnings: [0, 1, 0, 0, 1, 0, 0], homeInnings: [0, 1, 1, 0, 4, 1, 0],
      awayHits: 7, awayErrors: 5, homeHits: 10, homeErrors: 0,
    },
    usvi: [],
  },
  {
    no: 18, date: "2026-07-30", time: "11:30", durationMin: 106, round: "placement_round",
    away: "VE", home: "CU",
    result: {
      awayInnings: [0, 0, 0, 0, 0, 0, 2], homeInnings: [0, 0, 0, 0, 0, 0, 0],
      awayHits: 7, awayErrors: 1, homeHits: 2, homeErrors: 1,
    },
    usvi: [],
  },
  {
    no: 19, date: "2026-07-30", time: "17:00", durationMin: 179, round: "super_round",
    away: "MX", home: "PR",
    result: {
      awayInnings: [0, 0, 0, 0, 2, 0, 0, 1, 2], homeInnings: [0, 0, 0, 0, 2, 0, 0, 1, 3],
      awayHits: 7, awayErrors: 2, homeHits: 7, homeErrors: 2,
    },
    usvi: [],
  },
  {
    no: 20, date: "2026-07-30", time: "19:30", durationMin: 137, round: "super_round",
    away: "DO", home: "VI",
    result: {
      awayInnings: [0, 0, 2, 0, 1, 0], homeInnings: [0, 4, 2, 0, 3, 1],
      awayHits: 9, awayErrors: 4, homeHits: 10, homeErrors: 0,
    },
    usvi: [
      bat("Sanaa Thompson", 5, 1, 1, 0, 0, 0, 1, 0, 1, 0),
      bat("Alexis Hastings", 3, 1, 1, 0, 0, 0, 0, 2, 0, 2),
      bat("Emily Legette", 5, 0, 2, 0, 0, 0, 3, 0, 0, 0),
      bat("Jada Lavon Cooper", 2, 1, 1, 1, 0, 0, 1, 2, 0, 1),
      bat("H. Cripe", 3, 1, 1, 0, 0, 1, 2, 1, 1, 0),
      bat("T. Edwards", 3, 0, 0, 0, 0, 0, 0, 1, 0, 0),
      bat("Autumn Owen", 2, 2, 1, 0, 0, 0, 0, 2, 0, 0),
      bat("Alexandrea Brown", 3, 3, 3, 1, 0, 0, 0, 0, 0, 1),
      bat("Taylor White", 0, 1, 0, 0, 0, 0, 0, 1, 0, 1),
      bat("Renee Christian", 3, 0, 0, 0, 0, 0, 0, 0, 2, 0),
      bat("Molly Katherine Yoo", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(14, 7, 3, 3, 0, 1)),
      bat("Amanda Thompson", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(1, 0, 0, 0, 1, 0)),
      bat("Courtney Wyche", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pit(3, 2, 0, 0, 0, 0)),
    ],
  },
  {
    no: 21, date: "2026-07-31", time: "20:00", durationMin: null, round: "bronze",
    away: "MX", home: "DO",
    result: null,
    usvi: [],
  },
  {
    no: 22, date: "2026-07-31", time: "23:00", durationMin: null, round: "gold",
    away: "VI", home: "PR",
    result: null,
    usvi: [],
  },
];
