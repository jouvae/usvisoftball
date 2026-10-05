import Link from "next/link";

export type NavLinkProps = {
  href: string;
  label: string;
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
  testId,
  active,
  variant = "default",
  external = false,
  onNavigate,
  className = "",
}: NavLinkProps) {
  const base =
    "inline-flex items-center px-3 py-2 text-sm font-medium tracking-wide transition-colors";

  // Frosty-white nav: dark text on translucent white. The Donate CTA is the yellow accent
  // pill (dark text); active links are brand-blue with an accent underline.
  const variantClass =
    variant === "cta"
      ? "rounded-full bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover"
      : active
        ? "text-brand border-b-2 border-accent"
        : "text-header-muted hover:text-header-foreground";

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
        {label}
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
      {label}
    </Link>
  );
}
