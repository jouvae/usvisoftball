import Link from "next/link";
import { localizePath } from "@/lib/i18n/locale";
import {
  flagEmoji,
  isUsviTeam,
  teamDisplayName,
  type Locale,
  type ScheduleTeam,
} from "@/lib/schedule-view";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { flag: string; name: string; gap: string }> = {
  sm: { flag: "text-base", name: "text-sm font-semibold", gap: "gap-1.5" },
  md: { flag: "text-xl", name: "text-base font-semibold sm:text-lg", gap: "gap-2" },
  lg: {
    flag: "text-3xl sm:text-4xl",
    name: "font-display text-2xl font-bold tracking-tight sm:text-3xl",
    gap: "gap-3",
  },
};

// One team, everywhere it appears in the schedule (D12): flag emoji (no federation logos —
// trademark, D5) + the localized name (country name for national/guest teams). USVI names get
// navy weight; `href` turns it into a link to the team page (never inside another link).
// Isomorphic: no hooks, safe in Server and Client trees.
export function TeamBadge({
  team,
  locale,
  size = "md",
  href = false,
  testId,
  className = "",
}: {
  team: Pick<ScheduleTeam, "name" | "kind" | "countryCode" | "slug">;
  locale: Locale;
  size?: Size;
  href?: boolean;
  testId?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const name = teamDisplayName(team, locale);
  const flag = flagEmoji(team.countryCode);
  const content = (
    <>
      {flag ? (
        <span aria-hidden="true" className={`${s.flag} leading-none`}>
          {flag}
        </span>
      ) : null}
      <span className={`${s.name} ${isUsviTeam(team) ? "text-navy" : "text-foreground"}`}>
        {name}
      </span>
    </>
  );
  const base = `inline-flex min-w-0 items-center ${s.gap} ${className}`;

  if (href) {
    return (
      <Link
        href={localizePath(locale, `/teams/${team.slug}`)}
        data-testid={testId}
        className={`${base} min-h-11 rounded-md underline-offset-4 outline-focus hover:underline focus-visible:outline-2 focus-visible:outline-offset-2`}
      >
        {content}
      </Link>
    );
  }
  return (
    <span data-testid={testId} className={base}>
      {content}
    </span>
  );
}
