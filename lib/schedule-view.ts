// Feature softball/schedule — CLIENT-SAFE view types, constants + pure helpers.
//
// No `server-only`, no Supabase client — safe to import from Client Components (the events
// list, the event modal/drawer, the scorekeeper screens). lib/schedule.ts (server-only)
// re-exports every symbol here. Same split as lib/teams-view.ts / lib/events-view.ts.
//
// Model (overview §2, D1): a Tournament groups CalendarEvents; a Game is the sports data for
// exactly one event. Run totals and tournament dates are DERIVED here, never stored. Every
// helper is pure and timezone-explicit so server and client render identically (Vitest:
// tests/unit, scenarios schedule-unit-001..009).

import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import type { TeamKind, TeamPlayer } from "@/lib/teams-view";

export type { Locale };

// ── Constants ────────────────────────────────────────────────────────────────────

// The USVI's IANA zone (Atlantic Standard Time, UTC−4, no DST). USVI fans read times here.
export const ATLANTIC_TZ = "America/St_Thomas";

// Its label in every locale. The USVI never observes DST, so it is always "AST" (Intl 'es' would
// print "GMT-4", which fans don't read as USVI time).
export const ATLANTIC_LABEL = "AST";

// ISO 3166-1 alpha-2 code for the U.S. Virgin Islands — marks "our" teams and games.
export const USVI_COUNTRY = "VI";

// Regulation innings in softball: the line score's minimum column count and the ERA base.
export const SOFTBALL_INNINGS = 7;

// ── Enums (mirror the 0026 CHECKs — keep in lockstep) ────────────────────────────

// calendar_events.type
export type EventType = "game" | "ceremony" | "other";

// calendar_events.status
export type EventStatus = "scheduled" | "postponed" | "cancelled";

// games.state
export type GameState = "pregame" | "live" | "final";

// game_innings.side — "A vs B" on the flyer = A away, B home.
export type Side = "away" | "home";

// ── Rows (camelCase views of the 0026 tables) ────────────────────────────────────

// A tournament: a named group of events (0026 `tournaments`). Dates are derived (D2).
export interface Tournament {
  id: string;
  name: string;
  nameEs: string; // '' → fall back to name
  slug: string;
  description: string;
  descriptionEs: string; // '' → fall back to description
  city: string;
  countryCode: string | null;
  timezone: string; // IANA, venue-local (e.g. 'America/El_Salvador')
  logoUrl: string;
  coverImageUrl: string;
  streamUrl: string | null; // https only (0026 CHECK)
  announcedStart: string | null; // 'YYYY-MM-DD'; used only while there are no events
  announcedEnd: string | null;
  sortOrder: number;
}

// One thing on the calendar (0026 `calendar_events`). Games carry no game data here.
export interface CalendarEvent {
  id: string;
  tournamentId: string | null;
  type: EventType;
  slug: string;
  title: string; // non-games only; games are titled from their teams
  titleEs: string; // '' → fall back to title
  startsAt: string; // ISO timestamptz
  endsAt: string | null;
  venue: string;
  round: string; // dictionary KEY, e.g. 'opening_round'; '' = none
  status: EventStatus;
  streamUrl: string | null; // https only (0026 CHECK)
  sortOrder: number;
}

// The lightweight team shape the schedule renders (TeamBadge, names, flags, links).
export interface ScheduleTeam {
  id: string;
  name: string;
  slug: string;
  kind: TeamKind; // 'guest' = opponent (D5)
  shortName: string;
  countryCode: string | null; // ISO alpha-2; 'VI' for USVI national teams
  division: string;
  logoUrl: string; // USVI teams only in practice — no federation logos for guests (D5)
}

// The sports data for exactly one event (0026 `games`). R is derived from innings.
export interface Game {
  id: string;
  eventId: string;
  awayTeamId: string;
  homeTeamId: string;
  state: GameState;
  currentInning: number | null;
  awayHits: number;
  awayErrors: number;
  homeHits: number;
  homeErrors: number;
  // 0030 — optional totals. Runs are only read when the game has no innings (a result that
  // arrived as "8–5"); walks = drawn by that side's batters; strikeouts = by its pitchers.
  // null/undefined = not recorded.
  awayRuns?: number | null;
  homeRuns?: number | null;
  awayWalks?: number | null;
  homeWalks?: number | null;
  awayStrikeouts?: number | null;
  homeStrikeouts?: number | null;
}

// An editor-picked standout for a game (0030 `game_standouts`).
export type StandoutKind = "player_of_game" | "pitching" | "standout";
export interface GameStandout {
  id: string;
  gameId: string;
  teamId: string | null;
  kind: StandoutKind;
  playerName: string;
  statLine: string;
  note: string;
  sortOrder: number;
}

// One half-inning cell of the line score (0026 `game_innings`).
export interface Inning {
  inning: number; // ≥ 1
  side: Side;
  runs: number; // ≥ 0
}

// Batting columns of a stat line.
export interface BattingLine {
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
}

// Pitching columns of a stat line. Innings pitched is stored as OUTS (14 → "4⅔").
export interface PitchingLine {
  outsPitched: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
}

// One player's box-score line for one game (0026 `game_player_stats`). pitching null =
// did not pitch (outs_pitched IS NULL).
export interface PlayerStatLine extends BattingLine {
  id: string;
  gameId: string;
  playerId: string;
  teamId: string;
  pitching: PitchingLine | null;
}

// A stat line joined to its player for rendering (name, number, position).
export interface PlayerStatLineWithPlayer extends PlayerStatLine {
  player: Pick<TeamPlayer, "id" | "name" | "jerseyNumber" | "position">;
}

// ── Composites (what the server reads return) ────────────────────────────────────

// A game with both teams resolved and its line-score cells.
export interface GameWithTeams extends Game {
  away: ScheduleTeam;
  home: ScheduleTeam;
  innings: Inning[];
}

// A calendar event with its game (null for ceremonies/other) — the list/card row shape.
// `timezone` is the tournament's venue-local zone (ATLANTIC_TZ when no tournament).
export interface EventWithGame extends CalendarEvent {
  timezone: string;
  tournament: Pick<Tournament, "id" | "name" | "nameEs" | "slug"> | null;
  game: GameWithTeams | null;
}

// Everything the /events/[slug] page renders: event + game + teams + innings + box score +
// USVI rosters (active players only; guests have none → empty arrays).
export interface EventDetail extends EventWithGame {
  tournamentDetail: Tournament | null;
  statLines: PlayerStatLineWithPlayer[];
  rosters: Record<Side, TeamPlayer[]>;
}

// Derived R per side.
export interface RunTotals {
  away: number;
  home: number;
}

// A tournament's displayed window (D2). 'events' → ISO timestamps (first start, last
// coalesce(end,start)); 'announced' → 'YYYY-MM-DD' dates.
export interface TournamentWindow {
  start: string;
  end: string;
  source: "events" | "announced";
}

// Input to eventSlug(): games are named from their teams' English country names and the
// venue-local date; ceremonies/other from the tournament slug + title.
export type EventSlugInput =
  | {
      type: "game";
      awayCountryCode: string;
      homeCountryCode: string;
      localDate: string; // 'YYYY-MM-DD', venue-local
    }
  | {
      type: "ceremony" | "other";
      tournamentSlug: string | null;
      title: string;
    };

// A stat line as entered (no ids) — what validateStatLine() checks.
export type StatLineInput = BattingLine & { pitching: PitchingLine | null };

// validateStatLine() result: ok, or the first offending field + a plain-language message.
export type StatLineValidation =
  | { ok: true }
  | { ok: false; field: keyof BattingLine | `pitching.${keyof PitchingLine}`; message: string };

// ── Pure helpers ─────────────────────────────────────────────────────────────────

// The "no value" placeholder (U+2013 en dash).
const DASH = "–";

// Sum runs per side from the line-score cells; no innings → { away: 0, home: 0 }.
export function runTotals(innings: readonly Inning[]): RunTotals {
  const totals: RunTotals = { away: 0, home: 0 };
  for (const cell of innings) totals[cell.side] += cell.runs;
  return totals;
}

// A game's runs: derived from its innings when it has any (the line score is the truth),
// otherwise the stored total-only result (0030), otherwise 0.
export function gameRunTotals(
  game: Pick<Game, "awayRuns" | "homeRuns"> & { innings: readonly Inning[] },
): RunTotals {
  if (game.innings.length > 0) return runTotals(game.innings);
  return { away: game.awayRuns ?? 0, home: game.homeRuns ?? 0 };
}

// Number of line-score columns to render: max(SOFTBALL_INNINGS, highest inning, current).
export function lineScoreInningCount(
  innings: readonly Inning[],
  currentInning: number | null,
): number {
  return Math.max(SOFTBALL_INNINGS, currentInning ?? 0, ...innings.map((c) => c.inning));
}

// The winning side of a FINAL game by derived runs; null when not final or tied.
export function gameWinner(game: Pick<Game, "state">, totals: RunTotals): Side | null {
  if (game.state !== "final" || totals.away === totals.home) return null;
  return totals.away > totals.home ? "away" : "home";
}

// Tournament window (D2): events win; else announced dates; else null ("Dates to be announced").
export function tournamentWindow(
  events: readonly Pick<CalendarEvent, "startsAt" | "endsAt">[],
  tournament: Pick<Tournament, "announcedStart" | "announcedEnd">,
): TournamentWindow | null {
  if (events.length > 0) {
    let start = events[0].startsAt;
    let end = events[0].endsAt ?? events[0].startsAt;
    for (const e of events) {
      const last = e.endsAt ?? e.startsAt;
      if (Date.parse(e.startsAt) < Date.parse(start)) start = e.startsAt;
      if (Date.parse(last) > Date.parse(end)) end = last;
    }
    return { start, end, source: "events" };
  }
  if (tournament.announcedStart && tournament.announcedEnd) {
    return { start: tournament.announcedStart, end: tournament.announcedEnd, source: "announced" };
  }
  return null;
}

// Localized country name via Intl.DisplayNames (es 'VI' → "Islas Vírgenes de EE. UU.").
export function countryName(countryCode: string, locale: Locale): string {
  const code = countryCode.toUpperCase();
  try {
    return new Intl.DisplayNames(locale, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Localized team name: national/guest with a country → countryName(); otherwise team.name.
export function teamDisplayName(
  team: Pick<ScheduleTeam, "name" | "kind" | "countryCode">,
  locale: Locale,
): string {
  if ((team.kind === "national" || team.kind === "guest") && team.countryCode) {
    return countryName(team.countryCode, locale);
  }
  return team.name;
}

// Event display title: a game → "{away} vs {home}" (localized); else title / titleEs.
export function eventDisplayTitle(
  event: Pick<EventWithGame, "type" | "title" | "titleEs" | "game">,
  locale: Locale,
): string {
  if (event.type === "game" && event.game) {
    return `${teamDisplayName(event.game.away, locale)} vs ${teamDisplayName(event.game.home, locale)}`;
  }
  return locale === "es" && event.titleEs ? event.titleEs : event.title;
}

// Clock time of an instant in a zone, Intl-formatted (en "3:00 PM", es "3:00 p. m."). Always
// 12-hour — Intl 'es' would otherwise default to "15:00".
export function formatEventTime(iso: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(iso));
}

// Short zone label for an instant in a zone, so every time names its zone (e.g. "AST").
export function timeZoneLabel(iso: string, timeZone: string, locale: Locale): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
    .formatToParts(new Date(iso))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

// The zone word printed after a venue-local time. A bare abbreviation like "CST" reads as US
// Central to most fans, so any venue outside the USVI says "local" (en/es); a USVI (Atlantic)
// venue keeps "AST", which USVI fans know. Pass ATLANTIC_TZ for the USVI-time line.
export function venueZoneLabel(timeZone: string, locale: Locale): string {
  if (timeZone === ATLANTIC_TZ) return ATLANTIC_LABEL;
  return getDictionary(locale).schedule.localShort;
}

// The caption under the venue-local time in the event detail: "Local time · El Salvador" /
// "Hora local · El Salvador" (just "Local time" without a country); an Atlantic venue says
// "AST · USVI time" / "AST · hora de USVI".
export function localTimeCaption(
  timeZone: string,
  countryCode: string | null | undefined,
  locale: Locale,
): string {
  const t = getDictionary(locale).schedule;
  if (timeZone === ATLANTIC_TZ) return `${ATLANTIC_LABEL} · ${t.atlanticTime}`;
  return countryCode ? `${t.localTime} · ${countryName(countryCode, locale)}` : t.localTime;
}

// The OG share image's time line (English): "Saturday, November 21 · 3:00 PM local · 5:00 PM AST";
// an Atlantic venue shows its time once ("· 5:00 PM AST").
export function ogWhenLine(iso: string, timeZone: string): string {
  const date = formatEventDate(iso, timeZone, "en");
  const atlantic = `${formatEventTime(iso, ATLANTIC_TZ, "en")} ${ATLANTIC_LABEL}`;
  if (timeZone === ATLANTIC_TZ) return `${date} · ${atlantic}`;
  return `${date} · ${formatEventTime(iso, timeZone, "en")} ${venueZoneLabel(timeZone, "en")} · ${atlantic}`;
}

// Long date label of an instant in a zone (en "Saturday, November 21", es "sábado, 21 de noviembre").
export function formatEventDate(iso: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));
}

// Calendar date 'YYYY-MM-DD' of an instant in a zone — the day-grouping and slug key.
export function localDateKey(iso: string, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

// Innings pitched from outs: 14 → "4⅔", 0 → "0", 3 → "1", 10 → "3⅓".
export function formatInningsPitched(outs: number): string {
  const whole = Math.floor(outs / 3);
  const frac = ["", "⅓", "⅔"][outs % 3];
  if (!frac) return String(whole);
  return whole === 0 ? frac : `${whole}${frac}`;
}

// A rate as baseball-style ".333" (leading zero dropped; "1.000" kept).
function formatRate(value: number): string {
  return value.toFixed(3).replace(/^0(?=\.)/, "");
}

// AVG = H/AB as ".333"; "–" when AB is 0.
export function battingAverage(line: Pick<BattingLine, "ab" | "h">): string {
  return line.ab === 0 ? DASH : formatRate(line.h / line.ab);
}

// OBP = (H+BB)/(AB+BB) as ".400"; "–" when the denominator is 0.
export function onBasePct(line: Pick<BattingLine, "ab" | "h" | "bb">): string {
  const denom = line.ab + line.bb;
  return denom === 0 ? DASH : formatRate((line.h + line.bb) / denom);
}

// ERA = ER × SOFTBALL_INNINGS / IP as "2.33"; "–" when 0 outs.
export function era(line: Pick<PitchingLine, "outsPitched" | "er">): string {
  if (line.outsPitched <= 0) return DASH;
  return ((line.er * SOFTBALL_INNINGS * 3) / line.outsPitched).toFixed(2);
}

// URL-safe slug fragment: lowercase ASCII, accents stripped, dots dropped ("U.S." → "us"),
// other non-alphanumerics → '-'.
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Event slug: game `{away}-vs-{home}-{yyyy-mm-dd}` (English country names, e.g.
// colombia-vs-us-virgin-islands-2026-11-21); ceremony/other `{tournament-slug}-{title}`.
export function eventSlug(input: EventSlugInput): string {
  if (input.type === "game") {
    const away = slugify(countryName(input.awayCountryCode, "en"));
    const home = slugify(countryName(input.homeCountryCode, "en"));
    return `${away}-vs-${home}-${input.localDate}`;
  }
  const title = slugify(input.title);
  return input.tournamentSlug ? `${input.tournamentSlug}-${title}` : title;
}

const BATTING_FIELDS: readonly (keyof BattingLine)[] = [
  "ab", "r", "h", "doubles", "triples", "hr", "rbi", "bb", "so", "sb",
];
const PITCHING_FIELDS: readonly (keyof PitchingLine)[] = ["outsPitched", "h", "r", "er", "bb", "so"];

// Reject impossible lines (H > AB, 2B+3B+HR > H, ER > R, any negative) with a plain message.
export function validateStatLine(line: StatLineInput): StatLineValidation {
  for (const f of BATTING_FIELDS) {
    if (!Number.isInteger(line[f]) || line[f] < 0) {
      return { ok: false, field: f, message: "Numbers can't be negative." };
    }
  }
  if (line.h > line.ab) {
    return { ok: false, field: "h", message: "Hits can't be more than at-bats." };
  }
  if (line.doubles + line.triples + line.hr > line.h) {
    return {
      ok: false,
      field: "h",
      message: "Doubles, triples and home runs together can't be more than hits.",
    };
  }
  const p = line.pitching;
  if (p) {
    for (const f of PITCHING_FIELDS) {
      if (!Number.isInteger(p[f]) || p[f] < 0) {
        return { ok: false, field: `pitching.${f}`, message: "Numbers can't be negative." };
      }
    }
    if (p.er > p.r) {
      return {
        ok: false,
        field: "pitching.er",
        message: "Earned runs can't be more than runs allowed.",
      };
    }
  }
  return { ok: true };
}

// Regional-indicator flag emoji from an alpha-2 code ('VI' → "🇻🇮"); invalid → "".
export function flagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return "";
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

// True when the team represents the USVI (countryCode === USVI_COUNTRY).
export function isUsviTeam(team: Pick<ScheduleTeam, "countryCode">): boolean {
  return team.countryCode === USVI_COUNTRY;
}

// True when either side of the game is a USVI team (row highlight, ?team=usvi filter).
export function isUsviGame(game: Pick<GameWithTeams, "away" | "home"> | null): boolean {
  return game != null && (isUsviTeam(game.away) || isUsviTeam(game.home));
}

// ── S3 public schedule helpers (pure) ────────────────────────────────────────────

// One venue's events within a day (flyer: gold venue label, rows in start order).
export interface VenueGroup<E extends EventWithGame = EventWithGame> {
  venue: string;
  events: E[];
}

// One venue-local calendar day (flyer: navy day bar) and its venue groups.
export interface DayGroup<E extends EventWithGame = EventWithGame> {
  date: string; // 'YYYY-MM-DD', venue-local
  firstStartsAt: string; // ISO — what the day heading is formatted from
  timezone: string; // the zone `date` was computed in (the first event's)
  venues: VenueGroup<E>[];
}

// Events grouped day → venue, like the flyer. Days are keyed by VENUE-LOCAL date (each event's
// tournament timezone), ascending. Within a day, venues are ordered by their earliest start and
// rows by (startsAt, sortOrder). A day is `past` once its venue-local date is before today's
// venue-local date at `now`; past days keep ascending order (the caller renders them below).
export function groupEventsByDay<E extends EventWithGame>(
  events: readonly E[],
  now: Date,
): { upcoming: DayGroup<E>[]; past: DayGroup<E>[] } {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.sortOrder - b.sortOrder,
  );
  const days = new Map<string, DayGroup<E>>();
  for (const e of sorted) {
    const date = localDateKey(e.startsAt, e.timezone);
    let day = days.get(date);
    if (!day) {
      day = { date, firstStartsAt: e.startsAt, timezone: e.timezone, venues: [] };
      days.set(date, day);
    }
    // `sorted` is in start order, so the first event seen per venue is its earliest start and
    // venues are appended in earliest-start order.
    let venue = day.venues.find((v) => v.venue === e.venue);
    if (!venue) {
      venue = { venue: e.venue, events: [] };
      day.venues.push(venue);
    }
    venue.events.push(e);
  }
  const all = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming: DayGroup<E>[] = [];
  const past: DayGroup<E>[] = [];
  for (const day of all) {
    (day.date < localDateKey(now.toISOString(), day.timezone) ? past : upcoming).push(day);
  }
  return { upcoming, past };
}

// Short date of an instant in a zone (en "Nov 21, 2026", es "21 nov 2026").
export function formatShortDate(iso: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(iso));
}

// A tournament window as a localized range in the tournament's zone (en "Mar 14 – 15, 2099").
// 'announced' windows are plain dates, formatted as UTC calendar dates so they never shift.
export function formatTournamentWindow(
  window: TournamentWindow,
  timeZone: string,
  locale: Locale,
): string {
  const zone = window.source === "announced" ? "UTC" : timeZone;
  const toDate = (v: string) => new Date(window.source === "announced" ? `${v}T12:00:00Z` : v);
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone,
  });
  return fmt.formatRange(toDate(window.start), toDate(window.end));
}

// The ISO 8601 timestamp of an instant expressed in a zone's local time with its UTC offset
// (2099-03-15T15:00:00Z in America/El_Salvador → "2099-03-15T09:00:00-06:00").
export function isoWithOffset(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  // longOffset is "GMT-06:00"; UTC comes out as "GMT" or "GMT+00:00" depending on ICU → "Z".
  const raw = parts.timeZoneName.replace("GMT", "");
  const offset = raw === "" || raw === "+00:00" || raw === "-00:00" ? "Z" : raw;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

// A Google Maps search link for a venue (plus its city/country, when known).
export function googleMapsUrl(venue: string, place = ""): string {
  const query = [venue, place].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// True when any event in the list is a game currently in progress (drives live refresh).
export function hasLiveGame(events: readonly Pick<EventWithGame, "game">[]): boolean {
  return events.some((e) => e.game?.state === "live");
}

// ── Past games still waiting for a score (home-feed Phase B) ─────────────────────

// A game with no `endsAt` is treated as finished this long after its start: past it, a game
// still pregame/live reads "Final · score pending" and the admin flags it.
export const SCORE_PENDING_HOURS = 3;

// When an event's slot is over: `endsAt`, else start + SCORE_PENDING_HOURS.
export function eventSlotEnd(event: Pick<CalendarEvent, "startsAt" | "endsAt">): number {
  return event.endsAt
    ? Date.parse(event.endsAt)
    : Date.parse(event.startsAt) + SCORE_PENDING_HOURS * 3_600_000;
}

// A game whose slot is over but whose result isn't in (pregame or still live).
export function needsScore(
  event: Pick<EventWithGame, "type" | "status" | "game" | "startsAt" | "endsAt">,
  now: Date,
): boolean {
  return (
    event.type === "game" &&
    event.status === "scheduled" &&
    !!event.game &&
    event.game.state !== "final" &&
    now.getTime() >= eventSlotEnd(event)
  );
}

// ── S5 timeline + calendar helpers (pure) ────────────────────────────────────────

// How long an event without `endsAt` is assumed to run (timeline range + item width).
export const DEFAULT_EVENT_HOURS = 2;

// An hour window of a venue-local day, in whole hours (0 ≤ startHour < endHour ≤ 24).
export interface TimelineRange {
  startHour: number;
  endHour: number;
}

const HOUR_MS = 3_600_000;

// Venue-local clock time of an instant as fractional hours since local midnight (12:30 → 12.5).
export function localHours(iso: string, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) % 24 + Number(parts.minute) / 60;
}

// 'YYYY-MM-DD' of a UTC calendar date (helper for the month grid).
function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// A month as whole weeks of 'YYYY-MM-DD' dates (leading/trailing days from the neighbouring
// months included). `month` is 1–12; weekStartsOn 0 = Sunday (en), 1 = Monday (es).
export function calendarMonthGrid(year: number, month: number, weekStartsOn: 0 | 1): string[][] {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  const lead = (new Date(first).getUTCDay() - weekStartsOn + 7) % 7;
  const trail = (weekStartsOn + 6 - new Date(last).getUTCDay() + 7) % 7;
  const total = lead + new Date(last).getUTCDate() + trail;
  const weeks: string[][] = [];
  for (let i = 0; i < total; i++) {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(utcDateKey(first + (i - lead) * 24 * HOUR_MS));
  }
  return weeks;
}

// The venue-local hour window a day's timeline spans: floor of the earliest start, ceil of the
// latest end (endsAt, else start + DEFAULT_EVENT_HOURS), capped at 24. Empty → 8 … 20.
export function timelineRange(
  events: readonly Pick<CalendarEvent, "startsAt" | "endsAt">[],
  timeZone: string,
): TimelineRange {
  if (events.length === 0) return { startHour: 8, endHour: 20 };
  let start = Infinity;
  let end = -Infinity;
  for (const e of events) {
    const s = localHours(e.startsAt, timeZone);
    const durationH = e.endsAt
      ? Math.max(0, (Date.parse(e.endsAt) - Date.parse(e.startsAt)) / HOUR_MS)
      : DEFAULT_EVENT_HOURS;
    start = Math.min(start, s);
    end = Math.max(end, s + durationH);
  }
  const startHour = Math.floor(start);
  return { startHour, endHour: Math.max(startHour + 1, Math.min(24, Math.ceil(end))) };
}

// Where an instant falls in a timeline range, as a fraction 0..1 (clamped), in venue-local time.
export function timelinePosition(iso: string, range: TimelineRange, timeZone: string): number {
  const f = (localHours(iso, timeZone) - range.startHour) / (range.endHour - range.startHour);
  return Math.min(1, Math.max(0, f));
}

// The calendar's default month 'YYYY-MM': the month of the first event whose venue-local date
// is today or later (an event earlier today counts); none upcoming → the latest event's month;
// no events → the current month. Each event's own `timezone` wins over `timeZone` when present.
export function defaultCalendarMonth(
  events: readonly { startsAt: string; timezone?: string }[],
  nowIso: string,
  timeZone: string,
): string {
  let upcoming: string | null = null;
  let latest: string | null = null;
  for (const e of events) {
    const tz = e.timezone ?? timeZone;
    const date = localDateKey(e.startsAt, tz);
    if (date >= localDateKey(nowIso, tz) && (upcoming === null || date < upcoming)) upcoming = date;
    if (latest === null || date > latest) latest = date;
  }
  return (upcoming ?? latest ?? localDateKey(nowIso, timeZone)).slice(0, 7);
}
