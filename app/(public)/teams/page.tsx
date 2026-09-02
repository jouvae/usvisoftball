import { notFound } from "next/navigation";
import { listTeams, groupTeamsByIsland } from "@/lib/teams";
import { TeamsDirectory } from "@/components/ui/teams-directory";
import { TEAMS_ENABLED } from "@/lib/flags";

// DELIVER (teams-web-001): the public teams directory, rendered from the REAL Supabase
// read via lib/teams (RLS-enforced publishable client), grouped by island. force-dynamic:
// this reads Supabase, and must never be prerendered at build (no env on the Fly builder).
// Server Component; roots at <section>s — the layout owns the sole <main> landmark.
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  if (!TEAMS_ENABLED) notFound(); // dormant for MVP launch
  const teams = await listTeams();
  const groups = groupTeamsByIsland(teams);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-brand">
          Teams
        </h1>
        <p className="max-w-3xl text-lg text-muted">
          Member clubs of the USVI Softball Federation, across St. Thomas, St.
          John, and St. Croix.
        </p>
      </div>

      {groups.length > 0 ? (
        <TeamsDirectory groups={groups} />
      ) : (
        <p data-testid="teams-empty" className="text-muted">
          Teams will be listed here soon.
        </p>
      )}
    </section>
  );
}
