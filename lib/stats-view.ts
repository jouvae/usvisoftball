// Feature softball/home-layout — home stats: CLIENT-SAFE view types + constants.
//
// No `server-only`, no Supabase client — safe to import from Client Components (the admin
// stat form's icon <select>). lib/stats.ts (server-only) re-exports these. Same split as
// lib/events-view.ts / lib/teams-view.ts.

export type StatIcon = "trophy" | "medal" | "award" | "users" | "calendar" | "flag";

export const STAT_ICON_LABELS: Record<StatIcon, string> = {
  trophy: "Trophy",
  medal: "Medal",
  award: "Award / ranking",
  users: "Team",
  calendar: "Calendar",
  flag: "Flag",
};

// Column limits — mirrored by the 0023 CHECK constraints and the form's maxLength.
export const STAT_LIMITS = { label: 40, value: 12, detail: 60 } as const;

export interface HomeStat {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: StatIcon;
  asOf: string; // ISO date 'YYYY-MM-DD'
  sourceUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export function isStatIcon(v: string): v is StatIcon {
  return Object.prototype.hasOwnProperty.call(STAT_ICON_LABELS, v);
}

// Render-time guard for a stat's source link: the URL ONLY if it parses as https, else ''.
// Defense-in-depth twin of the write-path check (lib/stats.ts) and the 0023 CHECK — a value
// that reached the DB some other way never renders as a live javascript:/data: href.
export function safeSourceHref(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

// "as of Oct 2026" — month + year of the as_of date, in UTC so the date never shifts a day.
export function formatAsOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
