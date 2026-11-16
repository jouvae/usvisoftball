import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScoringScreen, type ScoringPlayer } from "@/components/client/scoring-screen";
import { requireAnyRole } from "@/lib/roles";
import { isUsviTeam, type Side, type StatLineInput } from "@/lib/schedule-view";
import { getScoringGame, type ScoringState } from "@/lib/scoring";

export const metadata: Metadata = { title: "Keep score" };

// /admin/scoring/[slug] (schedule overview §6 items 2–5, §6.1): the phone-first game screen.
// Server-side: role gate, then one read of the game + innings + box score + ACTIVE USVI roster
// through the cookie session client. Everything interactive is the ScoringScreen island.
export default async function ScoringGamePage({ params }: PageProps<"/admin/scoring/[slug]">) {
  const { profile } = await requireAnyRole(["scorekeeper", "editor"]);
  const { slug } = await params;
  const detail = await getScoringGame(slug);
  if (!detail) notFound();
  const game = detail.game;

  const usviSides = (["away", "home"] as const).filter((s) => isUsviTeam(game[s]));
  const usviSide: Side | null = usviSides.length === 1 ? usviSides[0] : null;

  const statLines: Record<string, StatLineInput> = {};
  const players: Record<string, ScoringPlayer> = {};
  for (const l of detail.statLines) {
    const { ab, r, h, doubles, triples, hr, rbi, bb, so, sb, pitching } = l;
    statLines[l.playerId] = { ab, r, h, doubles, triples, hr, rbi, bb, so, sb, pitching };
    players[l.playerId] = {
      id: l.playerId,
      teamId: l.teamId,
      name: l.player.name,
      jerseyNumber: l.player.jerseyNumber,
      position: l.player.position ?? "",
    };
  }
  const roster: ScoringPlayer[] = usviSide
    ? detail.rosters[usviSide].map((p) => ({
        id: p.id,
        teamId: game[usviSide].id,
        name: p.name,
        jerseyNumber: p.jerseyNumber,
        position: p.position ?? "",
      }))
    : [];
  for (const p of roster) players[p.id] ??= p;

  const initial: ScoringState = {
    id: game.id,
    state: game.state,
    currentInning: game.currentInning,
    awayHits: game.awayHits,
    awayErrors: game.awayErrors,
    homeHits: game.homeHits,
    homeErrors: game.homeErrors,
    innings: game.innings,
    statLines,
  };

  return (
    <ScoringScreen
      initial={initial}
      away={game.away}
      home={game.home}
      usviSide={usviSide}
      roster={roster}
      players={players}
      isEditor={profile.roles.includes("editor")}
    />
  );
}
