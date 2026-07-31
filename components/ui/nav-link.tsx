import Link from "next/link";

export type NavLinkProps = {
  href: string;
  label: string;
  testId: string;
  active: boolean;
  variant?: "default" | "cta";
  onNavigate?: () => void;
  className?: string;
};

export function NavLink({
  href,
  label,
  testId,
  active,
  variant = "default",
  onNavigate,
  className = "",
}: NavLinkProps) {
  const base =
    "inline-flex items-center px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors";

  const variantClass =
    variant === "cta"
      ? "rounded-full bg-accent text-accent-foreground hover:bg-accent-hover"
      : active
        ? "text-header-foreground border-b-2 border-accent"
        : "text-header-muted hover:text-header-foreground";

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
