import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { CornerSlash } from "@/components/ui/motifs/corner-slash";
import { IslandSilhouettes } from "@/components/ui/motifs/island-silhouettes";
import { EVENTS_ENABLED, TEAMS_ENABLED } from "@/lib/flags";

// Home hero (design guide §2.1), no-photo variant: solid navy band with large faint island
// outlines on the right and a gold corner slash. When a hero photo exists it slots in behind
// the scrim — not yet (no real photography).
//
// CTAs: at most two. The design targets Teams + Events; while those routes are flag-gated off
// the hero falls back to News + Get Involved so it never links to a 404. "Support" is NOT
// here — the nav pill carries it.
export function HomeHero() {
  const primary = TEAMS_ENABLED
    ? { href: "/teams", label: "Explore our teams", testId: "hero-teams-cta" }
    : { href: "/articles", label: "Read the latest", testId: "hero-articles-cta" };
  const secondary = EVENTS_ENABLED
    ? { href: "/events", label: "Upcoming events", testId: "hero-events-cta", icon: true }
    : { href: "/get-involved", label: "Get involved", testId: "hero-involved-cta", icon: false };

  return (
    <section
      data-testid="home-hero"
      aria-labelledby="home-hero-heading"
      className="relative isolate overflow-hidden bg-navy text-navy-foreground"
    >
      <IslandSilhouettes className="pointer-events-none absolute -right-24 top-1/2 -z-10 w-[56rem] max-w-none -translate-y-1/2 fill-white/5 sm:-right-16 lg:right-0" />
      <CornerSlash corner="br" className="hidden lg:block" />

      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-20 sm:px-6 sm:py-24 lg:min-h-[600px] lg:justify-center lg:pt-28">
        <div className="flex max-w-xl flex-col gap-5">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent sm:text-base">
            Virgin Islands
          </p>
          <h1
            id="home-hero-heading"
            className="font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="sr-only">U.S. Virgin Islands </span>
            <span className="block text-accent">Softball</span>
            <span className="block">Federation</span>
          </h1>
          <AccentRule />
          <p
            data-testid="home-hero-tagline"
            className="text-lg font-semibold sm:text-xl"
          >
            From the Virgin Islands to the World.
          </p>
          <p className="text-base leading-relaxed text-navy-muted sm:text-lg">
            We support athletes, coaches, and officials across St. Thomas, St. Croix, and
            St. John — and field the women&apos;s and U18 girls&apos; national teams in
            regional and international competition.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primary.href}
              data-testid={primary.testId}
              className={buttonVariants({ variant: "accent", size: "cta" })}
            >
              {primary.label}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href={secondary.href}
              data-testid={secondary.testId}
              className={buttonVariants({ variant: "outline-dark", size: "cta" })}
            >
              {secondary.icon ? <CalendarDays aria-hidden="true" /> : null}
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
