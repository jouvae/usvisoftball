import Link from "next/link";
import { Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localizePath, type Locale } from "@/lib/i18n/locale";

// Feature softball/donate — the call to action at the end of every article. A navy band (the
// site's one strong surface) with the gold Donate button; the link opens the donate modal.
export function SupportBlock({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).donate;
  return (
    <aside
      data-testid="article-support"
      aria-labelledby="article-support-heading"
      className="flex flex-col gap-4 rounded-2xl bg-navy p-6 text-navy-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-8"
    >
      <div className="flex flex-col gap-2">
        <h2 id="article-support-heading" className="font-display text-2xl font-bold tracking-tight">
          {t.articleTitle}
        </h2>
        <p className="max-w-[48ch] text-navy-muted">{t.articleBody}</p>
      </div>
      <Link
        href={localizePath(locale, "/donate")}
        data-testid="article-support-cta"
        data-support-cta="article"
        className={`${buttonVariants({ variant: "accent", size: "cta" })} h-12 px-6 text-base focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
      >
        <Heart aria-hidden="true" className="fill-current" />
        {t.articleCta}
      </Link>
    </aside>
  );
}
