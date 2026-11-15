// Feature softball/schedule — Pan Am opening-round seed data (overview §3) + the pure
// venue-local → UTC conversion the seed needs. Pure, no Supabase: imported by
// scripts/seed-panam.ts and unit-tested in tests/unit/panam-fixtures.test.ts.
//
// Source: the Federation flyers (WBSC Americas opening-round graphic). Times are El Salvador
// local. "A vs B" = A away, B home. Nothing from the team travel itinerary is stored here.

export const PANAM_TOURNAMENT_SLUG = "2026-pan-american-u18-womens-softball-championship";

export const PANAM_TOURNAMENT = {
  name: "2026 U18 Women's Pan American Softball Championship",
  name_es: "Campeonato Panamericano de Sóftbol Femenino Sub-18 2026",
  city: "San Salvador",
  country_code: "SV",
  timezone: "America/El_Salvador",
  announced_start: null,
  announced_end: null,
} as const;

export const PANAM_ROUND = "opening_round";

// The existing USVI U18 national team (country_code 'VI').
export const USVI_TEAM_SLUG = "u18-girls-national-team";

// The 17 guest opponents (ISO alpha-2).
export const PANAM_GUEST_COUNTRIES = [
  "CU", "SV", "AR", "NI", "HN", "PR", "CO", "MX", "GT", "VE", "US", "BR", "CA", "PE", "PA", "BS", "DO",
] as const;

export const GUEST_DIVISION = "U18 Women";

const B = "Saturnino Bengoa";
const G = "Ing. Pablo Arnoldo Guzmán";

export const PANAM_CEREMONY = {
  date: "2026-11-20",
  time: "18:30",
  venue: B,
  title: "Opening Ceremony",
  titleEs: "Ceremonia de inauguración",
} as const;

export interface PanamGame {
  date: string; // venue-local 'YYYY-MM-DD'
  time: string; // venue-local 'HH:MM'
  venue: string;
  away: string; // ISO alpha-2
  home: string;
}

const SLOTS = ["09:00", "12:00", "15:00", "18:00", "21:00"] as const;

// One day at one venue: five games at the standard slots, "AWAY-HOME" pairs in order.
function day(date: string, venue: string, pairs: readonly string[]): PanamGame[] {
  return pairs.map((pair, i) => {
    const [away, home] = pair.split("-");
    return { date, time: SLOTS[i], venue, away, home };
  });
}

export const PANAM_GAMES: readonly PanamGame[] = [
  { date: "2026-11-20", time: "19:00", venue: B, away: "CU", home: "SV" },
  { date: "2026-11-20", time: "21:00", venue: B, away: "AR", home: "NI" },
  ...day("2026-11-21", B, ["HN-PR", "NI-HN", "CO-VI", "MX-GT", "VE-AR"]),
  ...day("2026-11-21", G, ["US-BR", "CA-CU", "PE-PA", "BS-SV", "BS-DO"]),
  ...day("2026-11-22", B, ["PE-US", "SV-CA", "DO-CA", "CU-BS", "PA-BR"]),
  ...day("2026-11-22", G, ["MX-CO", "AR-HN", "NI-VE", "VE-PR", "VI-GT"]),
  ...day("2026-11-23", B, ["HN-VE", "VI-MX", "GT-CO", "PR-NI", "PR-AR"]),
  ...day("2026-11-23", G, ["CA-BS", "BR-PE", "US-PA", "SV-DO", "DO-CU"]),
];

// UTC offset (ms) of `timeZone` at instant `ms`.
function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// A venue-local wall-clock time ('YYYY-MM-DD', 'HH:MM') in an IANA zone → ISO UTC instant.
// e.g. ('2026-11-21', '15:00', 'America/El_Salvador') → '2026-11-21T21:00:00.000Z'.
export function localToUtcIso(date: string, time: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) throw new Error(`Invalid local date/time: ${date} ${time}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  // Two passes settle the offset across a DST edge; El Salvador has none.
  let ms = wall - zoneOffsetMs(wall, timeZone);
  ms = wall - zoneOffsetMs(ms, timeZone);
  return new Date(ms).toISOString();
}
