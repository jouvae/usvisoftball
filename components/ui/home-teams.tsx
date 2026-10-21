import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CornerSlash } from "@/components/ui/motifs/corner-slash";
import { SectionHeader } from "@/components/ui/section-header";
import { safeStoredImageHref } from "@/lib/safe-image-url";
import type { Team } from "@/lib/teams-view";

// A short monogram for the no-photo variant: the short name when it is one short word
// ("U18s"), else the initials of the full name ("Women's National Team" → "WNT").
function monogram(team: Team): string {
  if (/^\S{1,4}$/.test(team.shortName)) return team.shortName;
  return team.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter((c) => c && /[A-Za-z0-9]/.test(c))
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

// One national-team card (design guide §2.3): photo (4:3) or a navy-raised monogram block,
// then a navy panel with a gold corner slash, title, 2–3 lines, and a gold "Meet the …"
// affordance. The whole card is ONE link (the title link's `absolute inset-0`); the button
// is a visual cue inside it, not a second link.
function TeamFeatureCard({ team }: { team: Team }) {
  const cover = safeStoredImageHref(team.coverImageUrl);
  return (
    <li
      data-testid="home-team-card"
      data-slug={team.slug}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-navy text-navy-foreground shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-navy-raised">
        {cover ? (
          <Image
            src={cover}
            alt={`${team.name} team photo`}
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full items-center justify-center font-display text-8xl font-bold tracking-tight text-accent/90"
          >
            {monogram(team)}
          </span>
        )}
      </div>
      <div className="relative flex flex-1 flex-col gap-3 p-6 sm:p-8">
        <CornerSlash corner="tr" className="-top-7 size-10" />
        <h3 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          <Link
            href={`/teams/${team.slug}`}
            data-testid="home-team-link"
            className="outline-accent focus:outline-2 focus:outline-offset-4"
          >
            <span className="absolute inset-0" aria-hidden="true" />
            {team.name}
          </Link>
        </h3>
        {team.description ? (
          <p className="line-clamp-3 text-navy-muted">{team.description}</p>
        ) : null}
        <span
          aria-hidden="true"
          className={`${buttonVariants({ variant: "accent", size: "cta" })} mt-auto w-fit`}
        >
          Meet the {team.shortName || team.name}
          <ArrowRight />
        </span>
      </div>
    </li>
  );
}

// Home "Our Teams" section — the national teams, 2-up (3-up on lg when there are three).
// The caller omits the section when there are none.
export function HomeTeamsSection({ teams }: { teams: Team[] }) {
  return (
    <section
      data-testid="home-teams"
      aria-labelledby="home-teams-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20"
    >
      <SectionHeader
        id="home-teams-heading"
        title="Our Teams"
        action={{ href: "/teams", label: "All teams", testId: "home-teams-link" }}
      />
      <ul
        className={`grid gap-6 sm:grid-cols-2 lg:gap-8 ${teams.length >= 3 ? "lg:grid-cols-3" : ""}`}
      >
        {teams.map((team) => (
          <TeamFeatureCard key={team.id} team={team} />
        ))}
      </ul>
    </section>
  );
}
