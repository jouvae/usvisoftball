/*
---
id: schedule-web-002
name: "schedule-web-002: EN|ES switcher keeps the current path"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S2
references:
  - components/client/primary-nav.tsx
  - lib/i18n/
---

## Given
An anonymous visitor on `/events` (and on `/`).

## When
They use the header language switcher (`locale-switcher` → `locale-link-es` / `locale-link-en`).

## Then
ES goes to `/es/events` (`/` → `/es`) and EN comes back to `/events` (`/es` → `/`), keeping the
path. The active locale link has `aria-current="true"`; the other does not.
*/

// Reads no DB fixtures. The `/events` round-trip needs NEXT_PUBLIC_EVENTS_ENABLED=true.
// On the mobile project the switcher may live inside the collapsed nav panel, so the
// helper opens `mobile-nav-toggle` when the switcher is not already visible.

import { test, expect, type Page } from "@playwright/test";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

async function revealSwitcher(page: Page) {
  const switcher = page.getByTestId("locale-switcher");
  await expect(switcher).toBeAttached();
  if (!(await switcher.isVisible())) {
    const toggle = page.getByTestId("mobile-nav-toggle");
    if (await toggle.isVisible()) await toggle.click();
  }
  await expect(switcher).toBeVisible();
  return switcher;
}

async function expectActive(page: Page, active: "en" | "es") {
  const other = active === "en" ? "es" : "en";
  const switcher = page.getByTestId("locale-switcher");
  await expect(switcher.getByTestId(`locale-link-${active}`)).toHaveAttribute("aria-current", "true");
  await expect(switcher.getByTestId(`locale-link-${other}`)).not.toHaveAttribute("aria-current", "true");
}

async function roundTrip(page: Page, enPath: string, esPath: string) {
  await page.goto(enPath);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  let switcher = await revealSwitcher(page);
  await expectActive(page, "en");
  await expect(switcher.getByTestId("locale-link-es")).toHaveAttribute("href", esPath);
  await expect(switcher.getByTestId("locale-link-en")).toHaveAttribute("href", enPath);

  await switcher.getByTestId("locale-link-es").click();
  await expect(page).toHaveURL((u) => u.pathname === esPath);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  switcher = await revealSwitcher(page);
  await expectActive(page, "es");
  await expect(switcher.getByTestId("locale-link-en")).toHaveAttribute("href", enPath);

  await switcher.getByTestId("locale-link-en").click();
  await expect(page).toHaveURL((u) => u.pathname === enPath);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await revealSwitcher(page);
  await expectActive(page, "en");
}

test.describe("schedule-web-002: language switcher round-trip", () => {
  test("/ ↔ /es keeps the path", async ({ page }) => {
    await roundTrip(page, "/", "/es");
  });

  test("/events ↔ /es/events keeps the path", async ({ page }) => {
    test.skip(!EVENTS_ON, "requires NEXT_PUBLIC_EVENTS_ENABLED=true");
    await roundTrip(page, "/events", "/es/events");
  });
});
