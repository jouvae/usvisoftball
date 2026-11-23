/*
---
id: donate-web
name: "donate-web-001..006: Support links open the on-site donate panel; GA events fire"
feature: softball/donate
stack: web
priority: P0
references:
  - app/(public)/donate/page.tsx
  - app/(public)/@modal/(.)donate/page.tsx
  - components/client/donate-panel.tsx
  - components/client/donate-sheet.tsx
  - components/client/support-click-tracker.tsx
  - components/ui/support-block.tsx
  - lib/analytics.ts
---

Scenarios: docs/features/softball/donate/scenarios.md.

READ-ONLY: seeds and writes nothing. The PayPal Donate SDK is stubbed (route-fulfilled) so the
specs never reach PayPal and never open a real checkout; GA is observed through a window.gtag
spy installed before page scripts run.
*/

import { test, expect, type Page } from "@playwright/test";

const SDK = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";

// A stand-in Donate SDK: records the checkout options and, when asked, completes the donation.
const SDK_STUB = `
  window.PayPal = { Donation: { Checkout: function (opts) {
    window.__checkout = opts;
    return { renderTo: function () {} };
  } } };
`;

async function prepare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ga: unknown[][]; gtag: (...a: unknown[]) => void };
    w.__ga = [];
    w.gtag = (...a: unknown[]) => w.__ga.push(a.slice(1));
  });
  await page.route(SDK, (route) =>
    route.fulfill({ contentType: "application/javascript", body: SDK_STUB }),
  );
}

const gaEvents = (page: Page) =>
  page.evaluate(() => (window as unknown as { __ga: [string, Record<string, unknown>][] }).__ga);

// The Support pill lives inside the collapsed menu on phones.
async function clickSupportPill(page: Page) {
  const toggle = page.getByTestId("mobile-nav-toggle");
  if (await toggle.isVisible()) await toggle.click();
  await page.getByTestId("nav-link-donate").click();
}

async function firstArticleSlug(page: Page): Promise<string> {
  await page.goto("/");
  const slug = await page.getByTestId("home-lead").getAttribute("data-slug");
  expect(slug, "home has a lead story").toBeTruthy();
  return slug!;
}

test.describe("donate-web", () => {
  test.beforeEach(async ({ page }) => prepare(page));

  test("donate-web-001: the nav Support pill opens the donate modal over the page", async ({
    page,
  }) => {
    await page.goto("/about", { waitUntil: "networkidle" });
    await clickSupportPill(page);
    const sheet = page.getByTestId(/donate-(modal|drawer)/);
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/donate$/);
    await expect(page.getByRole("dialog", { name: "Support Team USVI" })).toBeVisible();
    // Back closes it and leaves the reader where they were.
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/\/about$/);
  });

  test("donate-web-002: a direct load of /donate is a full page with one h1", async ({ page }) => {
    const res = await page.goto("/donate");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId(/donate-(modal|drawer)/)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Support Team USVI");
    await expect(page.getByTestId("donate-fallback")).toHaveAttribute(
      "href",
      "https://www.paypal.com/donate/?hosted_button_id=SSAELKMM3V5TJ",
    );
  });

  test("donate-web-003: every article ends with the Support block linking to /donate", async ({
    page,
  }) => {
    const slug = await firstArticleSlug(page);
    await page.goto(`/articles/${slug}`);
    const cta = page.getByTestId("article-support-cta");
    await expect(cta).toHaveAttribute("href", "/donate");
    await expect(cta).toHaveAttribute("data-support-cta", "article");
  });

  test("donate-web-004: PayPal opens from the Federation's hosted button; GA sees the funnel", async ({
    page,
  }) => {
    const slug = await firstArticleSlug(page);
    // Wait for hydration: the click tracker and the modal interception are client-side.
    await page.goto(`/articles/${slug}`, { waitUntil: "networkidle" });
    await page.getByTestId("article-support-cta").click();
    await expect(page.getByTestId(/donate-(modal|drawer)/)).toBeVisible();
    const pay = page.getByTestId("donate-paypal");
    await expect(pay).toBeEnabled();
    await pay.click();
    const opts = await page.evaluate(
      () => (window as unknown as { __checkout: { hosted_button_id: string } }).__checkout,
    );
    expect(opts.hosted_button_id).toBe("SSAELKMM3V5TJ");

    // PayPal reports a completed donation → thank-you + donate_complete with value/currency/tx.
    await page.evaluate(() =>
      (
        window as unknown as { __checkout: { onComplete: (r: Record<string, string>) => void } }
      ).__checkout.onComplete({ tx: "TEST-TX-1", st: "Completed", amt: "50.00", cc: "USD" }),
    );
    await expect(page.getByTestId("donate-thanks")).toContainText("$50.00");

    const names = (await gaEvents(page)).map(([name]) => name);
    expect(names).toEqual([
      "support_cta_click",
      "donate_view",
      "donate_begin",
      "donate_complete",
    ]);
    const events = Object.fromEntries(await gaEvents(page));
    expect(events.support_cta_click).toEqual({ cta_location: "article" });
    expect(events.donate_begin).toEqual({ method: "paypal_window" });
    expect(events.donate_complete).toEqual({
      value: 50,
      currency: "USD",
      transaction_id: "TEST-TX-1",
    });
  });

  test("donate-web-005: if PayPal's script can't load, the reader gets the PayPal.com link", async ({
    page,
  }) => {
    await page.route(SDK, (route) => route.abort());
    await page.goto("/donate");
    await expect(page.getByTestId("donate-paypal")).toBeDisabled();
    await expect(page.getByText("PayPal couldn't load here.")).toBeVisible();
    await expect(page.getByTestId("donate-fallback")).toBeVisible();
    expect((await gaEvents(page)).map(([n]) => n)).toContain("donate_error");
  });

  test("donate-web-006: Spanish — /es Support opens the panel in Spanish at /es/donate", async ({
    page,
  }) => {
    await page.goto("/es", { waitUntil: "networkidle" });
    await clickSupportPill(page);
    await expect(page).toHaveURL(/\/es\/donate$/);
    await expect(page.getByRole("dialog", { name: "Apoya al Team USVI" })).toBeVisible();
    await expect(page.getByTestId("donate-paypal")).toHaveText(/Donar con PayPal/);
  });
});
