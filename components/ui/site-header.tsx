import { SiteBrand } from "@/components/ui/site-brand";
import { PrimaryNav } from "@/components/client/primary-nav";

export function SiteHeader({ className = "" }: { className?: string }) {
  return (
    <header
      data-testid="site-header"
      className={`bg-header text-header-foreground ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <SiteBrand />
        <PrimaryNav />
      </div>
    </header>
  );
}
