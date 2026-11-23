"use client";

import { useSyncExternalStore } from "react";
import { ATLANTIC_TZ, type Locale } from "@/lib/schedule-view";

// A UTC instant shown as a calendar date in the READER's time zone. Timestamps are stored in
// UTC; the server can't know where the reader is, so the server render (and hydration) uses
// USVI time, then the browser re-renders in its own zone. useSyncExternalStore gives the two
// renders different snapshots without a hydration mismatch.

const noopSubscribe = () => () => {};

const STYLES = {
  short: { month: "short", day: "numeric", year: "numeric" },
  long: { month: "long", day: "numeric", year: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatLocalDate(
  iso: string,
  locale: Locale,
  style: keyof typeof STYLES,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, { ...STYLES[style], timeZone }).format(new Date(iso));
}

export function LocalDate({
  iso,
  locale = "en",
  style = "short",
  className,
  testId,
}: {
  iso: string;
  locale?: Locale;
  style?: keyof typeof STYLES;
  className?: string;
  testId?: string;
}) {
  // undefined → the browser's own zone; ATLANTIC_TZ on the server.
  const zone = useSyncExternalStore(
    noopSubscribe,
    () => undefined as string | undefined,
    () => ATLANTIC_TZ,
  );
  return (
    <time dateTime={iso} className={className} data-testid={testId}>
      {formatLocalDate(iso, locale, style, zone)}
    </time>
  );
}
