"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import { LocaleSwitcher } from "@/components/client/locale-switcher";
import { useDictionary, useLocale } from "@/lib/i18n/client";
import { localizePath, stripLocale } from "@/lib/i18n/locale";
import {
  EVENTS_ENABLED,
  SHOP_ENABLED,
  TEAMS_ENABLED,
} from "@/lib/flags";

// Nav (home-layout design guide §3.1): logo (SiteBrand, → home) on the left; Teams · Events ·
// News · Get Involved · [Shop] · About, then the gold "Support the Federation" pill (/donate,
// opens the donate modal) and the EN | ES switcher. Teams/Events/Shop render only while their flags are on.
// "News" keeps the /articles route and the nav-link-articles testid; the pill keeps
// nav-link-donate. Labels come from the locale dictionary; hrefs are localized (/es…).
type NavKey = "teams" | "events" | "news" | "involved" | "shop" | "about";

const NAV_ITEMS: { href: string; key: NavKey; testId: string }[] = [
  ...(TEAMS_ENABLED
    ? [{ href: "/teams", key: "teams" as const, testId: "nav-link-teams" }]
    : []),
  ...(EVENTS_ENABLED
    ? [{ href: "/events", key: "events" as const, testId: "nav-link-events" }]
    : []),
  { href: "/articles", key: "news", testId: "nav-link-articles" },
  { href: "/get-involved", key: "involved", testId: "nav-link-involved" },
  ...(SHOP_ENABLED
    ? [{ href: "/shop", key: "shop" as const, testId: "nav-link-shop" }]
    : []),
  { href: "/about", key: "about", testId: "nav-link-about" },
];

export function PrimaryNav({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = stripLocale(usePathname());
  const locale = useLocale();
  const t = useDictionary();

  return (
    <>
      <button
        type="button"
        data-testid="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="primary-nav"
        aria-label={t.nav.toggle}
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm font-medium uppercase tracking-wide text-header-foreground hover:bg-surface"
      >
        {t.nav.menu}
      </button>

      <nav
        id="primary-nav"
        aria-label={t.nav.primary}
        data-testid="primary-nav"
        className={`${open ? "flex" : "hidden"} lg:flex basis-full lg:basis-auto w-full lg:w-auto flex-col lg:flex-row lg:items-center gap-1 pt-2 lg:pt-0 ${className}`}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={localizePath(locale, item.href)}
            label={t.nav[item.key]}
            testId={item.testId}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            onNavigate={() => setOpen(false)}
          />
        ))}
        <NavLink
          href={localizePath(locale, "/donate")}
          label={t.nav.donate}
          shortLabel={t.nav.donateShort}
          icon={<Heart aria-hidden="true" className="size-4 fill-current" />}
          testId="nav-link-donate"
          active={false}
          variant="cta"
          supportCta="nav"
          className="mt-2 justify-center lg:mt-0 lg:ml-3"
          onNavigate={() => setOpen(false)}
        />
        <LocaleSwitcher className="mt-2 justify-center lg:mt-0 lg:ml-2" />
      </nav>
    </>
  );
}
