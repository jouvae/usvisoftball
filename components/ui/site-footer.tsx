export function SiteFooter({ className = "" }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="site-footer"
      className={`border-t border-border bg-surface px-4 py-8 text-muted ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <span className="font-display uppercase font-bold tracking-tight text-brand">
          USVI SOFTBALL FEDERATION
        </span>
        <span className="text-sm">
          &copy; {year} U.S. Virgin Islands Softball Federation. All rights
          reserved.
        </span>
      </div>
    </footer>
  );
}
