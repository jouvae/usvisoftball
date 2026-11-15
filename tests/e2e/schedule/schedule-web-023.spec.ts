/*
---
id: schedule-web-023
name: "schedule-web-023: /sitemap.xml lists en + es public URLs with hreflang; /robots.txt points at it"
feature: softball/schedule
stack: web
priority: P1
status: red
group: S5
references:
  - app/sitemap.ts
  - app/robots.ts
  - lib/site.ts (SITE_URL = https://usvisoftball.org)
  - tests/support/schedule-fixtures.ts
---

## Given
The schedule fixtures (tournament `e2e-cup`, five events, guest team `e2e-colombia`).

## When
A crawler requests `GET /sitemap.xml` and `GET /robots.txt`.

## Then
`/sitemap.xml` is 200 XML whose `<loc>`s are absolute URLs on SITE_URL for `/`, `/events`,
`/es/events`, every fixture `/events/{slug}` and `/es/events/{slug}`, `/tournaments/e2e-cup` and the
guest team `/teams/e2e-colombia`; each fixture event URL carries `<xhtml:link rel="alternate"
hreflang="en|es">` pairs pointing at its en and es URLs. `/robots.txt` is 200 text that allows `/`,
disallows `/admin`, and lists `Sitemap: https://usvisoftball.org/sitemap.xml`.
*/

import { test, expect, type APIRequestContext } from "@playwright/test";
import { SITE_URL } from "@/lib/site";
import {
  SFX_EVENTS,
  SFX_TEAMS,
  SFX_TOURNAMENT,
  cleanupScheduleFixtures,
  seedScheduleFixtures,
} from "../../support/schedule-fixtures";

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_ENABLED === "true";

type UrlEntry = { loc: string; alternates: Record<string, string> };

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

// Minimal sitemap parser: each <url> → its <loc> and xhtml:link hreflang alternates.
function parseSitemap(xml: string): UrlEntry[] {
  const out: UrlEntry[] = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>\s*([^<]*?)\s*<\/loc>/)?.[1]?.replace(/&amp;/g, "&");
    if (!loc) continue;
    const alternates: Record<string, string> = {};
    for (const tag of block.match(/<xhtml:link\b[^>]*>/g) ?? []) {
      const lang = attr(tag, "hreflang");
      const href = attr(tag, "href");
      if (attr(tag, "rel") === "alternate" && lang && href) alternates[lang] = href;
    }
    out.push({ loc, alternates });
  }
  return out;
}

async function fetchSitemap(request: APIRequestContext) {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"] ?? "").toMatch(/xml/);
  const body = await res.text();
  return { body, entries: parseSitemap(body) };
}

const abs = (path: string) => `${SITE_URL}${path}`;

test.describe("schedule-web-023 — sitemap.xml + robots.txt", () => {
  test.describe("sitemap", () => {
    test.beforeEach(() => {
      test.skip(!EVENTS_ON, "Events feature flag is OFF");
    });
    test.beforeAll(async () => {
      if (!EVENTS_ON) return;
      await seedScheduleFixtures();
    });
    test.afterAll(async () => {
      if (!EVENTS_ON) return;
      await cleanupScheduleFixtures();
    });

    test("is 200 XML of absolute SITE_URL locations", async ({ request }) => {
      const { body, entries } = await fetchSitemap(request);
      expect(body).toContain("<urlset");
      expect(body).toMatch(/xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.loc.startsWith(`${SITE_URL}/`) || e.loc === SITE_URL, e.loc).toBe(true);
      }
    });

    test("lists home, the events hub (en + es), fixture events, tournament and guest team", async ({
      request,
    }) => {
      const { entries } = await fetchSitemap(request);
      const locs = new Set(entries.map((e) => e.loc.replace(/\/$/, "") || e.loc));
      const has = (path: string) => locs.has(abs(path).replace(/\/$/, ""));

      expect(locs.has(SITE_URL) || locs.has(`${SITE_URL}/`), "home /").toBe(true);
      for (const path of [
        "/events",
        "/es/events",
        `/tournaments/${SFX_TOURNAMENT.slug}`,
        `/teams/${SFX_TEAMS.colombia.slug}`,
      ]) {
        expect(has(path), path).toBe(true);
      }
      for (const ev of Object.values(SFX_EVENTS)) {
        expect(has(`/events/${ev.slug}`), `/events/${ev.slug}`).toBe(true);
        expect(has(`/es/events/${ev.slug}`), `/es/events/${ev.slug}`).toBe(true);
      }
    });

    test("fixture event URLs carry en/es hreflang alternates", async ({ request }) => {
      const { entries } = await fetchSitemap(request);
      for (const ev of Object.values(SFX_EVENTS)) {
        const en = abs(`/events/${ev.slug}`);
        const es = abs(`/es/events/${ev.slug}`);
        const entry = entries.find((e) => e.loc === en);
        expect(entry, `<url> for ${en}`).toBeDefined();
        expect(entry!.alternates.en, `${en} hreflang=en`).toBe(en);
        expect(entry!.alternates.es, `${en} hreflang=es`).toBe(es);
      }
    });
  });

  test.describe("robots", () => {
    test("allows /, disallows /admin and lists the sitemap", async ({ request }) => {
      const res = await request.get("/robots.txt");
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"] ?? "").toMatch(/text\/plain/);
      const lines = (await res.text()).split(/\r?\n/).map((l) => l.trim());
      const has = (re: RegExp) => lines.some((l) => re.test(l));

      expect(has(/^user-agent:\s*\*$/i), "User-Agent: *").toBe(true);
      expect(has(/^allow:\s*\/$/i), "Allow: /").toBe(true);
      expect(has(/^disallow:\s*\/admin\/?$/i), "Disallow: /admin").toBe(true);
      expect(has(/^disallow:\s*\/$/i), "must not disallow everything").toBe(false);
      expect(
        has(new RegExp(`^sitemap:\\s*${`${SITE_URL}/sitemap.xml`.replace(/[.]/g, "\\.")}$`, "i")),
        "Sitemap: <SITE_URL>/sitemap.xml",
      ).toBe(true);
    });
  });
});
