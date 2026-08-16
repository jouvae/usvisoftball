import Link from "next/link";
import { safeLogoHref } from "@/lib/teams-view";
import type { Island, Team } from "@/lib/teams";

// The public teams directory on /teams (teams-web-001). Server Component — no
// interactivity. Teams are grouped by island (caller passes non-empty groups in display
// order); each card shows name, division, description, home venue, and a logo if set. All
// text React-escaped. A logo is rendered as a plain <img> (a local /public path today; the
// admin-CRUD slice adds uploads). Empty groups are omitted upstream.
export function TeamsDirectory({
  groups,
  testId = "teams-directory",
}: {
  groups: { island: Island; label: string; teams: Team[] }[];
  testId?: string;
}) {
  if (groups.length === 0) return null;

  return (
    <section data-testid={testId} className="flex flex-col gap-12">
      {groups.map((group) => (
        <div
          key={group.island}
          data-testid="team-island-group"
          className="flex flex-col gap-6"
        >
          <h2
            data-testid="team-island-name"
            className="font-display text-2xl font-bold uppercase tracking-tight text-brand"
          >
            {group.label}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.teams.map((team) => {
              const logo = safeLogoHref(team.logoUrl);
              return (
              <article
                key={team.id}
                data-testid="team-card"
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-5"
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt={`${team.name} logo`}
                    data-testid="team-logo"
                    className="h-16 w-16 rounded-md object-contain"
                  />
                ) : null}
                <h3 className="font-display text-xl font-bold leading-tight tracking-tight text-brand">
                  <Link
                    href={`/teams/${team.slug}`}
                    data-testid="team-name"
                    className="underline-offset-4 hover:text-brand-hover hover:underline"
                  >
                    {team.name}
                  </Link>
                </h3>
                <span
                  data-testid="team-division"
                  className="inline-flex w-fit items-center rounded bg-accent px-2 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-foreground"
                >
                  {team.division || "Team"}
                </span>
                {team.description ? (
                  <p
                    data-testid="team-description"
                    className="text-sm text-foreground"
                  >
                    {team.description}
                  </p>
                ) : null}
                {team.homeVenue ? (
                  <p data-testid="team-venue" className="text-sm text-muted">
                    {team.homeVenue}
                    {team.foundedYear ? ` · Est. ${team.foundedYear}` : ""}
                  </p>
                ) : null}
              </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
