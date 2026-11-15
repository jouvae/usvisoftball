"use client";

import { useState } from "react";
import { ResponsiveSheet } from "@/components/client/responsive-sheet";
import type { ScoringPlayer } from "@/components/client/scoring-screen";
import { BIG_BUTTON } from "@/components/client/scoring-styles";
import type { Scoring } from "@/components/client/use-scoring-queue";
import { BoxScore } from "@/components/ui/box-score";
import {
  formatInningsPitched,
  validateStatLine,
  type BattingLine,
  type PitchingLine,
  type PlayerStatLineWithPlayer,
  type StatLineInput,
} from "@/lib/schedule-view";
import { BATTING_FIELDS } from "@/lib/scoring-view";

// Pitching steppers; `id` is the testid stem from the §6.1 contract.
const PITCHING: { key: keyof PitchingLine; id: string; label: string }[] = [
  { key: "outsPitched", id: "outs", label: "Innings pitched" },
  { key: "h", id: "p_h", label: "Hits allowed" },
  { key: "r", id: "p_r", label: "Runs allowed" },
  { key: "er", id: "p_er", label: "Earned runs" },
  { key: "bb", id: "p_bb", label: "Walks" },
  { key: "so", id: "p_so", label: "Strikeouts" },
];

const ZERO_PITCHING: PitchingLine = { outsPitched: 0, h: 0, r: 0, er: 0, bb: 0, so: 0 };
const MAX = 99;

// Box score tab (schedule overview §6 item 4): a big button per player who played → the
// stat sheet; below, the shared BoxScore shows the line as fans will see it.
export function ScoringBoxScore({
  scoring,
  players,
}: {
  scoring: Scoring;
  players: Record<string, ScoringPlayer>;
}) {
  const { state } = scoring;
  const [open, setOpen] = useState<string | null>(null);
  const ids = Object.keys(state.statLines).filter((id) => players[id]);
  const rows: PlayerStatLineWithPlayer[] = ids.map((id) => {
    const p = players[id];
    return {
      ...state.statLines[id],
      id,
      gameId: state.id,
      playerId: id,
      teamId: p.teamId,
      player: { id, name: p.name, jerseyNumber: p.jerseyNumber, position: p.position },
    };
  });
  rows.sort((a, b) => (a.player.jerseyNumber ?? 999) - (b.player.jerseyNumber ?? 999));

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-surface px-4 py-5 text-center text-muted">
        No lineup yet. Open the Lineup tab and pick who played.
      </p>
    );
  }

  return (
    <section data-testid="scoring-boxscore" className="flex flex-col gap-4">
      <p className="text-muted">Tap a player to add their stats.</p>
      <ul className="flex flex-col gap-2">
        {rows.map((l) => (
          <li key={l.playerId}>
            <button
              type="button"
              data-testid="boxscore-edit-player"
              data-player-id={l.playerId}
              onClick={() => setOpen(l.playerId)}
              disabled={!scoring.ready}
              className="flex min-h-14 w-full items-center gap-4 rounded-xl bg-white px-4 py-2 text-left ring-1 ring-border outline-focus hover:bg-surface focus-visible:outline-2"
            >
              <span className="w-8 text-right font-display text-xl text-navy tabular-nums">
                {l.player.jerseyNumber ?? "–"}
              </span>
              <span className="grow text-lg font-medium text-foreground">{l.player.name}</span>
              <span className="text-sm text-muted tabular-nums">
                {l.ab} AB · {l.h} H · {l.rbi} RBI
              </span>
            </button>
          </li>
        ))}
      </ul>

      <BoxScore lines={rows} locale="en" title="What fans see" />

      {open && players[open] && state.statLines[open] ? (
        <StatSheet
          scoring={scoring}
          player={players[open]}
          line={state.statLines[open]}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

// One player's stat sheet: big ± steppers per stat; an impossible tap (e.g. a hit with no
// at-bat) is refused and explained (stat-error). Each accepted tap autosaves.
function StatSheet({
  scoring,
  player,
  line,
  onClose,
}: {
  scoring: Scoring;
  player: ScoringPlayer;
  line: StatLineInput;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showPitching, setShowPitching] = useState(line.pitching != null);
  const gameId = scoring.state.id;

  const save = (next: StatLineInput) => {
    const check = validateStatLine(next);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    scoring.commit(
      { kind: "setStatLine", gameId, playerId: player.id, line: next },
      { kind: "setStatLine", gameId, playerId: player.id, line },
    );
  };

  const bumpBatting = (key: keyof BattingLine, delta: 1 | -1) => {
    const value = line[key] + delta;
    if (value < 0 || value > MAX) return;
    save({ ...line, [key]: value });
  };

  const bumpPitching = (key: keyof PitchingLine, delta: 1 | -1) => {
    const p = line.pitching ?? ZERO_PITCHING;
    const value = p[key] + delta;
    if (value < 0 || value > MAX) return;
    save({ ...line, pitching: { ...p, [key]: value } });
  };

  const pitching = line.pitching ?? ZERO_PITCHING;
  const pitchingEmpty = line.pitching != null && Object.values(line.pitching).every((v) => v === 0);

  return (
    <ResponsiveSheet
      title={`Stats for ${player.name}`}
      closeLabel="Done"
      onClose={onClose}
      modalTestId="stat-sheet"
      drawerTestId="stat-sheet"
    >
      {() => (
        <div className="flex flex-col gap-3">
          <p className="font-display text-2xl font-bold text-navy">
            {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ""}
            {player.name}
          </p>
          {error ? (
            <p
              data-testid="stat-error"
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 font-medium text-red-900 ring-1 ring-red-200"
            >
              {error}
            </p>
          ) : null}
          {BATTING_FIELDS.map((f) => (
            <Stepper
              key={f.key}
              id={f.key}
              label={f.label}
              value={line[f.key]}
              onMinus={() => bumpBatting(f.key, -1)}
              onPlus={() => bumpBatting(f.key, 1)}
            />
          ))}

          <button
            type="button"
            data-testid="stat-pitching-toggle"
            aria-expanded={showPitching}
            onClick={() => setShowPitching((v) => !v)}
            className={`${BIG_BUTTON} mt-2 w-full bg-surface text-navy ring-1 ring-border`}
          >
            {showPitching ? "Hide pitching" : "Pitching"}
          </button>
          {showPitching ? (
            <div data-testid="stat-pitching" className="flex flex-col gap-3">
              {PITCHING.map((f) => (
                <Stepper
                  key={f.id}
                  id={f.id}
                  label={f.label}
                  value={
                    f.key === "outsPitched"
                      ? formatInningsPitched(pitching.outsPitched)
                      : pitching[f.key]
                  }
                  minusLabel={f.key === "outsPitched" ? "−⅓" : undefined}
                  plusLabel={f.key === "outsPitched" ? "+⅓" : undefined}
                  onMinus={() => bumpPitching(f.key, -1)}
                  onPlus={() => bumpPitching(f.key, 1)}
                />
              ))}
              {pitchingEmpty ? (
                <button
                  type="button"
                  data-testid="stat-pitching-clear"
                  onClick={() => save({ ...line, pitching: null })}
                  className="min-h-11 self-start rounded-lg px-3 font-semibold text-navy underline"
                >
                  Didn&apos;t pitch
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </ResponsiveSheet>
  );
}

function Stepper({
  id,
  label,
  value,
  onMinus,
  onPlus,
  minusLabel = "−",
  plusLabel = "+",
}: {
  id: string;
  label: string;
  value: number | string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel?: string;
  plusLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-2 py-1 ring-1 ring-border">
      <button
        type="button"
        data-testid={`stat-${id}-minus`}
        aria-label={`${label}: take away one`}
        onClick={onMinus}
        className={`${BIG_BUTTON} bg-surface text-navy`}
      >
        {minusLabel}
      </button>
      <div className="flex grow flex-col items-center">
        <span
          data-testid={`stat-${id}-value`}
          className="font-display text-3xl font-bold tabular-nums text-navy"
        >
          {value}
        </span>
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <button
        type="button"
        data-testid={`stat-${id}-plus`}
        aria-label={`${label}: add one`}
        onClick={onPlus}
        className={`${BIG_BUTTON} bg-navy text-navy-foreground`}
      >
        {plusLabel}
      </button>
    </div>
  );
}
