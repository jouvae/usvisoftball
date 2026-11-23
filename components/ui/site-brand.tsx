import Link from "next/link";
import Image from "next/image";
import { getLocale } from "@/lib/i18n/server";
import { localizePath } from "@/lib/i18n/locale";

// The masthead logo lockup: the federation crest + wordmark, linking home, navy on the frosty
// nav. (The home-at-top oversized crest went with the hero — home-feed H2: the lead story now
// sits directly under the header, so nothing may overhang it.)
export async function SiteBrand({ className = "" }: { className?: string }) {
  const locale = await getLocale(); // links to the current locale's home (/ or /es)
  return (
    <Link
      href={localizePath(locale, "/")}
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
        className="h-8 w-auto drop-shadow-sm sm:h-9"
      />
      USVI SOFTBALL FEDERATION
    </Link>
  );
}
