/*
---
id: events-web-004
name: "events-web-004: Public visitor reads an event's participating teams"
feature: softball/events
stack: web
priority: P0
status: green
group: A
references:
  - supabase/migrations/0019_event_teams.sql
  - app/(public)/events/[slug]/page.tsx
  - app/(public)/teams/[slug]/page.tsx
  - lib/events.ts
---

## Given
Migration 0019 added an `event_teams` join table (public-read RLS) and seeded 9
participation links. `/events/[slug]` renders a "Participating Teams" section
(`event-participants`) listing linked teams in `sort_order`, each name an
`<a href="/teams/{slug}">` (`event-participant-name`) inside a `<li>`
(`event-participant`).

## When
An unauthenticated visitor opens an event detail page, and clicks a team link.

## Then
`e2e-inter-island-cup` shows exactly 4 participants — E2E Frenchtown Sluggers,
E2E Cruz Bay Waves, E2E Christiansted Crushers, E2E Frederiksted Fire — with the right text
order AND hrefs (order derived from a service-key read of event_teams⋈teams by
sort_order). `e2e-territorial-championship` shows exactly 3, incl. Charlotte
Amalie Storm. Clicking the first participant lands on /teams/e2e-frenchtown-sluggers
(team-detail visible), and that route returns 200. Writes only the e2e fixtures, removed in afterAll.
*/

import { test, expect } from "@playwright/test";

// Service-key read of the SAME `event_teams`/`teams` tables the page renders, so the spec
// tracks the seed rather than hard-coding it. `lib/supabase/admin` is `server-only`-fenced;
// the Playwright transform aliases `server-only` to a no-op via tests/tsconfig.json (see
// playwright.config.ts). READ (SELECT) only — never a write, never a teardown.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cleanupSportsFixtures,
  seedSportsFixtures,
} from "../../support/sports-fixtures";


type ParticipantRow = {
  sort_order: number;
  teams: { name: string; slug: string } | null;
};

type Participant = { name: string; slug: string };

// Read the ordered participants for an event slug: resolve the event id, then join
// event_teams → teams ordered by sort_order — the SAME ordering the page renders.
async function readParticipants(eventSlug: string): Promise<Participant[]> {
  const supabase = createAdminClient();

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id")
    .eq("slug", eventSlug)
    .maybeSingle();
  if (eventErr) throw eventErr;
  if (!event) throw new Error(`seed event missing for slug '${eventSlug}'`);

  const { data, error } = await supabase
    .from("event_teams")
    .select("sort_order, teams(name,slug)")
    .eq("event_id", (event as { id: string }).id)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return ((data as unknown as ParticipantRow[] | null) ?? []).map((r) => {
    if (!r.teams) throw new Error("event_teams row missing joined team");
    return { name: r.teams.name, slug: r.teams.slug };
  });
}

const CUP_SLUG = "e2e-inter-island-cup";
const CHAMP_SLUG = "e2e-territorial-championship";

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

test.describe("events-web-004 — public event participating-teams renders from seed", () => {
  let cup: Participant[];
  let champ: Participant[];

  test.beforeAll(async () => {
    if (process.env.NEXT_PUBLIC_EVENTS_ENABLED !== "true") return;
    // GIVEN: the shared e2e fixtures (tests/support/sports-fixtures.ts) — seeded here,
    // removed in afterAll. The service-key reads below then track the fixture rows.
    await seedSportsFixtures();
    // GIVEN: the 0019 seed. Read the ordered participants via the service key so
    // expectations track the actual seeded rows (no out-of-band writes).
    cup = await readParticipants(CUP_SLUG);
    champ = await readParticipants(CHAMP_SLUG);

    // Fixed-seed guards on the values the scenario names explicitly.
    expect(cup).toEqual([
      { name: "E2E Frenchtown Sluggers", slug: "e2e-frenchtown-sluggers" },
      { name: "E2E Cruz Bay Waves", slug: "e2e-cruz-bay-waves" },
      { name: "E2E Christiansted Crushers", slug: "e2e-christiansted-crushers" },
      { name: "E2E Frederiksted Fire", slug: "e2e-frederiksted-fire" },
    ]);
    expect(champ).toHaveLength(3);
    expect(champ.map((p) => p.name)).toContain("E2E Charlotte Amalie Storm");
  });


  test.afterAll(async () => {
    await cleanupSportsFixtures();
  });

  test("inter-island-cup lists its 4 teams, in order, with correct hrefs", async ({
    page,
  }) => {
    // WHEN: an anonymous visitor opens the event detail page.
    const res = await page.goto(`/events/${CUP_SLUG}`);
    expect(res, "no response for detail page").not.toBeNull();
    expect(res!.status()).toBe(200);

    // THEN: the participants section renders exactly the seeded teams.
    const section = page.getByTestId("event-participants");
    await expect(section).toBeVisible();

    await expect(section.getByTestId("event-participant")).toHaveCount(
      cup.length,
    );

    const names = section.getByTestId("event-participant-name");
    // Visible text order matches the sort_order-derived seed.
    expect(await names.allTextContents()).toEqual(cup.map((p) => p.name));
    // Each link's href resolves to its team detail route, in the same order.
    for (let i = 0; i < cup.length; i++) {
      await expect(names.nth(i)).toHaveAttribute(
        "href",
        `/teams/${cup[i].slug}`,
      );
    }
  });

  test("territorial-championship lists exactly 3 teams incl. E2E Charlotte Amalie Storm", async ({
    page,
  }) => {
    const res = await page.goto(`/events/${CHAMP_SLUG}`);
    expect(res, "no response for detail page").not.toBeNull();
    expect(res!.status()).toBe(200);

    const section = page.getByTestId("event-participants");
    await expect(section).toBeVisible();
    await expect(section.getByTestId("event-participant")).toHaveCount(
      champ.length,
    );
    await expect(section.getByTestId("event-participant")).toHaveCount(3);

    const names = section.getByTestId("event-participant-name");
    expect(await names.allTextContents()).toEqual(champ.map((p) => p.name));
    await expect(
      section
        .getByTestId("event-participant-name")
        .filter({ hasText: "E2E Charlotte Amalie Storm" }),
    ).toHaveCount(1);
  });

  test("clicking the first participant navigates to its team detail page", async ({
    page,
  }) => {
    await page.goto(`/events/${CUP_SLUG}`);

    const firstName = page
      .getByTestId("event-participants")
      .getByTestId("event-participant-name")
      .first();
    await expect(firstName).toHaveText("E2E Frenchtown Sluggers");
    await expect(firstName).toHaveAttribute(
      "href",
      "/teams/e2e-frenchtown-sluggers",
    );
    await firstName.click();

    // THEN: the URL is the team detail route and the team detail section renders.
    await expect(page).toHaveURL(/\/teams\/e2e-frenchtown-sluggers$/);
    await expect(page.getByTestId("team-detail")).toBeVisible();
  });

  test("the linked team route resolves (200, not 404)", async ({ page }) => {
    const res = await page.goto("/teams/e2e-frenchtown-sluggers");
    expect(res, "no response for team detail route").not.toBeNull();
    expect(res!.status()).toBe(200);
    await expect(page.getByTestId("team-detail")).toBeVisible();
  });
});
