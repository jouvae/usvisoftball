/*
---
id: schedule-web-015
name: "schedule-web-015: event page sections — times, venue, map, .ics, stream, line score, box score, roster"
feature: softball/schedule
stack: web
priority: P0
status: red
group: S3
references:
  - app/(public)/events/[slug]/page.tsx
  - app/(public)/events/[slug]/calendar.ics/route.ts
  - components/ (EventDetail, LineScore, BoxScore, Roster — shared)
  - lib/schedule-view.ts (formatEventTime, runTotals, gameWinner)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures: a PREGAME USVI game (CO @ USVI, 2 active + 1 inactive USVI players, a
stream URL), a PREGAME game whose USVI side has NO players, a FINAL CO @ MX (3–1, H 6/4, E 1/2,
no USVI side), and a FINAL USVI @ MX with one USVI stat line.

## When
A visitor loads each event page directly.

## Then
Pregame USVI: `event-time-local` (venue-local time) and `event-time-atlantic` (Atlantic time),
`event-detail-venue`, `event-detail-map` → Google Maps search, `event-detail-ics` →
`/events/{slug}/calendar.ics` which returns 200 `text/calendar` with `DTSTART:20990315T150000Z`
and a SUMMARY; `event-detail-stream` (stream_url set); `linescore` shows `linescore-empty`; no
`boxscore` (no lines yet); `roster` lists the 2 active players (number, name, position) and not
the inactive one; `event-share` present. USVI side with no active players → `roster-tba`
"Roster to be announced". Final CO–MX: `event-state` "Final", line score rows with R/H/E
(3/6/1 vs 1/4/2), the away row `data-winner="true"`, the home row not; no stream link; no
roster section (no USVI side). Final USVI: `boxscore` lists the USVI stat line.
*/

import { test, expect, type Page } from "@playwright/test";
import { ATLANTIC_TZ, formatEventTime } from "@/lib/schedule-view";
import {
  SFX_EVENTS,
  SFX_PLAYERS,
  SFX_TZ,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

async function open(page: Page, slug: string) {
  const res = await page.goto(`/events/${slug}`);
  expect(res, "no response").not.toBeNull();
  expect(res!.status()).toBe(200);
  const detail = page.getByTestId("event-detail");
  await expect(detail).toBeVisible();
  return detail;
}

test.beforeEach(() => {
  test.skip(!EVENTS_ON, "Events feature flag is OFF");
});

test.describe("schedule-web-015 — event page sections", () => {
  test.beforeAll(async () => {
    if (!EVENTS_ON) return;
    await seedScheduleFixtures();
  });
  test.afterAll(async () => {
    if (!EVENTS_ON) return;
    await cleanupScheduleFixtures();
  });

  test("pregame USVI game: venue-local + Atlantic time, venue, map, stream, share", async ({
    page,
  }) => {
    const ev = SFX_EVENTS.usviPregame;
    const detail = await open(page, ev.slug);

    await expect(detail.getByTestId("event-time-local")).toContainText(
      formatEventTime(ev.startsAt, SFX_TZ, "en"), // 9:00 AM
    );
    await expect(detail.getByTestId("event-time-atlantic")).toContainText(
      formatEventTime(ev.startsAt, ATLANTIC_TZ, "en"), // 11:00 AM
    );
    // Polish: the venue-local caption names the country, not a bare "CST" (US Central?).
    await expect(detail.getByTestId("event-time-local")).toContainText("Local time · El Salvador");
    await expect(detail.getByTestId("event-time-local")).not.toContainText("CST");
    await expect(detail.getByTestId("event-time-atlantic")).toContainText("AST · USVI time");
    // Polish: a pregame header shows no visible chip (status kept visually hidden).
    await expect(detail.getByTestId("event-state")).toHaveText("Upcoming");
    await expect(detail.getByTestId("event-state")).toHaveClass(/\bsr-only\b/);
    await expect(detail.getByTestId("event-detail-venue")).toContainText(ev.venue);

    const map = detail.getByTestId("event-detail-map");
    await expect(map).toHaveAttribute("href", /^https:\/\/(www\.)?google\.com\/maps\/search\//);

    await expect(detail.getByTestId("event-detail-stream")).toHaveAttribute("href", ev.streamUrl);
    await expect(detail.getByTestId("event-share")).toBeVisible();
  });

  test("Add to calendar: .ics link returns text/calendar with DTSTART in UTC", async ({
    page,
  }) => {
    const ev = SFX_EVENTS.usviPregame;
    const detail = await open(page, ev.slug);
    const ics = detail.getByTestId("event-detail-ics");
    await expect(ics).toHaveAttribute("href", `/events/${ev.slug}/calendar.ics`);

    const res = await page.request.get(`/events/${ev.slug}/calendar.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toMatch(/^DTSTART:20990315T150000Z\r?$/m);
    expect(body).toMatch(/^SUMMARY:.+$/m);
  });

  test("pregame: line score empty state, no box score yet", async ({ page }) => {
    const detail = await open(page, SFX_EVENTS.usviPregame.slug);
    const ls = detail.getByTestId("linescore");
    await expect(ls).toBeVisible();
    await expect(ls.getByTestId("linescore-empty")).toBeVisible();
    await expect(ls.getByTestId("linescore-row-away")).toHaveCount(0);
    await expect(detail.getByTestId("boxscore")).toHaveCount(0);
  });

  test("USVI roster lists active players only (number, name, position)", async ({ page }) => {
    const detail = await open(page, SFX_EVENTS.usviPregame.slug);
    const roster = detail.getByTestId("roster");
    await expect(roster).toBeVisible();
    await expect(roster.getByTestId("roster-tba")).toHaveCount(0);
    const players = roster.getByTestId("roster-player");
    await expect(players).toHaveCount(2);
    for (const p of [SFX_PLAYERS.one, SFX_PLAYERS.two]) {
      const item = players.filter({ hasText: p.name });
      await expect(item, p.name).toHaveCount(1);
      await expect(item).toContainText(String(p.num));
      await expect(item).toContainText(p.pos);
    }
    await expect(roster).not.toContainText(SFX_PLAYERS.benched.name);
  });

  test("a USVI side with no active players shows 'Roster to be announced'", async ({ page }) => {
    const detail = await open(page, SFX_EVENTS.usviEmpty.slug);
    const roster = detail.getByTestId("roster");
    await expect(roster.getByTestId("roster-tba")).toHaveText(/Roster to be announced/);
    await expect(roster.getByTestId("roster-player")).toHaveCount(0);
    // No stream_url on this event → no watch-live link.
    await expect(detail.getByTestId("event-detail-stream")).toHaveCount(0);
  });

  test("final CO–MX: state Final, R/H/E line score, winner emphasized, no roster", async ({
    page,
  }) => {
    const ev = SFX_EVENTS.finalCoMx;
    const detail = await open(page, ev.slug);
    await expect(detail.getByTestId("event-state")).toHaveText(/Final/);
    await expect(detail.getByTestId("event-state")).toHaveText(/Final · 3–1/); // polish: score on chip
    // Atlantic time is present for every game, not only USVI ones.
    await expect(detail.getByTestId("event-time-atlantic")).toContainText(
      formatEventTime(ev.startsAt, ATLANTIC_TZ, "en"),
    );

    const ls = detail.getByTestId("linescore");
    await expect(ls.getByTestId("linescore-empty")).toHaveCount(0);
    const away = ls.getByTestId("linescore-row-away");
    const home = ls.getByTestId("linescore-row-home");
    await expect(away.getByTestId("linescore-r")).toHaveText("3");
    await expect(away.getByTestId("linescore-h")).toHaveText("6");
    await expect(away.getByTestId("linescore-e")).toHaveText("1");
    await expect(home.getByTestId("linescore-r")).toHaveText("1");
    await expect(home.getByTestId("linescore-h")).toHaveText("4");
    await expect(home.getByTestId("linescore-e")).toHaveText("2");
    await expect(away).toHaveAttribute("data-winner", "true");
    await expect(home).not.toHaveAttribute("data-winner", "true");

    await expect(detail.getByTestId("roster")).toHaveCount(0);
    await expect(detail.getByTestId("boxscore")).toHaveCount(0);
  });

  test("final USVI game: box score shows the USVI stat line", async ({ page }) => {
    const detail = await open(page, SFX_EVENTS.usviFinal.slug);
    await expect(detail.getByTestId("event-state")).toHaveText(/Final/);
    await expect(
      detail.getByTestId("linescore").getByTestId("linescore-row-away"),
    ).toHaveAttribute("data-winner", "true");
    const box = detail.getByTestId("boxscore");
    await expect(box).toBeVisible();
    await expect(box).toContainText(SFX_PLAYERS.one.name);
    await expect(box).not.toContainText(SFX_PLAYERS.two.name); // no line → did not play
  });
});
