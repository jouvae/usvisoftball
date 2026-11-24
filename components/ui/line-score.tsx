import type { ReactNode } from "react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  gameWinner,
  lineScoreInningCount,
  gameRunTotals,
  teamDisplayName,
  flagEmoji,
  type GameWithTeams,
  type Locale,
  type Side,
} from "@/lib/schedule-view";

// Renders one inning cell. The read-only default prints the runs (or blank for an unplayed
// half). S4's scorekeeper passes its own renderer (± steppers) — same table, no fork (D12).
export type InningCellRenderer = (cell: {
  side: Side;
  inning: number;
  runs: number | null; // null = no cell recorded for this half-inning
  current: boolean; // the game's current inning
}) => ReactNode;

const readCell: InningCellRenderer = ({ runs }) => (runs == null ? "" : runs);

// The line score (D6): innings 1…max(7, played) per side, then derived R and stored H / E. The
// winner's row is emphasized (data-winner). Pregame with no cells → the "stats appear once the
// game starts" empty state. Isomorphic (no hooks); `renderCell` is the editable-variant seam.
export function LineScore({
  game,
  locale,
  renderCell = readCell,
  className = "",
}: {
  game: GameWithTeams;
  locale: Locale;
  renderCell?: InningCellRenderer;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  const empty = game.state === "pregame" && game.innings.length === 0;
  const totals = gameRunTotals(game);
  const winner = gameWinner(game, totals);
  const count = lineScoreInningCount(game.innings, game.currentInning);
  const innings = Array.from({ length: count }, (_, i) => i + 1);
  const cell = (side: Side, inning: number) =>
    game.innings.find((c) => c.side === side && c.inning === inning)?.runs ?? null;
  const stats: Record<Side, { h: number; e: number }> = {
    away: { h: game.awayHits, e: game.awayErrors },
    home: { h: game.homeHits, e: game.homeErrors },
  };

  return (
    <section data-testid="linescore" aria-labelledby="linescore-heading" className={className}>
      <h2
        id="linescore-heading"
        className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-navy"
      >
        {t.lineScore}
      </h2>
      {empty ? (
        <p
          data-testid="linescore-empty"
          className="rounded-xl bg-surface px-4 py-5 text-center text-sm text-muted"
        >
          {t.lineScoreEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full min-w-[30rem] border-collapse text-center text-sm tabular-nums">
            <thead>
              <tr className="bg-navy text-xs uppercase tracking-wide text-navy-muted">
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  {t.team}
                </th>
                {innings.map((n) => (
                  <th
                    key={n}
                    scope="col"
                    className={`w-8 py-2 font-semibold ${n === game.currentInning && game.state === "live" ? "text-accent" : ""}`}
                  >
                    {n}
                  </th>
                ))}
                <th scope="col" className="w-10 border-l border-white/10 py-2 font-bold text-navy-foreground">
                  {t.runs}
                </th>
                <th scope="col" className="w-10 py-2 font-semibold">
                  {t.hits}
                </th>
                <th scope="col" className="w-10 py-2 font-semibold">
                  {t.errors}
                </th>
              </tr>
            </thead>
            <tbody>
              {(["away", "home"] as const).map((side) => {
                const won = winner === side;
                return (
                  <tr
                    key={side}
                    data-testid={`linescore-row-${side}`}
                    data-winner={won ? "true" : "false"}
                    className={`border-t border-border ${won ? "bg-accent/15 font-bold" : ""}`}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-semibold text-navy">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span aria-hidden="true">{flagEmoji(game[side].countryCode)}</span>
                        {teamDisplayName(game[side], locale)}
                      </span>
                    </th>
                    {innings.map((n) => (
                      <td
                        key={n}
                        data-testid="linescore-inning"
                        data-inning={n}
                        className="py-2 text-foreground"
                      >
                        {renderCell({
                          side,
                          inning: n,
                          runs: cell(side, n),
                          current: n === game.currentInning,
                        })}
                      </td>
                    ))}
                    <td
                      data-testid="linescore-r"
                      className="border-l border-border py-2 font-display text-base font-bold text-navy"
                    >
                      {totals[side]}
                    </td>
                    <td data-testid="linescore-h" className="py-2">
                      {stats[side].h}
                    </td>
                    <td data-testid="linescore-e" className="py-2">
                      {stats[side].e}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
