import { SiteBrand } from "@/components/ui/site-brand";
import { PrimaryNav } from "@/components/client/primary-nav";
import { StickyHeader } from "@/components/client/sticky-header";

// Frosty-white masthead: sticky, translucent white with a backdrop blur so page content
// scrolls under it, plus a hairline bottom border. Dark text (header tokens). StickyHeader
// adds the home-at-top state the crest overhang keys off (design guide §2.1).
export function SiteHeader({ className = "" }: { className?: string }) {
  return (
    <StickyHeader className={className}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <SiteBrand />
        <PrimaryNav />
      </div>
    </StickyHeader>
  );
}
