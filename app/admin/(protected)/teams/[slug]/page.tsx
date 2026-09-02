import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/roles";
import { getTeamBySlug } from "@/lib/teams";
import { TEAMS_ENABLED } from "@/lib/flags";
import { PlayerForm } from "@/components/client/player-form";
import { PlayerDeleteButton } from "@/components/client/player-delete-button";
import {
  createPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
} from "./actions";

// The roster (player) admin screen for one team (teams-e2e-004). Editor-only:
// `requireRole('editor')` runs as the FIRST await (redirects a non-editor to /admin) before
// any child renders — RLS re-enforces every write, but the page must not proceed without the
// role. `params` is a Promise in Next 16 and MUST be awaited; an unknown slug → notFound().
// force-dynamic: reads Supabase, must reflect the live roster after each write revalidation.
export const dynamic = "force-dynamic";

export default async function RosterAdminPage({
  params,
}: PageProps<"/admin/teams/[slug]">) {
  if (!TEAMS_ENABLED) notFound(); // dormant for MVP launch
  await requireRole("editor");

  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  return (
    <section data-testid="roster-admin" className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/teams"
          className="w-fit text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          ← Teams administration
        </Link>
        <h1 className="font-display text-3xl font-semibold text-brand">
          {team.name} — roster
        </h1>
      </div>

      {/* ── roster list ──────────────────────────────────────────────────── */}
      {team.players.length === 0 ? (
        <p className="text-sm text-muted">
          This team has no players yet. Add the first one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {team.players.map((player) => (
            <li
              key={player.id}
              data-testid="player-admin-item"
              className="flex flex-col gap-4 rounded-md border border-border p-4"
            >
              <h2
                data-testid="player-admin-name"
                className="font-display text-xl font-semibold text-brand"
              >
                {player.name} · #{player.jerseyNumber}
              </h2>
              <PlayerForm
                action={updatePlayerAction.bind(null, player.id, team.slug)}
                player={player}
                formTestId="pl-edit-form"
                submitTestId="pl-save"
                submitLabel="Save player"
                errorTestId="pl-edit-error"
              />
              <PlayerDeleteButton
                action={deletePlayerAction.bind(null, player.id, team.slug)}
                testId="pl-delete"
                errorTestId="pl-delete-error"
                label="Remove player"
              />
            </li>
          ))}
        </ul>
      )}

      {/* ── add-player ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <h2 className="font-display text-xl font-semibold text-brand">
          Add a player
        </h2>
        <PlayerForm
          action={createPlayerAction.bind(null, team.id, team.slug)}
          formTestId="pl-add-form"
          submitTestId="pl-add"
          submitLabel="Add player"
          errorTestId="pl-add-error"
        />
      </div>
    </section>
  );
}
