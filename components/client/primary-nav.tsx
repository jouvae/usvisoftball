"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import {
  EVENTS_ENABLED,
  PAYPAL_DONATE_URL,
  SHOP_ENABLED,
  TEAMS_ENABLED,
} from "@/lib/flags";

// Nav (home-layout design guide §3.1): logo (SiteBrand, → home) on the left; Teams · Events ·
// News · Get Involved · [Shop] · About, then the gold "Support the Federation" pill (external,
// PayPal). Teams/Events/Shop render only while their flags are on. "News" keeps the
// /articles route and the nav-link-articles testid; the pill keeps nav-link-donate.
const NAV_ITEMS = [
  ...(TEAMS_ENABLED
    ? [{ href: "/teams", label: "Teams", testId: "nav-link-teams" }]
    : []),
  ...(EVENTS_ENABLED
    ? [{ href: "/events", label: "Events", testId: "nav-link-events" }]
    : []),
  { href: "/articles", label: "News", testId: "nav-link-articles" },
  { href: "/get-involved", label: "Get Involved", testId: "nav-link-involved" },
  ...(SHOP_ENABLED
    ? [{ href: "/shop", label: "Shop", testId: "nav-link-shop" }]
    : []),
  { href: "/about", label: "About", testId: "nav-link-about" },
];

export function PrimaryNav({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        data-testid="mobile-nav-toggle"
        aria-expanded={open}
        aria-controls="primary-nav"
        aria-label="Toggle navigation"
        onClick={() => setOpen((v) => !v)}
        className="lg:hidden inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-sm font-medium uppercase tracking-wide text-header-foreground hover:bg-surface"
      >
        Menu
      </button>

      <nav
        id="primary-nav"
        aria-label="Primary"
        data-testid="primary-nav"
        className={`${open ? "flex" : "hidden"} lg:flex basis-full lg:basis-auto w-full lg:w-auto flex-col lg:flex-row lg:items-center gap-1 pt-2 lg:pt-0 ${className}`}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            testId={item.testId}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            onNavigate={() => setOpen(false)}
          />
        ))}
        <NavLink
          href={PAYPAL_DONATE_URL}
          label="Support the Federation"
          shortLabel="Support"
          icon={<Heart aria-hidden="true" className="size-4 fill-current" />}
          testId="nav-link-donate"
          active={false}
          variant="cta"
          external
          className="mt-2 justify-center lg:mt-0 lg:ml-3"
          onNavigate={() => setOpen(false)}
        />
      </nav>
    </>
  );
}
