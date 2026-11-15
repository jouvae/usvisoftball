"use client";

import { useState } from "react";
import type { ScoringPlayer } from "@/components/client/scoring-screen";
import { BIG_BUTTON } from "@/components/client/scoring-styles";
import type { Scoring } from "@/components/client/use-scoring-queue";
import { isZeroLine } from "@/lib/scoring-view";

// Lineup tab (schedule overview §6 item 3): "Who played?" — the USVI side's ACTIVE roster as
// a checklist, pre-checked when the game has no lines yet. Save sends one setLineup op.
// Unchecking a player whose line already has stats is refused with a hint (lineup-error);
// so is removing a saved line for a non-editor (0026: deleting a line is editor-only).
export function ScoringLineup({
  scoring,
  roster,
  isEditor,
}: {
  scoring: Scoring;
  roster: ScoringPlayer[];
  isEditor: boolean;
}) {
  const { state, commit, ready } = scoring;
  const lines = state.statLines;
  const noLines = Object.keys(lines).length === 0;
  // Mounted fresh each time the tab opens, so it starts from the current lines.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(noLines ? roster.map((p) => p.id) : roster.filter((p) => lines[p.id]).map((p) => p.id)),
  );
  const [hint, setHint] = useState<string | null>(null);

  const toggle = (player: ScoringPlayer, on: boolean) => {
    const line = lines[player.id];
    if (!on && line && !isZeroLine(line)) {
      setHint(`${player.name} already has stats. Clear them in the Box score first.`);
      return;
    }
    if (!on && line && !isEditor) {
      setHint(`${player.name} is already saved in the lineup. Only an editor can take a player off.`);
      return;
    }
    setHint(null);
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(player.id);
      else next.delete(player.id);
      return next;
    });
  };

  const save = () => {
    // Keep roster order; never drop someone who already has a line with stats.
    const playerIds = roster.filter((p) => checked.has(p.id)).map((p) => p.id);
    commit({ kind: "setLineup", gameId: state.id, playerIds }, null);
  };

  if (roster.length === 0) {
    return <p className="text-muted">No active players on the USVI roster yet.</p>;
  }

  return (
    <section data-testid="scoring-lineup" className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-bold text-navy">Who played?</h2>
      <p className="text-muted">Check everyone who played, then tap Save.</p>
      {hint ? (
        <p
          data-testid="lineup-error"
          role="alert"
          className="rounded-xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-300"
        >
          {hint}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {roster.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded-xl bg-white px-4 py-2 ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-navy">
              <input
                type="checkbox"
                data-testid="lineup-player"
                data-player-id={p.id}
                checked={checked.has(p.id)}
                onChange={(e) => toggle(p, e.target.checked)}
                className="size-7 accent-navy"
              />
              <span className="w-8 text-right font-display text-xl text-navy tabular-nums">
                {p.jerseyNumber ?? "–"}
              </span>
              <span className="text-lg font-medium text-foreground">{p.name}</span>
              {p.position ? <span className="text-sm text-muted">{p.position}</span> : null}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-testid="lineup-save"
        onClick={save}
        disabled={!ready}
        className={`${BIG_BUTTON} w-full bg-navy text-navy-foreground hover:bg-navy-raised`}
      >
        Save lineup
      </button>
    </section>
  );
}
