import Link from "next/link";
import Image from "next/image";

export function SiteBrand({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      data-testid="site-brand"
      className={`inline-flex items-center gap-2 font-display uppercase font-bold tracking-tight leading-none text-header-foreground text-lg sm:text-xl ${className}`}
    >
      <Image
        src="/brand/crest-sm.png"
        alt=""
        data-testid="site-brand-crest"
        width={128}
        height={120}
        loading="eager"
        className="h-8 w-auto sm:h-9"
      />
      USVI SOFTBALL FEDERATION
    </Link>
  );
}
