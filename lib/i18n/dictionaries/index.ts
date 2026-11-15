import type { Locale } from "@/lib/i18n/locale";
import { en, type Dictionary } from "./en";
import { es } from "./es";

export type { Dictionary };

// Both dictionaries are small and static, so they are bundled together (client-safe).
const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
