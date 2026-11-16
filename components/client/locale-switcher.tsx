"use client";

import { usePathname } from "next/navigation";
import { useDictionary, useLocale } from "@/lib/i18n/client";
import { LOCALES, localizePath, stripLocale } from "@/lib/i18n/locale";

// EN | ES switcher: links to the current page in each locale (the path is kept). usePathname()
// is stripped of any /es prefix first, so the counterpart is right whether it reports the
// browser URL or the rewritten internal path. Plain anchors (full document load), not
// next/link: the locale lives in the root layout (<html lang>, LocaleProvider), which a
// client-side navigation would not re-render.
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useDictionary();
  const path = stripLocale(usePathname());

  return (
    <div
      role="group"
      aria-label={t.locale.switcher}
      data-testid="locale-switcher"
      className={`inline-flex min-h-11 items-center gap-1 text-sm font-semibold tracking-wide ${className}`}
    >
      {LOCALES.map((code, i) => {
        const active = code === locale;
        return (
          <span key={code} className="inline-flex items-center gap-1">
            {i > 0 ? (
              <span aria-hidden="true" className="text-header-muted">
                |
              </span>
            ) : null}
            <a
              href={localizePath(code, path)}
              hrefLang={code}
              lang={code}
              data-testid={`locale-link-${code}`}
              aria-current={active ? "true" : undefined}
              aria-label={t.locale[code]}
              className={`rounded px-2 py-2 uppercase outline-focus focus:outline-2 focus:outline-offset-2 ${
                active
                  ? "text-navy underline decoration-accent decoration-2 underline-offset-4"
                  : "text-header-muted hover:text-header-foreground"
              }`}
            >
              {code}
            </a>
          </span>
        );
      })}
    </div>
  );
}
