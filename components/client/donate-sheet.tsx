"use client";

import { useRouter } from "next/navigation";
import { useDictionary } from "@/lib/i18n/client";
import { ResponsiveSheet } from "@/components/client/responsive-sheet";
import { DonatePanel } from "@/components/client/donate-panel";

// The in-site donate overlay: an intercepted /donate (like the event sheet, D7). Closing pops
// the history entry, so Back, Escape and the close button agree.
export function DonateSheet() {
  const router = useRouter();
  const t = useDictionary().donate;
  return (
    <ResponsiveSheet
      title={t.title}
      closeLabel={t.close}
      onClose={() => router.back()}
      modalTestId="donate-modal"
      drawerTestId="donate-drawer"
      size="narrow"
    >
      {(presentation) => <DonatePanel presentation={presentation} />}
    </ResponsiveSheet>
  );
}
