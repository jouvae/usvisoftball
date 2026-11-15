/*
---
id: schedule-web-016
name: "schedule-web-016: a game page emits one SportsEvent JSON-LD"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S3
references:
  - app/(public)/events/[slug]/page.tsx
  - lib/schedule-view.ts (teamDisplayName)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures; the USVI pregame game (CO @ USVI at E2E Field Alpha, 2099-03-15T15:00Z).

## When
A crawler loads `/events/{slug}` directly.

## Then
Exactly one `script[type="application/ld+json"]` object has `@type: "SportsEvent"`, with
`startDate` an ISO 8601 timestamp carrying an offset or Z that denotes 2099-03-15T15:00:00Z,
`awayTeam.name` / `homeTeam.name` equal to the English display names, and `location.name` equal
to the venue.
*/

import { test, expect } from "@playwright/test";
import { teamDisplayName } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

type Json = Record<string, unknown>;

// Flatten a JSON-LD payload (object, array, or @graph) into its nodes.
function nodes(value: unknown): Json[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (value && typeof value === "object") {
    const obj = value as Json;
    return Array.isArray(obj["@graph"]) ? nodes(obj["@graph"]) : [obj];
  }
  return [];
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-016 — SportsEvent JSON-LD", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("one SportsEvent with startDate, teams and location", async ({ page }) => {
    const ev = SFX_EVENTS.usviPregame;
    const res = await page.goto(`/events/${ev.slug}`);
    expect(res!.status()).toBe(200);

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((e) => e.textContent ?? ""));
    const all = raw.flatMap((t) => nodes(JSON.parse(t)));
    const sports = all.filter((n) => n["@type"] === "SportsEvent");
    expect(sports, `JSON-LD nodes: ${JSON.stringify(all)}`).toHaveLength(1);
    const se = sports[0];

    const start = String(se.startDate);
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/);
    expect(Date.parse(start)).toBe(Date.parse(ev.startsAt));

    expect((se.awayTeam as Json)?.name).toBe(teamDisplayName(SFX_TEAMS.colombia, "en"));
    expect((se.homeTeam as Json)?.name).toBe(teamDisplayName(SFX_TEAMS.usvi, "en"));
    expect((se.location as Json)?.name).toBe(ev.venue);
  });
});
