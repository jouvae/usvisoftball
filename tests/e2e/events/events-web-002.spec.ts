/*
---
id: events-web-002
name: "events-web-002: Public visitor reads an event detail page"
feature: softball/events
stack: web
priority: P0
status: green
group: A
references:
  - supabase/migrations/0017_events.sql
  - app/(public)/events/[slug]/page.tsx
  - app/(public)/events/page.tsx
  - components/ui/events-directory.tsx
  - lib/events.ts
  - lib/events-view.ts
---

## Given
The 0017 seed exists (3 clearly-sample events, public-read RLS). An unauthenticated
visitor is on `/events`, where each `event-name` is now a link to `/events/{slug}`.

## When
The visitor clicks an event's name link, or navigates directly to `/events/{slug}`.

## Then
`/events/sample-territorial-championship` renders `event-detail` with the event's
name, en-dash date range "Jun 1–7, 2099", a venue containing "Lionel Roberts
Stadium", island "St. Thomas", and a description. The island-null event
`/events/sample-inter-island-cup` renders `event-detail` with NO
`event-detail-island`. An unknown slug returns HTTP 404 and no `event-detail`.
READ-ONLY: no writes, no teardown.
*/

import { test, expect } from "@playwright/test";

// Service-key read of the SAME `events` table the page renders, so the spec tracks the
// seed rather than hard-coding it. `lib/supabase/admin` and `lib/events` are
// `server-only`-fenced; the Playwright transform aliases `server-only` to a no-op via
// tests/tsconfig.json (see playwright.config.ts). READ (SELECT) only — never a write.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EVENT_ISLAND_LABELS,
  formatEventDateRange,
  type EventIsland,
} from "@/lib/events-view";

type EventRow = {
  name: string;
  slug: string;
  description: string;
  venue: string;
  island: EventIsland | null;
  start_date: string | null;
  end_date: string | null;
};

async function readEvent(slug: string): Promise<EventRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("name,slug,description,venue,island,start_date,end_date")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`seed row missing for slug '${slug}'`);
  return data as EventRow;
}

const CHAMP_SLUG = "sample-territorial-championship";
const NULL_ISLAND_SLUG = "sample-inter-island-cup";

// MVP launch: the Events section is flag-gated OFF (lib/flags.ts). With the flag
// unset every Events route returns 404, so these seed-backed specs cannot pass.
// Skip the whole file unless NEXT_PUBLIC_EVENTS_ENABLED=true — they stay meaningful
// and are exercised the moment the flag is flipped on.
test.beforeEach(() => {
  test.skip(
    process.env.NEXT_PUBLIC_EVENTS_ENABLED !== "true",
    "Events feature flag is OFF for the MVP launch",
  );
});

test.describe("events-web-002 — public event detail renders from seed", () => {
  let champ: EventRow;
  let nullIsland: EventRow;

  test.beforeAll(async () => {
    // GIVEN: the 0017 seed. Read the two rows this scenario asserts against via the
    // service key so expectations track the actual seeded values (no out-of-band writes).
    champ = await readEvent(CHAMP_SLUG);
    nullIsland = await readEvent(NULL_ISLAND_SLUG);

    // Fixed-seed guards on the values the scenario names explicitly.
    expect(champ.name).toBe("Sample Territorial Championship (Upcoming)");
    expect(champ.island).toBe("st_thomas");
    expect(formatEventDateRange(champ.start_date, champ.end_date)).toBe(
      "Jun 1–7, 2099",
    );
    expect(champ.venue).toContain("Lionel Roberts Stadium");
    expect(nullIsland.island).toBeNull();
  });

  test("clicking an event-name link on /events navigates to its detail page", async ({
    page,
  }) => {
    // WHEN: an anonymous visitor opens /events and clicks the championship's name link.
    const res = await page.goto("/events");
    expect(res, "no response for /events").not.toBeNull();
    expect(res!.status()).toBe(200);

    const link = page
      .getByTestId("event-name")
      .filter({ hasText: champ.name });
    await expect(link).toHaveAttribute("href", `/events/${CHAMP_SLUG}`);
    await link.click();

    // THEN: the URL is the detail route and the detail section renders.
    await expect(page).toHaveURL(new RegExp(`/events/${CHAMP_SLUG}$`));
    await expect(page.getByTestId("event-detail")).toBeVisible();
  });

  test("detail page shows name, en-dash dates, venue, island, and description", async ({
    page,
  }) => {
    const res = await page.goto(`/events/${CHAMP_SLUG}`);
    expect(res, "no response for detail page").not.toBeNull();
    expect(res!.status()).toBe(200);

    const detail = page.getByTestId("event-detail");
    await expect(detail).toBeVisible();

    // THEN: content derived from the service-key seed read.
    await expect(page.getByTestId("event-detail-name")).toHaveText(champ.name);

    const expectedDates = formatEventDateRange(
      champ.start_date,
      champ.end_date,
    );
    await expect(page.getByTestId("event-detail-dates")).toHaveText(
      expectedDates,
    );
    await expect(page.getByTestId("event-detail-dates")).toHaveText(
      "Jun 1–7, 2099",
    );

    await expect(page.getByTestId("event-detail-venue")).toHaveCount(1);
    await expect(page.getByTestId("event-detail-venue")).toContainText(
      champ.venue,
    );
    await expect(page.getByTestId("event-detail-venue")).toContainText(
      "Lionel Roberts Stadium",
    );

    await expect(page.getByTestId("event-detail-island")).toContainText(
      EVENT_ISLAND_LABELS[champ.island as EventIsland],
    );
    await expect(page.getByTestId("event-detail-island")).toContainText(
      "St. Thomas",
    );

    await expect(page.getByTestId("event-detail-description")).toHaveCount(1);
    await expect(
      page.getByTestId("event-detail-description"),
    ).not.toBeEmpty();
  });

  test("island-null event renders the detail page with no island element", async ({
    page,
  }) => {
    const res = await page.goto(`/events/${NULL_ISLAND_SLUG}`);
    expect(res, "no response for null-island detail page").not.toBeNull();
    expect(res!.status()).toBe(200);

    await expect(page.getByTestId("event-detail")).toBeVisible();
    await expect(page.getByTestId("event-detail-name")).toHaveText(
      nullIsland.name,
    );
    // island is null in the seed → the island span must not be rendered.
    await expect(page.getByTestId("event-detail-island")).toHaveCount(0);
  });

  test("unknown slug returns HTTP 404 and no event-detail", async ({
    page,
  }) => {
    const res = await page.goto("/events/does-not-exist");
    expect(res, "no response for unknown slug").not.toBeNull();
    expect(res!.status()).toBe(404);
    await expect(page.getByTestId("event-detail")).toHaveCount(0);
  });
});
