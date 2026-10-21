import type { ReactNode } from "react";
import Link from "next/link";

export type NavLinkProps = {
  href: string;
  label: string;
  // Optional shorter label shown below `xl` (the Support pill: "Support the Federation" → "Support").
  shortLabel?: string;
  icon?: ReactNode;
  testId: string;
  active: boolean;
  variant?: "default" | "cta";
  external?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function NavLink({
  href,
  label,
  shortLabel,
  icon,
  testId,
  active,
  variant = "default",
  external = false,
  onNavigate,
  className = "",
}: NavLinkProps) {
  const base =
    "inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium tracking-wide transition-colors outline-focus focus:outline-2 focus:outline-offset-2";

  // Frosty-white nav: dark text on translucent white. The Support CTA is the gold pill (navy
  // text) — the only pill in the UI. Active links are navy with a gold underline; the
  // underline is not the only signal (aria-current is set on internal links).
  const variantClass =
    variant === "cta"
      ? "rounded-full bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover focus:outline-navy"
      : active
        ? "text-navy border-b-2 border-accent"
        : "text-header-muted hover:text-header-foreground";

  const content = (
    <>
      {icon}
      {shortLabel ? (
        <>
          <span className="xl:hidden">{shortLabel}</span>
          <span className="hidden xl:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </>
  );

  // External links (e.g. the PayPal Donate button) open in a new tab as a plain anchor;
  // internal links use next/link for client routing.
  if (external) {
    return (
      <a
        href={href}
        data-testid={testId}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={`${base} ${variantClass} ${className}`}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`${base} ${variantClass} ${className}`}
    >
      {content}
    </Link>
  );
}
