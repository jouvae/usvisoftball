import type { LucideIcon } from "lucide-react";
import { Award, CalendarDays, Flag, Medal, Trophy, Users } from "lucide-react";
import { IslandSilhouettes } from "@/components/ui/motifs/island-silhouettes";
import {
  formatAsOf,
  safeSourceHref,
  type HomeStat,
  type StatIcon,
} from "@/lib/stats-view";

const ICONS: Record<StatIcon, LucideIcon> = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  users: Users,
  calendar: CalendarDays,
  flag: Flag,
};

// The home stats strip (design guide §2.2): up to three editor-published figures, every one
// the same shape — medallion icon · label · big value · optional detail · "as of" date. The
// caller omits the strip entirely when there are no published stats. White surface with
// the island outlines very faint behind; no photo (assessment C11). <dl> semantics: each
// stat is a <dt> label + <dd> value/detail.
export function StatsStrip({ stats }: { stats: HomeStat[] }) {
  return (
    <section
      data-testid="home-stats"
      aria-label="Federation at a glance"
      className="relative isolate overflow-hidden border-b border-border bg-white"
    >
      <IslandSilhouettes className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[64rem] max-w-none -translate-x-1/2 -translate-y-1/2 fill-navy/[0.03]" />
      <dl
        className={`mx-auto grid w-full max-w-6xl divide-y divide-accent px-4 sm:divide-x sm:divide-y-0 sm:px-6 ${
          stats.length === 1 ? "" : stats.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
        }`}
      >
        {stats.map((stat) => {
          const Icon = ICONS[stat.icon];
          const source = safeSourceHref(stat.sourceUrl);
          return (
            <div
              key={stat.id}
              data-testid="home-stat"
              className="flex flex-col items-center gap-2 px-4 py-10 text-center sm:my-6 sm:py-4"
            >
              <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-navy text-accent">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <dt
                data-testid="home-stat-label"
                className="font-display text-lg font-semibold tracking-tight text-navy"
              >
                {stat.label}
              </dt>
              <dd className="flex flex-col items-center gap-1">
                <span
                  data-testid="home-stat-value"
                  className="font-display text-5xl font-bold leading-none text-navy sm:text-6xl"
                >
                  {stat.value}
                </span>
                {stat.detail ? (
                  source ? (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="home-stat-detail"
                      className="mt-1 text-sm text-brand underline-offset-4 outline-focus hover:underline focus:outline-2"
                    >
                      {stat.detail}
                      <span className="sr-only"> (source, opens in a new tab)</span>
                    </a>
                  ) : (
                    <span data-testid="home-stat-detail" className="mt-1 text-sm text-muted">
                      {stat.detail}
                    </span>
                  )
                ) : null}
                <span data-testid="home-stat-as-of" className="text-xs text-muted">
                  as of{" "}
                  <time dateTime={stat.asOf}>{formatAsOf(stat.asOf)}</time>
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
