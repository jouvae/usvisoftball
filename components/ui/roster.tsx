import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  flagEmoji,
  teamDisplayName,
  type Locale,
  type ScheduleTeam,
} from "@/lib/schedule-view";
import type { TeamPlayer } from "@/lib/teams-view";

// The USVI roster on an event page (D5/D10): one section, a list per USVI side of ACTIVE players
// (number, name, position). A side with no active players reads "Roster to be announced".
// Inactive players are filtered here too, so no caller can leak them. Isomorphic.
export function Roster({
  sides,
  locale,
  className = "",
}: {
  sides: { team: Pick<ScheduleTeam, "id" | "name" | "kind" | "countryCode">; players: TeamPlayer[] }[];
  locale: Locale;
  className?: string;
}) {
  const t = getDictionary(locale).schedule;
  return (
    <section data-testid="roster" aria-labelledby="roster-heading" className={className}>
      <h2
        id="roster-heading"
        className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-navy"
      >
        {t.roster}
      </h2>
      <div className="flex flex-col gap-4">
        {sides.map(({ team, players }) => {
          const active = players.filter((p) => p.active);
          return (
            <div key={team.id} className="flex flex-col gap-2">
              {sides.length > 1 ? (
                <h3 className="text-sm font-semibold text-navy">
                  {flagEmoji(team.countryCode)} {teamDisplayName(team, locale)}
                </h3>
              ) : null}
              {active.length === 0 ? (
                <p
                  data-testid="roster-tba"
                  className="rounded-xl bg-surface px-4 py-5 text-center text-sm text-muted"
                >
                  {t.rosterTba}
                </p>
              ) : (
                <ul role="list" className="grid gap-2 sm:grid-cols-2">
                  {active.map((p) => (
                    <li
                      key={p.id}
                      data-testid="roster-player"
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-border"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-navy-foreground tabular-nums">
                        {p.jerseyNumber ?? "–"}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.position ? (
                        <span className="font-display text-sm font-semibold text-muted">
                          {p.position}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
