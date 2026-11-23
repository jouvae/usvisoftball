import type { Metadata } from "next";
import { DonatePanel } from "@/components/client/donate-panel";
import { AccentRule } from "@/components/ui/motifs/accent-rule";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

// The full donate page: direct loads, refreshes, shared links and no-modal fallbacks. In-site
// clicks are intercepted into the @modal slot instead ((.)donate).
export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale()).donate;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default function DonatePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6 sm:py-20">
      <AccentRule />
      <DonatePanel presentation="page" />
    </div>
  );
}
