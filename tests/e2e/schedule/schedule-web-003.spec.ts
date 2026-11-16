/*
---
id: schedule-web-003
name: "schedule-web-003: Localized pages emit hreflang alternates"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S2
references:
  - app/(public)/events/page.tsx
  - lib/i18n/
---

## Given
An anonymous visitor (or crawler) loads a localized page: `/events` or `/es/events`.

## When
The document head is rendered.

## Then
It carries exactly one `<link rel="alternate" hreflang=…>` each for `en`, `es`, and `x-default`,
with absolute URLs: en → `/events`, es → `/es/events`, x-default → `/events`. Both language
versions emit the same set.
*/

// Reads no DB fixtures. Needs NEXT_PUBLIC_EVENTS_ENABLED=true (else /events 404s and this skips).
// The origin comes from metadataBase (may be the production site URL), so only absoluteness
// and the pathname are pinned.

import { test, expect, type Page } from "@playwright/test";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

const EXPECTED: Record<string, string> = {
  en: "/events",
  es: "/es/events",
  "x-default": "/events",
};

async function alternates(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const out: Record<string, string[]> = {};
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => {
      const lang = el.getAttribute("hreflang") ?? "";
      (out[lang] ??= []).push(el.getAttribute("href") ?? "");
    });
    return out;
  });
}

function expectAlternateSet(found: Record<string, string[]>) {
  for (const [lang, path] of Object.entries(EXPECTED)) {
    const hrefs = found[lang] ?? [];
    expect(hrefs, `hreflang="${lang}" link count`).toHaveLength(1);
    expect(hrefs[0], `hreflang="${lang}" must be absolute`).toMatch(/^https?:\/\/[^/]+/);
    expect(new URL(hrefs[0]).pathname, `hreflang="${lang}" path`).toBe(path);
  }
}

test.describe("schedule-web-003: hreflang alternates", () => {
  test.skip(!EVENTS_ON, "requires NEXT_PUBLIC_EVENTS_ENABLED=true");

  test("/events and /es/events emit the same en/es/x-default alternates", async ({ page }) => {
    const enRes = await page.goto("/events");
    expect(enRes!.status()).toBe(200);
    const onEn = await alternates(page);
    expectAlternateSet(onEn);

    const esRes = await page.goto("/es/events");
    expect(esRes!.status()).toBe(200);
    const onEs = await alternates(page);
    expectAlternateSet(onEs);

    expect(onEs).toEqual(onEn);
  });
});
