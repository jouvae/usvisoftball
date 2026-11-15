// Feature softball/schedule — CLIENT-SAFE locale primitives (D9).
//
// No `server-only`, no request access — safe from Client Components and pure helpers
// (lib/schedule-view.ts). The request-bound getLocale(), dictionaries, localizePath() and the
// LocaleProvider arrive with slice S2 and build on these.

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
