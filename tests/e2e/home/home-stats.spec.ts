/*
---
id: home-stats
name: "home-stats: editor-managed home stats strip — admin CRUD, publish gate, RLS (home-layout slice 4)"
feature: softball/home-layout
stack: web
priority: P0
group: A
references:
  - supabase/migrations/0023_home_stats.sql
  - lib/stats.ts
  - lib/stats-view.ts
  - app/admin/(protected)/stats/page.tsx
  - app/admin/(protected)/stats/actions.ts
  - components/client/stat-form.tsx
  - components/ui/stats-strip.tsx
  - app/(public)/page.tsx
---

## Given
`home_stats` (0023): anon may SELECT only published rows; editors read all and write.
The home renders <StatsStrip> (home-stats) with the first three PUBLISHED stats by
sort_order — each home-stat shows label, value, optional detail, and an "as of" date — and
omits the strip when none are published. /admin/stats (editor-only) has an add form
(stat-add-form) and one stat-admin-item per stat with an edit form + delete.

## When
(1) An anonymous visitor loads "/" and queries home_stats through the public API.
(2) A signed-in editor adds a uniquely-labelled stat as a DRAFT, then publishes it with the
lowest sort order, then unpublishes it, then deletes it. (3) The editor submits a stat whose
source link is not https.

## Then
(1) The strip, if present, shows 1–3 stats, each with a label, value, and as-of date; the
public API returns no unpublished rows. (2) The draft never appears on the anon home; once
published it is the first home-stat (label + value match, "as of" shown); once unpublished it
is gone; after delete it is gone from the admin list. (3) The form returns a friendly error
and nothing is written. Every row the test creates is deleted in a finally — the shared DB
ends where it started.
*/

import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

function requireCreds(): { email: string; password: string } {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local).",
    );
  }
  return { email: EDITOR_EMAIL, password: EDITOR_PASSWORD };
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// The admin list item for our uniquely-labelled stat.
function item(page: Page, label: string) {
  return page.locator(`[data-testid="stat-admin-item"][data-stat-label="${label}"]`);
}

// Anonymous home: the labels of the rendered home-stats, in order.
async function anonStatLabels(browser: Browser): Promise<string[]> {
  const context = await browser.newContext();
  try {
    const anon = await context.newPage();
    await anon.goto("/");
    return await anon.getByTestId("home-stat-label").allInnerTexts();
  } finally {
    await context.close();
  }
}

test.describe("home-stats — public strip + RLS", () => {
  test("the strip, when present, shows 1–3 well-formed stats", async ({ page }) => {
    await page.goto("/");
    const stats = page.getByTestId("home-stat");
    const n = await stats.count();
    if (n === 0) {
      await expect(page.getByTestId("home-stats")).toHaveCount(0);
      return;
    }
    expect(n).toBeLessThanOrEqual(3);
    for (let i = 0; i < n; i++) {
      const s = stats.nth(i);
      await expect(s.getByTestId("home-stat-label")).not.toBeEmpty();
      await expect(s.getByTestId("home-stat-value")).not.toBeEmpty();
      await expect(s.getByTestId("home-stat-as-of")).toContainText(/as of \w{3} \d{4}/);
    }
  });

  test("the public API never returns an unpublished stat", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!url || !key, "public Supabase env not available");
    const anon = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await anon
      .from("home_stats")
      .select("id")
      .eq("is_published", false);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});

// Gated to desktop: real editor sign-in + writes to the shared DB — run once.
test.describe("home-stats — editor CRUD + publish gate (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real editor sign-in + home_stats writes — run once against the shared DB",
    ),
  );

  test("draft → publish → unpublish → delete, reflected on the anon home", async ({
    page,
    browser,
  }) => {
    const { email, password } = requireCreds();
    const label = `E2E stat ${Date.now()}`;
    await signIn(page, email, password);

    try {
      // GIVEN the admin screen, add a DRAFT (published unchecked by default).
      await page.goto("/admin/stats");
      await expect(page.getByTestId("stats-admin")).toBeVisible();
      const add = page.getByTestId("stat-add-form");
      await add.getByTestId("stat-label").fill(label);
      await add.getByTestId("stat-value").fill("E2E");
      await add.getByTestId("stat-detail").fill("test figure");
      await add.getByTestId("stat-as-of").fill("2026-10-01");
      await add.getByTestId("stat-sort").fill("-100000");
      await add.getByTestId("stat-add").click();
      await expect(item(page, label)).toHaveCount(1);
      await expect(item(page, label).getByTestId("stat-admin-name")).toContainText("Draft");

      // THEN the draft is NOT on the anon home.
      expect(await anonStatLabels(browser)).not.toContain(label);

      // WHEN published (lowest sort order) → it is the FIRST home-stat.
      await item(page, label).getByTestId("stat-published").check();
      await item(page, label).getByTestId("stat-save").click();
      await expect(item(page, label).getByTestId("stat-admin-name")).toContainText(
        "Published",
      );
      const labels = await anonStatLabels(browser);
      expect(labels[0]).toBe(label);

      // WHEN unpublished → gone from the anon home.
      await item(page, label).getByTestId("stat-published").uncheck();
      await item(page, label).getByTestId("stat-save").click();
      await expect(item(page, label).getByTestId("stat-admin-name")).toContainText("Draft");
      expect(await anonStatLabels(browser)).not.toContain(label);
    } finally {
      // Cleanup: delete our row (also the DELETE assertion).
      await page.goto("/admin/stats");
      if ((await item(page, label).count()) > 0) {
        await item(page, label).getByTestId("stat-delete").click();
      }
      await expect(item(page, label)).toHaveCount(0);
    }
  });

  test("a non-https source link is rejected with a friendly error", async ({ page }) => {
    const { email, password } = requireCreds();
    const label = `E2E bad source ${Date.now()}`;
    await signIn(page, email, password);
    await page.goto("/admin/stats");

    const add = page.getByTestId("stat-add-form");
    await add.getByTestId("stat-label").fill(label);
    await add.getByTestId("stat-value").fill("X");
    await add.getByTestId("stat-as-of").fill("2026-10-01");
    // type=url accepts http://, so this reaches the server-side check.
    await add.getByTestId("stat-source").fill("http://example.com/rankings");
    await add.getByTestId("stat-add").click();

    await expect(page.getByTestId("stat-add-error")).toContainText(/https/);
    await expect(item(page, label)).toHaveCount(0);
  });
});
