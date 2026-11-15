/*
---
id: schedule-web-017
name: "schedule-web-017: a game page's og:image is a working PNG"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - app/(public)/events/[slug]/opengraph-image.tsx (or an OG route)
  - lib/site.ts (SITE_URL → metadataBase)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures; the USVI pregame game page.

## When
A crawler reads the page's `meta[property="og:image"]` and fetches it.

## Then
The URL responds 200 with `content-type: image/png`. (metadataBase makes the meta URL absolute
on the production origin; the test fetches the same PATH + query against the server under test,
since the fixture row only exists while the spec runs.)
*/

import { test, expect } from "@playwright/test";
import {
  SFX_EVENTS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-017 — OG share image", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("og:image returns 200 image/png", async ({ page }) => {
    const ev = SFX_EVENTS.usviPregame;
    const res = await page.goto(`/events/${ev.slug}`);
    expect(res!.status()).toBe(200);

    const meta = page.locator('meta[property="og:image"]').first();
    await expect(meta).toHaveCount(1);
    const content = await meta.getAttribute("content");
    expect(content, "og:image has no content").toBeTruthy();

    const url = new URL(content!, page.url());
    // The image must be the event's own (not a generic site image).
    expect(url.pathname).toContain(ev.slug);

    const img = await page.request.get(`${url.pathname}${url.search}`);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
    expect((await img.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });
});
