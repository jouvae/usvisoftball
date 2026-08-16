import { requireRole } from "@/lib/roles";
import { listTeams } from "@/lib/teams";
import { TeamForm } from "@/components/client/team-form";
import { TeamDeleteButton } from "@/components/client/team-delete-button";
import {
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
} from "./actions";

// The teams admin screen (teams-e2e-003). Editor-only: `requireRole('editor')` runs as the
// FIRST await (redirects a non-editor to /admin) before any child renders — RLS re-enforces
// every write, but the page must not proceed without the role. Teams are mutable and read via
// the RLS client, so force per-request rendering: the list must reflect the live rows after
// each write revalidation. Flat list is fine for admin (rows already ordered sort_order, name).
export const dynamic = "force-dynamic";

export default async function TeamsAdminPage() {
  await requireRole("editor");

  const teams = await listTeams();

  return (
    <section data-testid="teams-admin" className="flex flex-col gap-10">
      <h1 className="font-display text-3xl font-semibold text-brand">
        Teams administration
      </h1>

      {/* ── add-team ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Add a team
        </h2>
        <TeamForm
          action={createTeamAction}
          formTestId="team-add-form"
          submitTestId="team-add"
          submitLabel="Add team"
          errorTestId="team-add-error"
        />
      </div>

      {/* ── team list ────────────────────────────────────────────────────── */}
      <ul className="flex flex-col gap-8">
        {teams.map((team) => (
          <li
            key={team.id}
            data-testid="team-admin-item"
            className="flex flex-col gap-4 rounded-md border border-border p-4"
          >
            <h2
              data-testid="team-admin-name"
              className="font-display text-xl font-semibold text-brand"
            >
              {team.name}
            </h2>
            <TeamForm
              action={updateTeamAction.bind(null, team.id)}
              team={team}
              formTestId="team-edit-form"
              submitTestId="team-save"
              submitLabel="Save team"
              errorTestId="team-edit-error"
            />
            <TeamDeleteButton
              action={deleteTeamAction.bind(null, team.id)}
              testId="team-delete"
              errorTestId="team-delete-error"
              label="Delete team"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
