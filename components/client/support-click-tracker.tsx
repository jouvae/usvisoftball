"use client";

import { useEffect } from "react";
import { track, type SupportCtaLocation } from "@/lib/analytics";

// One delegated listener for every Support link (`data-support-cta="<location>"`), so server
// components (footer, cards, the article block) stay server components. Mounted once in the
// public layout.
export function SupportClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.<HTMLElement>("[data-support-cta]");
      const where = link?.dataset.supportCta as SupportCtaLocation | undefined;
      if (where) track({ name: "support_cta_click", params: { cta_location: where } });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
