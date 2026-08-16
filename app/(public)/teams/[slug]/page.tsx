import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeamBySlug, ISLAND_LABELS } from "@/lib/teams";
import { TeamRoster } from "@/components/ui/team-roster";

// DELIVER (teams-web-002): one team's detail page — header + roster — from the REAL
// Supabase read via lib/teams (RLS publishable client). `params` is a Promise in Next 16
// and MUST be awaited. An unknown slug → notFound() (404). force-dynamic: reads Supabase,
// never prerendered at build; no generateStaticParams so specific slugs render on demand.
export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: PageProps<"/teams/[slug]">) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  return (
    <section
      data-testid="team-detail"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/teams"
          className="w-fit text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
        >
          ← Teams
        </Link>
        <h1
          data-testid="team-detail-name"
          className="font-display text-4xl font-bold uppercase tracking-tight text-brand"
        >
          {team.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span data-testid="team-detail-island" className="font-semibold">
            {ISLAND_LABELS[team.island]}
          </span>
          {team.division ? (
            <span data-testid="team-detail-division">· {team.division}</span>
          ) : null}
          {team.homeVenue ? (
            <span data-testid="team-detail-venue">· {team.homeVenue}</span>
          ) : null}
          {team.foundedYear ? <span>· Est. {team.foundedYear}</span> : null}
        </div>
      </div>

      {team.description ? (
        <p
          data-testid="team-detail-description"
          className="max-w-3xl text-lg text-foreground"
        >
          {team.description}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-brand">
          Roster
        </h2>
        <TeamRoster players={team.players} />
      </div>
    </section>
  );
}
