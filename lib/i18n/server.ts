import "server-only";
import { headers } from "next/headers";
import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER,
  isLocale,
  localizePath,
  type Locale,
} from "@/lib/i18n/locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

// The request's locale, from the `x-locale` header proxy.ts sets on every public request
// (`es` for /es…, else `en`). No header (or an unknown value) → English. Reading headers()
// makes the caller request-time rendered.
export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// The request locale's UI strings.
export async function getT(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}

// Metadata `alternates` for a localized page, given its internal (unprefixed) path: canonical is
// the current locale's URL; hreflang en / es / x-default (= English). Relative URLs resolve
// against the root layout's metadataBase, so the tags come out absolute.
export async function alternatesFor(path: string): Promise<Metadata["alternates"]> {
  const locale = await getLocale();
  return {
    canonical: localizePath(locale, path),
    languages: {
      en: localizePath("en", path),
      es: localizePath("es", path),
      "x-default": localizePath(DEFAULT_LOCALE, path),
    },
  };
}
