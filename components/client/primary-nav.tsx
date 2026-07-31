"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/ui/nav-link";

const NAV_ITEMS = [
  { href: "/news", label: "News", testId: "nav-link-news" },
  { href: "/teams", label: "Teams", testId: "nav-link-teams" },
  { href: "/events", label: "Events", testId: "nav-link-events" },
  { href: "/about", label: "About", testId: "nav-link-about" },
  { href: "/shop", label: "Shop", testId: "nav-link-shop" },
  { href: "/donate", label: "Donate", testId: "nav-link-donate" },
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
        className="md:hidden inline-flex items-center rounded border border-header-muted/40 px-3 py-2 text-sm font-medium uppercase tracking-wide text-header-foreground"
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
            active={pathname === item.href}
            variant={item.href === "/donate" ? "cta" : "default"}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>
    </>
  );
}
