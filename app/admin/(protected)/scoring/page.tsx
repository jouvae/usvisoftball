import type { Metadata } from "next";
import Link from "next/link";
import { EventStateChip } from "@/components/ui/event-state-chip";
import { TeamBadge } from "@/components/ui/team-badge";
import { requireAnyRole } from "@/lib/roles";
import {
  formatEventTime,
  formatShortDate,
  isUsviGame,
  needsScore,
  venueZoneLabel,
} from "@/lib/schedule-view";
import { listScoringGames, scoringDayGroup } from "@/lib/scoring";

export const metadata: Metadata = { title: "Scoring" };

const GROUP_LABEL = { today: "Today", upcoming: "Coming up", past: "Finished" } as const;

// /admin/scoring (schedule overview §6 item 1, §6.1): every game, today's first (venue-local),
// then upcoming, then recent; USVI games first within a day. One big tap row per game.
// Scorekeeper OR editor; anyone else is redirected (requireAnyRole → /admin or login).
// A game whose slot is over without a final score is flagged "Needs score" (home-feed Phase B)
// — the public site shows it as "Final · score pending" until then.
export default async function ScoringGamesPage() {
  await requireAnyRole(["scorekeeper", "editor"]);
  const now = new Date();
  const nowIso = now.toISOString();
  const games = await listScoringGames(nowIso);

  return (
    <section data-testid="scoring-home" className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="font-display text-3xl font-bold text-navy">Pick a game to score</h1>
      {games.length === 0 ? (
        <p className="rounded-xl bg-surface px-4 py-5 text-center text-muted">No games yet.</p>
      ) : null}
      <ul data-testid="scoring-games" className="flex flex-col gap-3">
        {games.map((row) => {
          const group = scoringDayGroup(row, nowIso);
          const when =
            group === "today"
              ? `Today · ${formatEventTime(row.startsAt, row.timezone, "en")}`
              : `${formatShortDate(row.startsAt, row.timezone, "en")} · ${formatEventTime(row.startsAt, row.timezone, "en")}`;
          const missing = needsScore(row, now);
          return (
            <li key={row.id}>
              <Link
                href={`/admin/scoring/${row.slug}`}
                data-testid="scoring-game-link"
                data-slug={row.slug}
                data-group={group}
                data-needs-score={missing ? "true" : undefined}
                className={`flex min-h-16 flex-col gap-2 rounded-2xl bg-white px-4 py-3 ring-1 outline-focus hover:bg-surface focus-visible:outline-2 ${isUsviGame(row.game) ? "ring-2 ring-navy" : "ring-border"}`}
              >
                <span className="flex items-center justify-between gap-3 text-sm text-muted">
                  <span>
                    <span className="font-semibold text-navy">{GROUP_LABEL[group]}</span> · {when}{" "}
                    {venueZoneLabel(row.timezone, "en")}
                  </span>
                  <span className="flex items-center gap-2">
                    {missing ? (
                      <span
                        data-testid="scoring-needs-score"
                        className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300"
                      >
                        Needs score
                      </span>
                    ) : null}
                    <EventStateChip event={row} locale="en" />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <TeamBadge team={row.game.away} locale="en" size="md" />
                  <span className="text-muted">at</span>
                  <TeamBadge team={row.game.home} locale="en" size="md" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
