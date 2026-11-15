// Feature softball/schedule — CLIENT-SAFE locale primitives (D9).
//
// No `server-only`, no request access — safe from Client Components and pure helpers
// (lib/schedule-view.ts). The request-bound getLocale() lives in lib/i18n/server.ts; the client
// LocaleProvider in lib/i18n/client.tsx; the UI strings in lib/i18n/dictionaries/.

// Supported public-site locales. English is unprefixed; Spanish lives under /es/….
export type Locale = "en" | "es";

// Every supported locale, in switcher order.
export const LOCALES: readonly Locale[] = ["en", "es"];

// The locale used when no /es prefix is present (and for x-default hreflang).
export const DEFAULT_LOCALE: Locale = "en";

// Narrow an arbitrary string (e.g. the x-locale request header) to a Locale.
export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "es";
}

// The request header the proxy sets on every public request (proxy.ts): `es` for /es…, else `en`.
export const LOCALE_HEADER = "x-locale";

// The path prefix Spanish pages are served under (rewritten to the unprefixed route by proxy.ts).
const ES_PREFIX = "/es";

// True when a browser pathname is the Spanish prefix itself or lives under it.
export function hasLocalePrefix(pathname: string): boolean {
  return pathname === ES_PREFIX || pathname.startsWith(`${ES_PREFIX}/`);
}

// The locale-neutral (internal, English) path for a browser pathname: "/es/events" → "/events",
// "/es" → "/". Unprefixed paths pass through unchanged.
export function stripLocale(pathname: string): string {
  if (!hasLocalePrefix(pathname)) return pathname;
  return pathname.slice(ES_PREFIX.length) || "/";
}

// The public URL of an internal path in a locale: English stays unprefixed; Spanish gets /es
// ("/" → "/es", "/events" → "/es/events"). Only for internal, root-relative paths.
export function localizePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? ES_PREFIX : `${ES_PREFIX}${path}`;
}
