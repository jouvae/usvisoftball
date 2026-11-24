import Link from "next/link";
import { EVENTS_ENABLED } from "@/lib/flags";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath } from "@/lib/i18n/locale";
import {
  ATLANTIC_TZ,
  flagEmoji,
  formatShortDate,
  formatEventTime,
  gameRunTotals,
  gameWinner,
  isUsviTeam,
  needsScore,
  teamDisplayName,
  type EventWithGame,
  type GameStandout,
  type GameWithTeams,
  type Locale,
  type ScheduleTeam,
  type Side,
} from "@/lib/schedule-view";
import { LineScore } from "@/components/ui/line-score";

// Feature softball/scoreboard — a game's result, rendered from the GAME (not the article), so
// every page that shows the game agrees.
//
//   <Scoreboard>         the score header: who played, who won, when and where.
//   <ScoreboardDetails>  by-the-numbers team comparison, line score, standouts.
//
// Both render only what is recorded: a total-only "8–5" result still looks finished; a row
// with no data is left out rather than shown as 0. Isomorphic (no hooks).

const SIDES: Side[] = ["away", "home"];

type Status = "final" | "live" | "pending" | "upcoming";

function statusOf(event: EventWithGame, game: GameWithTeams, now: Date): Status {
  if (game.state === "final") return "final";
  if (game.state === "live") return "live";
  return needsScore(event, now) ? "pending" : "upcoming";
}

// The USVI reads "USVI" in tight spots; everyone else by their (localized) country name.
function shortName(team: ScheduleTeam, locale: Locale): string {
  return isUsviTeam(team) ? "USVI" : teamDisplayName(team, locale);
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

function StatusChip({ status, locale }: { status: Status; locale: Locale }) {
  const t = getDictionary(locale).scoreboard;
  const label = {
    final: t.final,
    live: t.live,
    pending: t.scorePending,
    upcoming: t.upcoming,
  }[status];
  const tone =
    status === "live"
      ? "bg-red-600 text-white"
      : status === "final"
        ? "bg-accent text-accent-foreground"
        : "bg-navy-raised text-navy-foreground";
  return (
    <span
      data-testid="scoreboard-status"
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider ${tone}`}
    >
      {status === "live" ? (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-white" />
      ) : null}
      {label}
    </span>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────────

export function Scoreboard({
  event,
  locale,
  now = new Date(),
  className = "",
}: {
  event: EventWithGame;
  locale: Locale;
  now?: Date;
  className?: string;
}) {
  const game = event.game;
  if (!game) return null;
  const t = getDictionary(locale);
  const sb = t.scoreboard;
  const status = statusOf(event, game, now);
  const hasScore = status === "final" || status === "live";
  const runs = gameRunTotals(game);
  const winner = gameWinner(game, runs);
  const name = (s: Side) => teamDisplayName(game[s], locale);

  const round = event.round ? (t.schedule.rounds[event.round] ?? "") : "";
  const date = formatShortDate(event.startsAt, event.timezone, locale);
  const meta = [round, event.venue, date].filter(Boolean);

  const viTime = formatEventTime(event.startsAt, ATLANTIC_TZ, locale);
  const localTime =
    event.timezone !== ATLANTIC_TZ ? formatEventTime(event.startsAt, event.timezone, locale) : null;

  // One sentence for assistive tech; the visual board below is aria-hidden.
  const summary = hasScore
    ? `${status === "final" ? sb.final : sb.live}: ${name("away")} ${runs.away}, ${name("home")} ${runs.home}.`
    : `${name("away")} ${t.schedule.vs} ${name("home")}. ${sb.firstPitch} ${fill(sb.usviTime, { time: viTime })}.`;

  const teamCell = (s: Side, align: "start" | "end") => {
    const team = game[s];
    const flag = flagEmoji(team.countryCode);
    return (
      <span
        className={`flex min-w-0 items-center gap-2.5 ${align === "end" ? "flex-row-reverse text-right" : ""}`}
      >
        {flag ? <span className="text-2xl leading-none sm:text-3xl">{flag}</span> : null}
        <span
          className={`truncate font-display text-lg font-semibold uppercase tracking-wide sm:text-2xl ${
            isUsviTeam(team) ? "text-accent" : "text-navy-foreground"
          }`}
        >
          {shortName(team, locale)}
        </span>
      </span>
    );
  };
  const scoreCls = (s: Side) =>
    winner && winner !== s ? "text-navy-muted/70" : "text-navy-foreground";

  return (
    <section
      data-testid="scoreboard"
      data-status={status}
      aria-label={sb.label}
      className={`overflow-hidden rounded-xl bg-navy text-navy-foreground ${className}`}
    >
      <p className="sr-only" data-testid="scoreboard-summary">
        {summary}
      </p>

      <div aria-hidden="true">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-2.5 text-xs text-navy-muted sm:px-6">
          <StatusChip status={status} locale={locale} />
          <span className="min-w-0">{meta.join(" · ")}</span>
        </div>

        {/* Phone: one row per team, score at the right. */}
        <div className="divide-y divide-white/10 px-4 sm:hidden">
          {SIDES.map((s) => (
            <div key={s} data-side={s} className="flex items-center justify-between gap-3 py-3">
              {teamCell(s, "start")}
              {hasScore ? (
                <span className="flex items-center gap-2">
                  <span
                    className={`font-display text-4xl font-bold tabular-nums leading-none ${scoreCls(s)}`}
                  >
                    {runs[s]}
                  </span>
                  <span className={`w-3 text-accent ${winner === s ? "" : "invisible"}`}>◀</span>
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {/* Wider: away · score · home. */}
        <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-6 py-6 sm:grid">
          {teamCell("away", "start")}
          {hasScore ? (
            <span className="flex items-center gap-4 font-display text-6xl font-bold tabular-nums leading-none">
              <span className={scoreCls("away")}>{runs.away}</span>
              <span className="text-3xl text-navy-muted/60">–</span>
              <span className={scoreCls("home")}>{runs.home}</span>
            </span>
          ) : (
            <span className="font-display text-2xl font-semibold uppercase text-navy-muted">
              {t.schedule.vs}
            </span>
          )}
          {teamCell("home", "end")}
        </div>
      </div>

      {!hasScore || EVENTS_ENABLED ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2.5 text-sm sm:px-6">
          {!hasScore ? (
            <span data-testid="scoreboard-time" className="text-navy-muted">
              <span className="font-semibold text-navy-foreground">{sb.firstPitch}</span>{" "}
              {fill(sb.usviTime, { time: viTime })}
              {localTime ? ` · ${fill(sb.localTime, { time: localTime })}` : ""}
            </span>
          ) : (
            <span />
          )}
          {EVENTS_ENABLED ? (
            <Link
              href={localizePath(locale, `/events/${event.slug}`)}
              data-testid="scoreboard-link"
              className="font-semibold text-accent underline-offset-4 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              {sb.gameCenter}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── Details ───────────────────────────────────────────────────────────────────────

type StatRow = { key: string; label: string; away: number; home: number };

function statRows(game: GameWithTeams, locale: Locale): StatRow[] {
  const t = getDictionary(locale).scoreboard;
  const runs = gameRunTotals(game);
  const rows: StatRow[] = [
    { key: "runs", label: t.runs, away: runs.away, home: runs.home },
    { key: "hits", label: t.hits, away: game.awayHits, home: game.homeHits },
  ];
  if (game.awayWalks != null && game.homeWalks != null)
    rows.push({ key: "walks", label: t.walks, away: game.awayWalks, home: game.homeWalks });
  if (game.awayStrikeouts != null && game.homeStrikeouts != null)
    rows.push({
      key: "strikeouts",
      label: t.strikeouts,
      away: game.awayStrikeouts,
      home: game.homeStrikeouts,
    });
  // Errors default to 0 in the database, so 0–0 can't be told apart from "not recorded".
  if (game.awayErrors + game.homeErrors > 0)
    rows.push({ key: "errors", label: t.errors, away: game.awayErrors, home: game.homeErrors });
  return rows;
}

function ComparisonTable({ game, locale }: { game: GameWithTeams; locale: Locale }) {
  const t = getDictionary(locale).scoreboard;
  const rows = statRows(game, locale);
  const usvi = (s: Side) => isUsviTeam(game[s]);
  const bar = (s: Side) => (usvi(s) ? "bg-accent" : "bg-navy/25");

  return (
    <table data-testid="scoreboard-comparison" className="w-full border-collapse tabular-nums">
      <caption className="sr-only">
        {fill(t.comparisonCaption, {
          away: teamDisplayName(game.away, locale),
          home: teamDisplayName(game.home, locale),
        })}
      </caption>
      {/* The visible team legend sits in the caption row so long names never wrap a column. */}
      <thead>
        <tr>
          <th scope="col" className="w-12 sm:w-16">
            <span className="sr-only">{teamDisplayName(game.away, locale)}</span>
          </th>
          <th scope="col" className="pb-3">
            <span className="sr-only">{t.stat}</span>
            <span
              aria-hidden="true"
              className="flex items-center justify-between gap-3 font-display text-sm font-semibold uppercase tracking-wide text-navy"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span>{flagEmoji(game.away.countryCode)}</span>
                <span className="truncate">{shortName(game.away, locale)}</span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{shortName(game.home, locale)}</span>
                <span>{flagEmoji(game.home.countryCode)}</span>
              </span>
            </span>
          </th>
          <th scope="col" className="w-12 sm:w-16">
            <span className="sr-only">{teamDisplayName(game.home, locale)}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const max = Math.max(r.away, r.home, 1);
          const lead = (s: Side) => r[s] > r[s === "away" ? "home" : "away"];
          return (
            <tr key={r.key} data-stat={r.key} className="border-t border-border">
              <td
                className={`py-3 text-left font-display text-2xl ${lead("away") ? "font-bold text-navy" : "font-medium text-muted"}`}
              >
                {r.away}
              </td>
              <th scope="row" className="px-2 py-3 font-normal sm:px-4">
                <span className="block text-center text-sm font-semibold text-foreground">
                  {r.label}
                </span>
                <span aria-hidden="true" className="mt-2 grid grid-cols-2 gap-1">
                  <span className="flex h-2 justify-end overflow-hidden rounded-l-full bg-surface">
                    <span
                      className={`h-full rounded-l-full ${bar("away")}`}
                      style={{ width: `${(r.away / max) * 100}%` }}
                    />
                  </span>
                  <span className="flex h-2 overflow-hidden rounded-r-full bg-surface">
                    <span
                      className={`h-full rounded-r-full ${bar("home")}`}
                      style={{ width: `${(r.home / max) * 100}%` }}
                    />
                  </span>
                </span>
              </th>
              <td
                className={`py-3 text-right font-display text-2xl ${lead("home") ? "font-bold text-navy" : "font-medium text-muted"}`}
              >
                {r.home}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Standouts({ standouts, locale }: { standouts: GameStandout[]; locale: Locale }) {
  const t = getDictionary(locale).scoreboard;
  const awards = standouts.filter((s) => s.kind !== "standout");
  const others = standouts.filter((s) => s.kind === "standout");
  const awardLabel = (s: GameStandout) =>
    s.kind === "player_of_game" ? t.playerOfGame : t.pitchingStandout;

  return (
    <div className="flex flex-col gap-4">
      {awards.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {awards.map((s) => (
            <li
              key={s.id}
              data-testid="standout-award"
              data-kind={s.kind}
              className="flex flex-col gap-1.5 rounded-xl border-l-4 border-accent bg-surface px-4 py-4"
            >
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-navy/70">
                {awardLabel(s)}
              </span>
              <span className="font-display text-xl font-bold text-navy">{s.playerName}</span>
              {s.statLine ? (
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {s.statLine}
                </span>
              ) : null}
              {s.note ? <span className="text-sm text-muted">{s.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {others.length ? (
        <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
          {others.map((s) => (
            <li
              key={s.id}
              data-testid="standout"
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3"
            >
              <span className="font-semibold text-navy">{s.playerName}</span>
              <span className="text-sm tabular-nums text-muted">{s.statLine}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ScoreboardDetails({
  game,
  standouts,
  locale,
  className = "",
}: {
  game: GameWithTeams;
  standouts: GameStandout[];
  locale: Locale;
  className?: string;
}) {
  if (game.state === "pregame") return null;
  const t = getDictionary(locale).scoreboard;
  const hasInnings = game.innings.length > 0;
  const hasTeamStats =
    game.awayHits + game.homeHits > 0 || game.awayWalks != null || game.awayStrikeouts != null;
  if (!hasInnings && !hasTeamStats && standouts.length === 0) return null;

  const heading = "font-display text-lg font-bold uppercase tracking-wide text-navy";
  return (
    <section
      data-testid="scoreboard-details"
      aria-label={t.label}
      className={`flex flex-col gap-8 ${className}`}
    >
      {hasTeamStats ? (
        <div className="flex flex-col gap-2">
          <h2 className={heading}>{t.byTheNumbers}</h2>
          <ComparisonTable game={game} locale={locale} />
        </div>
      ) : null}
      {hasInnings ? <LineScore game={game} locale={locale} /> : null}
      {standouts.length ? (
        <div className="flex flex-col gap-3">
          <h2 className={heading}>{t.standouts}</h2>
          <Standouts standouts={standouts} locale={locale} />
        </div>
      ) : null}
    </section>
  );
}
