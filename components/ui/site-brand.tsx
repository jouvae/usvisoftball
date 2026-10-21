import Link from "next/link";
import Image from "next/image";

// The masthead logo lockup: the federation crest + wordmark, linking home, navy on the frosty
// nav. On desktop, while the header is in its home-at-top state (StickyHeader data-hero), the
// crest grows to 80px and overhangs the hero by ~32px: the -mb keeps its in-flow footprint at
// the normal 36px so the bar height never changes. Reduced motion skips the transition.
export function SiteBrand({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      data-testid="site-brand"
      className={`inline-flex items-center gap-2 font-display uppercase font-bold tracking-tight leading-none text-navy text-lg sm:text-xl ${className}`}
    >
      <Image
        src="/brand/crest.png"
        alt=""
        data-testid="site-brand-crest"
        width={256}
        height={240}
        loading="eager"
        className="h-8 w-auto drop-shadow-sm transition-[height,margin] duration-300 motion-reduce:transition-none sm:h-9 lg:group-data-[hero=true]/header:-mb-11 lg:group-data-[hero=true]/header:h-20"
      />
      USVI SOFTBALL FEDERATION
    </Link>
  );
}
