"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

// Share an event: the native share sheet where the browser has one (phones), else copy the link
// to the clipboard and say so. `path` is the public (localized) path; the origin is the page's.
export function ShareButton({
  path,
  title,
  label,
  copiedLabel,
  className = "",
}: {
  path: string;
  title: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed or unsupported payload — fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(label, url);
    }
  }

  return (
    <button
      type="button"
      data-testid="event-share"
      onClick={share}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-display text-sm font-semibold tracking-wide text-navy ring-1 ring-navy/30 outline-focus transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Share2 aria-hidden="true" className="size-4" />
      )}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
