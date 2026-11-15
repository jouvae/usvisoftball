import "server-only";
import type { MetadataRoute } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { EVENTS_ENABLED, SHOP_ENABLED, TEAMS_ENABLED } from "@/lib/flags";
import { localizePath } from "@/lib/i18n/locale";
import { SITE_URL } from "@/lib/site";

// Feature softball/schedule S5 (schedule-web-023) — the entries behind app/sitemap.ts. Every
// public page is listed once per locale (en unprefixed, es under /es), each entry carrying the
// en + es hreflang alternates, as absolute SITE_URL URLs. Dormant (flag-off) sections are left
// out, matching the pages' notFound(). Reads through the RLS-enforced public client.

// Upper bound per table — far above today's ~40 events / ~30 teams.
const SITEMAP_LIMIT = 1000;

// Static public pages (internal, unprefixed paths) and the flag that gates each, if any.
const STATIC_PAGES: readonly { path: string; enabled: boolean }[] = [
  { path: "/", enabled: true },
  { path: "/about", enabled: true },
  { path: "/articles", enabled: true },
  { path: "/get-involved", enabled: true },
  { path: "/donate", enabled: true },
  { path: "/events", enabled: EVENTS_ENABLED },
  { path: "/teams", enabled: TEAMS_ENABLED },
  { path: "/shop", enabled: SHOP_ENABLED },
];

type SlugRow = { slug: string; updated_at: string | null };

async function slugs(supabase: SupabaseClient, table: string): Promise<SlugRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select("slug,updated_at")
    .order("slug", { ascending: true })
    .limit(SITEMAP_LIMIT);
  if (error) throw error;
  return (data as SlugRow[] | null) ?? [];
}

// The absolute URL of an internal path in a locale ("/" en → SITE_URL itself).
function absolute(locale: "en" | "es", path: string): string {
  const p = localizePath(locale, path);
  return p === "/" ? SITE_URL : `${SITE_URL}${p}`;
}

// One <url> per locale for a page, each carrying the en / es / x-default (= en) alternates.
function localized(path: string, lastModified?: string | null): MetadataRoute.Sitemap {
  const en = absolute("en", path);
  const languages = { en, es: absolute("es", path), "x-default": en };
  return (["en", "es"] as const).map((locale) => ({
    url: languages[locale],
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

export async function sitemapEntries(
  supabase: SupabaseClient = createPublicClient(),
): Promise<MetadataRoute.Sitemap> {
  const [events, tournaments, teams] = await Promise.all([
    EVENTS_ENABLED ? slugs(supabase, "calendar_events") : [],
    EVENTS_ENABLED ? slugs(supabase, "tournaments") : [],
    TEAMS_ENABLED ? slugs(supabase, "teams") : [],
  ]);
  return [
    ...STATIC_PAGES.filter((p) => p.enabled).flatMap((p) => localized(p.path)),
    ...events.flatMap((r) => localized(`/events/${r.slug}`, r.updated_at)),
    ...tournaments.flatMap((r) => localized(`/tournaments/${r.slug}`, r.updated_at)),
    ...teams.flatMap((r) => localized(`/teams/${r.slug}`, r.updated_at)),
  ];
}
