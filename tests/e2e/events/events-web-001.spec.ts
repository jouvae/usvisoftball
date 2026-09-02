/*
---
id: events-web-001
name: "events-web-001: Public visitor reads the events directory"
feature: softball/events
stack: web
priority: P0
status: green
group: A
references:
  - supabase/migrations/0017_events.sql
  - app/(public)/events/page.tsx
  - components/ui/events-directory.tsx
  - lib/events.ts
  - lib/events-view.ts
---

## Given
The 0017 seed exists (3 clearly-sample events, public-read RLS): two Upcoming
(end_date 2099-06-07 and 2099-08-18) and one Past (end_date 2020-04-12). An
unauthenticated visitor opens `/events`.

## When
The events directory loads.

## Then
`events-directory` renders an `events-upcoming` group and an `events-past` group.
Exactly 3 `event-card` total. Upcoming holds "Sample Territorial Championship
(Upcoming)" then "Sample Inter-Island Cup (Upcoming)" (sort_order 10 then 20);
Past holds "Sample Youth Classic (Past)". The first upcoming card reads
"Jun 1–7, 2099" (en-dash) and shows a venue; every card has a description.
READ-ONLY: no writes, no teardown.
*/

import { test, expect, type Locator } from "@playwright/test";

// Service-key read of the SAME `events` table the page renders, so the spec tracks the
// seed rather than hard-coding it. `lib/supabase/admin` and `lib/events` are
// `server-only`-fenced; the Playwright transform aliases `server-only` to a no-op via
// tests/tsconfig.json (see playwright.config.ts), so these resolve under a plain-Node
// worker. READ (SELECT) only — never a write.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  splitEventsByDate,
  todayISO,
  type FederationEvent,
} from "@/lib/events";
import { formatEventDateRange } from "@/lib/events-view";

type EventRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  venue: string;
  island: FederationEvent["island"];
  start_date: string | null;
  end_date: string | null;
  logo_url: string;
  sort_order: number;
};

type Expected = {
  upcomingNames: string[];
  pastNames: string[];
  total: number;
  firstUpcomingDates: string;
};

// Read the live seed and apply the SAME split/sort the page uses, so assertions below
// derive from the actual rows (compared to today) rather than a snapshot.
async function readSeed(): Promise<Expected> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,name,slug,description,venue,island,start_date,end_date,logo_url,sort_order",
    )
    .limit(200);
  if (error) throw error;
  const rows = (data as EventRow[] | null) ?? [];

  const events: FederationEvent[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    venue: r.venue,
    island: r.island,
    startDate: r.start_date,
    endDate: r.end_date,
    logoUrl: r.logo_url,
    sortOrder: r.sort_order,
  }));

  const { upcoming, past } = splitEventsByDate(events, todayISO(new Date()));
  const firstUpcoming = upcoming[0];
  return {
    upcomingNames: upcoming.map((e) => e.name),
    pastNames: past.map((e) => e.name),
    total: events.length,
    firstUpcomingDates: firstUpcoming
      ? formatEventDateRange(firstUpcoming.startDate, firstUpcoming.endDate)
      : "",
  };
}

// `event-name` text in DOM order, scoped to a group locator.
function groupCardNames(group: Locator): Promise<string[]> {
  return group.getByTestId("event-name").allTextContents();
}

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

test.describe("events-web-001 — public events directory renders from seed", () => {
  let seed: Expected;

  test.beforeAll(async () => {
    // GIVEN: the 0017 seed. Read once via the service key so assertions track the
    // actual seeded rows split against today (no out-of-band writes).
    seed = await readSeed();
    expect(seed.total, "seed read returned no events").toBe(3);
    expect(seed.upcomingNames).toEqual([
      "Sample Territorial Championship (Upcoming)",
      "Sample Inter-Island Cup (Upcoming)",
    ]);
    expect(seed.pastNames).toEqual(["Sample Youth Classic (Past)"]);
    // Fixed-seed guard on the en-dash date label of the first upcoming card.
    expect(seed.firstUpcomingDates).toBe("Jun 1–7, 2099");
  });

  test.beforeEach(async ({ page }) => {
    // WHEN: an anonymous visitor opens /events and the directory loads.
    const res = await page.goto("/events");
    expect(res, "no response for /events").not.toBeNull();
    expect(res!.status()).toBe(200);
  });

  test("directory renders (not the empty state)", async ({ page }) => {
    await expect(page.getByTestId("events-directory")).toBeVisible();
    await expect(page.getByTestId("events-empty")).toHaveCount(0);
  });

  test("an Upcoming group and a Past group are both present", async ({
    page,
  }) => {
    await expect(page.getByTestId("events-upcoming")).toHaveCount(1);
    await expect(page.getByTestId("events-past")).toHaveCount(1);
    await expect(page.getByTestId("events-upcoming")).toBeVisible();
    await expect(page.getByTestId("events-past")).toBeVisible();
  });

  test("exactly 3 event cards total", async ({ page }) => {
    await expect(page.getByTestId("event-card")).toHaveCount(seed.total);
    await expect(page.getByTestId("event-card")).toHaveCount(3);
  });

  test("each group holds exactly its seeded events, in order", async ({
    page,
  }) => {
    const upcoming = page.getByTestId("events-upcoming");
    const past = page.getByTestId("events-past");

    await expect(upcoming.getByTestId("event-card")).toHaveCount(
      seed.upcomingNames.length,
    );
    await expect(past.getByTestId("event-card")).toHaveCount(
      seed.pastNames.length,
    );

    expect(await groupCardNames(upcoming)).toEqual(seed.upcomingNames);
    expect(await groupCardNames(past)).toEqual(seed.pastNames);
  });

  test("first upcoming card shows the en-dash date range and a venue", async ({
    page,
  }) => {
    const firstUpcoming = page
      .getByTestId("events-upcoming")
      .getByTestId("event-card")
      .first();
    await expect(firstUpcoming.getByTestId("event-dates")).toHaveText(
      seed.firstUpcomingDates,
    );
    await expect(firstUpcoming.getByTestId("event-dates")).toHaveText(
      "Jun 1–7, 2099",
    );
    await expect(firstUpcoming.getByTestId("event-venue")).toHaveCount(1);
    await expect(firstUpcoming.getByTestId("event-venue")).not.toBeEmpty();
  });

  test("every card shows a description", async ({ page }) => {
    const cards = page.getByTestId("event-card");
    const count = await cards.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.getByTestId("event-description")).toHaveCount(1);
      await expect(card.getByTestId("event-description")).not.toBeEmpty();
    }
  });
});
