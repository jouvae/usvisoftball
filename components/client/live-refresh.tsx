"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetch the server-rendered data every `intervalMs` while a game on screen is live (overview
// §5). Renders nothing; inactive → no timer at all, so finished/pregame pages never poll.
export function LiveRefresh({
  active,
  intervalMs = 30_000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
