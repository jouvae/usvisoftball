import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the softball (USVI Softball Federation) app.
 *
 * Two projects exercise the responsive contract at real viewports:
 *   - `desktop` (1280x720): the six nav links are visible, the mobile toggle hidden.
 *   - `mobile`  (390x844):  the mobile toggle drives an expand/collapse panel.
 *
 * Server strategy:
 *   - By default Playwright starts its own dev server on :3100.
 *   - Set `PLAYWRIGHT_BASE_URL` to test against a dev server you are already
 *     running (e.g. `PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e`).
 *     `webServer` is then disabled entirely.
 *
 * Why the override exists: Next.js 16 enforces ONE dev server per project
 * directory via a lock at `.next/dev/lock`. If a `next dev` is already running
 * for this repo, spawning a second one fails with "Another next dev server is
 * already running" no matter which port it is given — and `reuseExistingServer`
 * does not help, because it probes :3100 rather than the port already in use.
 *
 * Supabase env for DB-seeding specs (init-web-001):
 *   Playwright does not auto-load `.env.local` the way `next dev` does. Specs that
 *   drive the canonical write path (createArticle / deleteAllArticles) need
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_KEY at runtime. We read `.env.local` here
 *   with a tiny dotenv-free parser (no new dependency) and copy any missing keys
 *   into process.env. This config runs in the main process BEFORE workers spawn,
 *   and workers inherit process.env at spawn, so the specs see these values.
 *   Real environment vars already set take precedence (we never overwrite).
 *
 * server-only fence + Playwright: `lib/articles.ts` and `lib/supabase/admin.ts`
 *   are fenced with `import "server-only"`, which THROWS under plain Node (there is
 *   no `react-server` export condition in a Playwright worker). Rather than weaken
 *   the app's fence, `tsconfig: "./tests/tsconfig.json"` below points the test
 *   transform at a tsconfig that aliases the `server-only` specifier to a no-op stub
 *   (tests/support/server-only-stub.ts). This is scoped to the Node test runner —
 *   where there is no client bundle to protect — so the Next.js build still uses the
 *   root tsconfig and keeps the real, throwing fence.
 */
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(__dirname, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local is optional; the real environment may already supply these vars.
  }
}
loadEnvLocal();

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  // MUST run serially with a single worker. The `desktop` and `mobile` projects
  // share ONE Supabase database and ONE `articles` table, and there is no
  // per-worker DB isolation. The init-web-001 empty-state test DELETES every
  // article and re-seeds; if any other test (notably the SAME test in the other
  // project) runs concurrently it observes a transiently empty feed — a phantom
  // failure with no bug behind it, non-deterministic in both interleavings.
  // With one mutable shared resource and no isolation, concurrency is unsafe.
  // Do NOT set these back to parallel to speed the suite up: it reintroduces a
  // heisenbug. The spec's serial-mode + finally-re-seed guards are the second
  // line of defense; this is the first.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  tsconfig: "./tests/tsconfig.json",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: "npm run dev -- -p 3100",
          url: "http://localhost:3100",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
