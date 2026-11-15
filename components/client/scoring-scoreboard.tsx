"use client";

import { useState } from "react";
import { ResponsiveSheet } from "@/components/client/responsive-sheet";
import { BIG_BUTTON } from "@/components/client/scoring-styles";
import type { Scoring } from "@/components/client/use-scoring-queue";
import { LineScore, type InningCellRenderer } from "@/components/ui/line-score";
import { TeamBadge } from "@/components/ui/team-badge";
import { runTotals, type GameWithTeams, type ScheduleTeam, type Side } from "@/lib/schedule-view";

const STATE_LABEL = { pregame: "Pregame", live: "Live", final: "Final" } as const;
const STATE_TONE = {
  pregame: "bg-surface text-navy ring-1 ring-border",
  live: "bg-red-600 text-white",
  final: "bg-navy text-navy-foreground",
} as const;

const MAX = 99;

// The line score's editable-aware cell: the current inning is ringed so the scorekeeper sees
// where +1 lands. Values change through the big buttons above, not in the table.
const cellWithCurrent: InningCellRenderer = ({ runs, current }) => (
  <span
    className={
      current ? "inline-flex min-w-7 justify-center rounded-md bg-accent/40 px-1 font-bold" : ""
    }
  >
    {runs ?? ""}
  </span>
);

// Scoreboard tab (schedule overview §6 item 2): state + inning, per-team runs (for the
// current inning) / hits / errors with big ± buttons, the shared LineScore, Start / Final.
export function ScoringScoreboard({
  scoring,
  away,
  home,
  usviSide,
  isEditor,
}: {
  scoring: Scoring;
  away: ScheduleTeam;
  home: ScheduleTeam;
  usviSide: Side | null;
  isEditor: boolean;
}) {
  const { state, commit, ready } = scoring;
  const [confirmFinal, setConfirmFinal] = useState(false);
  const gameId = state.id;
  const live = state.state === "live";
  const final = state.state === "final";
  const inning = state.currentInning;
  const totals = runTotals(state.innings);
  const teams = { away, home };

  const inningRuns = (side: Side) =>
    state.innings.find((c) => c.side === side && c.inning === inning)?.runs ?? 0;

  const bumpRuns = (side: Side, delta: 1 | -1) => {
    if (!live || inning == null) return;
    const before = inningRuns(side);
    const after = before + delta;
    if (after < 0 || after > MAX) return;
    commit(
      { kind: "setInningRuns", gameId, inning, side, runs: after },
      { kind: "setInningRuns", gameId, inning, side, runs: before },
    );
  };

  const totalsOf = (side: Side) =>
    side === "away"
      ? { hits: state.awayHits, errors: state.awayErrors }
      : { hits: state.homeHits, errors: state.homeErrors };

  const bumpTotal = (side: Side, field: "hits" | "errors", delta: 1 | -1) => {
    if (final) return;
    const before = totalsOf(side);
    const value = before[field] + delta;
    if (value < 0 || value > MAX) return;
    commit(
      { kind: "setTeamTotals", gameId, side, ...before, [field]: value },
      { kind: "setTeamTotals", gameId, side, ...before },
    );
  };

  const setInning = (next: number) => {
    if (!live || inning == null || next < 1 || next > 30) return;
    commit(
      { kind: "setGameState", gameId, state: "live", currentInning: next },
      { kind: "setGameState", gameId, state: "live", currentInning: inning },
    );
  };

  const start = () =>
    commit(
      { kind: "setGameState", gameId, state: "live", currentInning: 1 },
      { kind: "setGameState", gameId, state: "pregame", currentInning: null },
    );

  const makeFinal = () => {
    setConfirmFinal(false);
    // Final is not undoable (re-opening is editor-only): clear the undo history.
    commit({ kind: "setGameState", gameId, state: "final", currentInning: inning ?? 1 }, null);
    scoring.clearUndo();
  };

  const reopen = () =>
    commit({ kind: "setGameState", gameId, state: "live", currentInning: inning ?? 1 }, null);

  const usviHits = usviSide ? totalsOf(usviSide).hits : 0;
  const lines = Object.values(state.statLines);
  const boxHits = lines.reduce((sum, l) => sum + l.h, 0);
  const mismatch = usviSide != null && lines.length > 0 && usviHits !== boxHits;

  const game: GameWithTeams = {
    id: state.id,
    eventId: "",
    awayTeamId: away.id,
    homeTeamId: home.id,
    state: state.state,
    currentInning: state.currentInning,
    awayHits: state.awayHits,
    awayErrors: state.awayErrors,
    homeHits: state.homeHits,
    homeErrors: state.homeErrors,
    away,
    home,
    innings: state.innings,
  };

  return (
    <section data-testid="scoring-scoreboard" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          data-testid="scoring-state"
          className={`rounded-full px-4 py-1.5 font-display text-lg font-bold uppercase tracking-wider ${STATE_TONE[state.state]}`}
        >
          {STATE_LABEL[state.state]}
        </span>
        {state.state === "pregame" ? (
          <button
            type="button"
            data-testid="scoring-start"
            onClick={start}
            disabled={!ready}
            className={`${BIG_BUTTON} grow bg-accent text-accent-foreground hover:bg-accent-hover`}
          >
            Start game
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="scoring-prev-inning"
              aria-label="Previous inning"
              onClick={() => setInning((inning ?? 1) - 1)}
              disabled={!ready || !live || (inning ?? 1) <= 1}
              className={`${BIG_BUTTON} bg-surface text-navy ring-1 ring-border`}
            >
              ‹
            </button>
            <span
              data-testid="scoring-inning"
              className="min-w-24 text-center font-display text-2xl font-bold text-navy"
            >
              Inning {inning ?? "–"}
            </span>
            <button
              type="button"
              data-testid="scoring-next-inning"
              aria-label="Next inning"
              onClick={() => setInning((inning ?? 0) + 1)}
              disabled={!ready || !live}
              className={`${BIG_BUTTON} bg-surface text-navy ring-1 ring-border`}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {mismatch ? (
        <p
          data-testid="scoring-hits-mismatch"
          role="status"
          className="rounded-xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-300"
        >
          Heads up: USVI has {usviHits} {usviHits === 1 ? "hit" : "hits"} on the scoreboard but{" "}
          {boxHits} in the box score.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["away", "home"] as const).map((side) => {
          const t = totalsOf(side);
          return (
            <div
              key={side}
              data-testid={`scoring-team-${side}`}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-border"
            >
              <div className="flex items-center justify-between gap-3">
                <TeamBadge team={teams[side]} locale="en" size="md" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {side === "away" ? "Away" : "Home"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  data-testid={`scoring-run-minus-${side}`}
                  aria-label={`Take away a run (${side})`}
                  onClick={() => bumpRuns(side, -1)}
                  disabled={!ready || !live || inningRuns(side) <= 0}
                  className={`${BIG_BUTTON} bg-surface text-navy ring-1 ring-border`}
                >
                  −1
                </button>
                <div className="text-center">
                  <div
                    data-testid={`scoring-runs-${side}`}
                    className="font-display text-5xl font-bold tabular-nums text-navy"
                  >
                    {totals[side]}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Runs</div>
                </div>
                <button
                  type="button"
                  data-testid={`scoring-run-plus-${side}`}
                  aria-label={`Add a run (${side})`}
                  onClick={() => bumpRuns(side, 1)}
                  disabled={!ready || !live}
                  className={`${BIG_BUTTON} min-w-24 bg-navy text-navy-foreground hover:bg-navy-raised`}
                >
                  +1 Run
                </button>
              </div>
              {(["hits", "errors"] as const).map((field) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    data-testid={`scoring-${field}-minus-${side}`}
                    aria-label={`Take away one (${field}, ${side})`}
                    onClick={() => bumpTotal(side, field, -1)}
                    disabled={!ready || final || t[field] <= 0}
                    className={`${BIG_BUTTON} bg-surface text-navy ring-1 ring-border`}
                  >
                    −
                  </button>
                  <div className="text-center">
                    <span
                      data-testid={`scoring-${field}-${side}`}
                      className="font-display text-3xl font-bold tabular-nums text-navy"
                    >
                      {t[field]}
                    </span>
                    <span className="ml-2 text-sm font-semibold uppercase text-muted">
                      {field === "hits" ? "Hits" : "Errors"}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid={`scoring-${field}-plus-${side}`}
                    aria-label={`Add one (${field}, ${side})`}
                    onClick={() => bumpTotal(side, field, 1)}
                    disabled={!ready || final}
                    className={`${BIG_BUTTON} bg-surface text-navy ring-1 ring-border`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <LineScore game={game} locale="en" renderCell={cellWithCurrent} />

      {live ? (
        <button
          type="button"
          data-testid="scoring-final"
          onClick={() => setConfirmFinal(true)}
          disabled={!ready}
          className={`${BIG_BUTTON} w-full bg-red-700 text-white hover:bg-red-800`}
        >
          End game (Final)
        </button>
      ) : null}

      {final ? (
        isEditor ? (
          <button
            type="button"
            data-testid="scoring-reopen"
            onClick={reopen}
            disabled={!ready}
            className={`${BIG_BUTTON} w-full bg-surface text-navy ring-1 ring-border`}
          >
            Reopen game
          </button>
        ) : (
          <p className="rounded-xl bg-surface px-4 py-3 text-center text-muted">
            Game over. Ask an editor if the score needs a fix.
          </p>
        )
      ) : null}

      {confirmFinal ? (
        <ResponsiveSheet
          title="End the game?"
          closeLabel="Not yet"
          onClose={() => setConfirmFinal(false)}
          modalTestId="scoring-final-dialog"
          drawerTestId="scoring-final-dialog"
        >
          {() => (
            <div className="flex flex-col gap-4 pt-2">
              <p className="font-display text-2xl font-bold text-navy">End the game?</p>
              <p className="text-lg text-foreground">
                Final score: {totals.away} – {totals.home}. You won&apos;t be able to change the
                score after this.
              </p>
              <button
                type="button"
                data-testid="scoring-final-confirm"
                onClick={makeFinal}
                className={`${BIG_BUTTON} w-full bg-red-700 text-white hover:bg-red-800`}
              >
                Yes, it&apos;s final
              </button>
              <button
                type="button"
                data-testid="scoring-final-cancel"
                onClick={() => setConfirmFinal(false)}
                className={`${BIG_BUTTON} w-full bg-surface text-navy ring-1 ring-border`}
              >
                Not yet
              </button>
            </div>
          )}
        </ResponsiveSheet>
      ) : null}
    </section>
  );
}
