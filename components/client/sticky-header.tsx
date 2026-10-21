"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// The sticky frosty masthead shell. It is a client component only to expose two bits of
// state as data attributes the (server-rendered) children style against via `group/header`:
//   data-hero="true"  — on the home page AND scrolled to the very top. The crest then grows
//                       and overhangs the hero (design guide §2.1); once the page scrolls it
//                       shrinks back to the inline mark so it never covers content.
// Server children (SiteBrand, PrimaryNav) pass straight through.
export function StickyHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const update = () => setAtTop(window.scrollY < 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      data-testid="site-header"
      data-hero={pathname === "/" && atTop ? "true" : "false"}
      className={`group/header sticky top-0 z-40 border-b border-border bg-white/70 text-header-foreground backdrop-blur-md ${className}`}
    >
      {children}
    </header>
  );
}
