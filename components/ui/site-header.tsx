import { SiteBrand } from "@/components/ui/site-brand";
import { PrimaryNav } from "@/components/client/primary-nav";

// Frosty-white masthead: sticky, translucent white with a backdrop blur so page content
// scrolls under it, plus a hairline bottom border. Dark text (header tokens). Replaces the
// old solid-navy bar as part of the rebrand.
export function SiteHeader({ className = "" }: { className?: string }) {
  return (
    <header
      data-testid="site-header"
      className={`sticky top-0 z-40 border-b border-border bg-white/70 text-header-foreground backdrop-blur-md ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <SiteBrand />
        <PrimaryNav />
      </div>
    </header>
  );
}
