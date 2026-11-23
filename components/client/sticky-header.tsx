import type { ReactNode } from "react";

// The sticky frosty masthead shell. Server children (SiteBrand, PrimaryNav) pass straight
// through. (It used to track a home-at-top "hero" state for an oversized crest; the hero went
// with the home feed — home-feed H2 — so the header is the same on every page.)
export function StickyHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-testid="site-header"
      className={`group/header sticky top-0 z-40 border-b border-border bg-white/70 text-header-foreground backdrop-blur-md ${className}`}
    >
      {children}
    </header>
  );
}
