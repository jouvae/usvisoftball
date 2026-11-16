/*
---
id: schedule-web-001
name: "schedule-web-001: Spanish lives under /es; English is unprefixed"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S2
references:
  - proxy.ts
  - lib/i18n/
  - app/layout.tsx
  - components/client/primary-nav.tsx
---

## Given
An anonymous visitor. Spanish is served under `/es…` (proxy rewrite + `x-locale: es`);
English is unprefixed.

## When
They load `/es`, `/es/events`, `/`, and `/events`.

## Then
`/es/events` has `<html lang="es">`, Spanish nav labels (Equipos · Eventos · Noticias ·
Participa · Nosotros · "Apoya a la Federación"), the URL stays `/es/events`, and internal nav
hrefs are prefixed with `/es`. `/events` is English with `<html lang="en">` and unprefixed hrefs.
*/

// Reads no DB fixtures. `/events` (and the Teams/Events nav links) only exist when
// NEXT_PUBLIC_EVENTS_ENABLED / NEXT_PUBLIC_TEAMS_ENABLED are "true"; run this file with both
// set (they reach the dev server via the Playwright webServer env) or those cases skip.

import { test, expect, type Page } from "@playwright/test";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";
const TEAMS_ON = process.env.NEXT_PUBLIC_TEAMS_ENABLED === "true";

type NavItem = { testId: string; path: string; en: string; es: string; on: boolean };

const NAV: NavItem[] = [
  { testId: "nav-link-teams", path: "/teams", en: "Teams", es: "Equipos", on: TEAMS_ON },
  { testId: "nav-link-events", path: "/events", en: "Events", es: "Eventos", on: EVENTS_ON },
  { testId: "nav-link-articles", path: "/articles", en: "News", es: "Noticias", on: true },
  { testId: "nav-link-involved", path: "/get-involved", en: "Get Involved", es: "Participa", on: true },
  { testId: "nav-link-about", path: "/about", en: "About", es: "Nosotros", on: true },
];

const DONATE_EN = "Support the Federation";
const DONATE_ES = "Apoya a la Federación";

async function expectSpanish(page: Page, expectedPath: string) {
  expect(new URL(page.url()).pathname).toBe(expectedPath);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  for (const item of NAV.filter((n) => n.on)) {
    const link = page.getByTestId(item.testId);
    await expect(link).toHaveText(item.es);
    await expect(link).toHaveAttribute("href", `/es${item.path}`);
  }
  // The pill carries a short + long label span; the long label is the contract.
  await expect(page.getByTestId("nav-link-donate")).toContainText(DONATE_ES);
  await expect(page.getByTestId("nav-link-donate")).not.toContainText(DONATE_EN);
}

async function expectEnglish(page: Page, expectedPath: string) {
  expect(new URL(page.url()).pathname).toBe(expectedPath);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  for (const item of NAV.filter((n) => n.on)) {
    const link = page.getByTestId(item.testId);
    await expect(link).toHaveText(item.en);
    await expect(link).toHaveAttribute("href", item.path);
  }
  await expect(page.getByTestId("nav-link-donate")).toContainText(DONATE_EN);
}

test.describe("schedule-web-001: locale routing — /es is Spanish, unprefixed is English", () => {
  test("/es renders Spanish: lang=es, Spanish labels, prefixed nav hrefs", async ({ page }) => {
    const res = await page.goto("/es");
    expect(res!.status()).toBe(200);
    await expectSpanish(page, "/es");
  });

  test("/ renders English: lang=en, English labels, unprefixed nav hrefs", async ({ page }) => {
    const res = await page.goto("/");
    expect(res!.status()).toBe(200);
    await expectEnglish(page, "/");
  });

  test("/es/events renders Spanish and the URL stays prefixed", async ({ page }) => {
    test.skip(!EVENTS_ON, "requires NEXT_PUBLIC_EVENTS_ENABLED=true");
    const res = await page.goto("/es/events");
    expect(res!.status()).toBe(200);
    await expectSpanish(page, "/es/events");
  });

  test("/events renders English with lang=en", async ({ page }) => {
    test.skip(!EVENTS_ON, "requires NEXT_PUBLIC_EVENTS_ENABLED=true");
    const res = await page.goto("/events");
    expect(res!.status()).toBe(200);
    await expectEnglish(page, "/events");
  });
});
