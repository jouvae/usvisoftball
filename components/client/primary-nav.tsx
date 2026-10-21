"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/ui/nav-link";
import { PAYPAL_DONATE_URL, SHOP_ENABLED } from "@/lib/flags";

// Nav: logo (SiteBrand, → home) on the left; Articles · About · [Shop] · Donate on the
// right. Teams/Events stay dormant (flagged off). Shop shows ONLY when SHOP_ENABLED — it's
// a redesign placeholder until real commerce lands. Donate is an external CTA to PayPal.
const NAV_ITEMS = [
  { href: "/articles", label: "Articles", testId: "nav-link-articles" },
  { href: "/about", label: "About", testId: "nav-link-about" },
  ...(SHOP_ENABLED
    ? [{ href: "/shop", label: "Shop", testId: "nav-link-shop" }]
    : []),
] as const;

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
        className="md:hidden inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium uppercase tracking-wide text-header-foreground hover:bg-surface"
      >
        Menu
      </button>

      <nav
        id="primary-nav"
        aria-label="Primary"
        data-testid="primary-nav"
        className={`${open ? "flex" : "hidden"} md:flex basis-full md:basis-auto w-full md:w-auto flex-col md:flex-row md:items-center gap-1 pt-2 md:pt-0 ${className}`}
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
          label="Donate"
          testId="nav-link-donate"
          active={false}
          variant="cta"
          external
          onNavigate={() => setOpen(false)}
        />
      </nav>
    </>
  );
}
