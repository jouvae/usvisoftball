"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoringBoxScore } from "@/components/client/scoring-box-score";
import { ScoringLineup } from "@/components/client/scoring-lineup";
import { ScoringScoreboard } from "@/components/client/scoring-scoreboard";
import { BIG_BUTTON } from "@/components/client/scoring-styles";
import { useScoringQueue, type SyncState } from "@/components/client/use-scoring-queue";
import { TeamBadge } from "@/components/ui/team-badge";
import type { ScheduleTeam, Side } from "@/lib/schedule-view";
import type { ScoringState } from "@/lib/scoring-view";

// A player the scoring screen can name (active USVI roster + anyone who already has a line).
export interface ScoringPlayer {
  id: string;
  teamId: string;
  name: string;
  jerseyNumber: number | null;
  position: string;
}

type Tab = "scoreboard" | "lineup" | "boxscore";

const PILL: Record<SyncState, { text: string; className: string }> = {
  saved: { text: "Saved ✓", className: "bg-emerald-600 text-white" },
  saving: { text: "Saving…", className: "bg-white text-navy" },
  offline: { text: "Offline — will sync", className: "bg-amber-400 text-navy" },
};

// The phone-first game screen (schedule overview §6): sticky sync pill + Undo, tabs for
// Scoreboard / Lineup / Box score (the last two only for USVI games). Every tap autosaves
// through useScoringQueue.
export function ScoringScreen({
  initial,
  away,
  home,
  usviSide,
  roster,
  players,
  isEditor,
}: {
  initial: ScoringState;
  away: ScheduleTeam;
  home: ScheduleTeam;
  usviSide: Side | null;
  roster: ScoringPlayer[];
  players: Record<string, ScoringPlayer>;
  isEditor: boolean;
}) {
  const scoring = useScoringQueue(initial);
  const [tab, setTab] = useState<Tab>("scoreboard");
  const pill = PILL[scoring.status];
  const tabs: { key: Tab; label: string }[] = [
    { key: "scoreboard", label: "Scoreboard" },
    ...(usviSide
      ? ([
          { key: "lineup", label: "Lineup" },
          { key: "boxscore", label: "Box score" },
        ] as const)
      : []),
  ];

  return (
    <div data-testid="scoring-screen" className="-mx-4 -mt-8 flex flex-col">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-navy px-4 py-3 text-navy-foreground shadow-md">
        <Link
          href="/admin/scoring"
          data-testid="scoring-back"
          className="inline-flex min-h-14 items-center rounded-xl px-2 font-semibold outline-focus focus-visible:outline-2"
        >
          ← Games
        </Link>
        <span
          data-testid="scoring-sync-status"
          data-state={scoring.status}
          role="status"
          aria-live="polite"
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${pill.className}`}
        >
          {pill.text}
        </span>
        <button
          type="button"
          data-testid="scoring-undo"
          onClick={scoring.undo}
          disabled={!scoring.canUndo}
          className={`${BIG_BUTTON} bg-white text-navy hover:bg-navy-muted`}
        >
          Undo
        </button>
      </div>

      <div className="px-4 pt-4">
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TeamBadge team={away} locale="en" size="md" />
          <span className="text-muted">at</span>
          <TeamBadge team={home} locale="en" size="md" />
        </h1>

        {scoring.error ? (
          <div
            data-testid="scoring-error"
            role="alert"
            className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-red-900 ring-1 ring-red-200"
          >
            <p className="font-medium">{scoring.error}</p>
            <button
              type="button"
              onClick={scoring.dismissError}
              className="min-h-11 shrink-0 rounded-lg px-3 font-semibold underline"
            >
              OK
            </button>
          </div>
        ) : null}

        <div role="tablist" aria-label="Scoring sections" className="mt-4 grid grid-flow-col gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              data-testid={`scoring-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`${BIG_BUTTON} text-base ${tab === t.key ? "bg-navy text-navy-foreground" : "bg-surface text-navy ring-1 ring-border"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 pb-10">
          {tab === "scoreboard" ? (
            <ScoringScoreboard
              scoring={scoring}
              away={away}
              home={home}
              usviSide={usviSide}
              isEditor={isEditor}
            />
          ) : tab === "lineup" ? (
            <ScoringLineup scoring={scoring} roster={roster} />
          ) : (
            <ScoringBoxScore scoring={scoring} players={players} />
          )}
        </div>
      </div>
    </div>
  );
}
