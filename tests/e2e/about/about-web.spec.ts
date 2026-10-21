/*
---
feature: softball/about
stack: web
status: green
node: 1
references:
  - docs/features/softball/about
  - lib/board.ts
  - app/(public)/about/page.tsx
  - app/(public)/about/[term]/page.tsx
  - components/ui/board-roster.tsx
  - components/ui/board-member-card.tsx
scenarios:
  - about-web-001: /about renders the mission + current board roster (4 members)
  - about-web-002: each current card shows name + office and opens its profile (no seat shown publicly); no-photo → initials fallback
  - about-web-003: archive term link → archived roster; bad slug → real HTTP 404
---

Public, read-only render of /about against the REAL seeded Supabase baseline
(migration 0006 + seed:about). NO auth, NO forged sessions, NO DB mutation or
teardown — the seeded board/mission IS the intended baseline, so these specs only
observe the rendered DOM. Desktop-gated (viewport-agnostic content, but pinned to
one project for determinism against the shared DB), matching the init house style.
*/

import { test, expect, type Page } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// CURRENT-board facts are DERIVED from a live service-key read, not hardcoded:
// editors change the board through /admin/board, so the roster is live content, not a
// frozen seed (it once drifted when "Marlene Charles" was replaced by a real President).
// The beforeAll still fails loudly on an empty roster / broken read, so a silently-empty
// page can't pass by tautology. Archived-term facts (below) stay hardcoded — an archived
// term is immutable (0008 permanence guard), so it cannot drift.
// ---------------------------------------------------------------------------
let currentCount = 0;
let knownCurrentMember = "";
let noPhotoMember: string | null = null;
let noPhotoInitials = "";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

test.beforeAll(async () => {
  const supabase = createAdminClient();
  const { data: term } = await supabase
    .from("board_terms")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (!term) throw new Error("no current board term seeded");
  const { data, error } = await supabase
    .from("board_members")
    .select("name, photo_url")
    .eq("term_id", (term as { id: string }).id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const members = (data ?? []) as { name: string; photo_url: string | null }[];
  if (members.length === 0) throw new Error("current board roster is empty");
  currentCount = members.length;
  knownCurrentMember = members[0].name;
  const noPhoto = members.find((m) => !m.photo_url);
  if (noPhoto) {
    noPhotoMember = noPhoto.name;
    noPhotoInitials = initialsOf(noPhoto.name);
  }
});

// Archived term (isCurrent=false) and its roster.
const ARCHIVE_SLUG = "2023-2025";
const ARCHIVE_HREF = `/about/${ARCHIVE_SLUG}`;
const ARCHIVE_MEMBERS = ["Ivan Fredericks", "Sandra Peters"];
const BAD_TERM_SLUG = "nonexistent-term";

// Desktop-only: these assertions are viewport-agnostic (content/DOM), so pin them
// to a single project to stay deterministic against the shared Supabase DB and to
// avoid the mobile nav overlay. Mirrors the init-web-001 desktop-gating pattern:
// the describe-level test.skip callback receives only fixtures (never testInfo),
// so gate inside a beforeEach where testInfo is available.
function desktopOnly(): void {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "public read-only render: pinned to the desktop project for determinism",
    ),
  );
}

async function gotoOk(page: Page, path: string): Promise<void> {
  const res = await page.goto(path);
  expect(res, `no response for ${path}`).not.toBeNull();
  expect(res!.status(), `${path} status`).toBe(200);
}

// ===========================================================================
// about-web-001 — /about renders the mission and the current board roster.
// ===========================================================================
test.describe("about-web-001 — mission + current board roster", () => {
  desktopOnly();

  test.beforeEach(async ({ page }) => {
    await gotoOk(page, "/about");
  });

  test("mission section is visible with non-empty prose", async ({ page }) => {
    const mission = page.getByTestId("about-mission");
    await expect(mission).toBeVisible();
    // Non-empty text — a blank mission block (broken site_content read) fails here.
    await expect(mission).not.toHaveText("");
    expect((await mission.innerText()).trim().length).toBeGreaterThan(0);
  });

  test("board grid is visible with the current member cards", async ({ page }) => {
    const roster = page.getByTestId("about-board");
    await expect(roster).toBeVisible();
    // Count matches the live current-term roster (>0): proves non-empty AND correct term.
    expect(currentCount).toBeGreaterThan(0);
    await expect(roster.getByTestId("board-grid-card")).toHaveCount(currentCount);
  });

  test("a known current member renders", async ({ page }) => {
    const roster = page.getByTestId("about-board");
    await expect(
      roster.getByTestId("board-grid-card").filter({ hasText: knownCurrentMember }),
    ).toHaveCount(1);
  });
});

// ===========================================================================
// about-web-002 — name + office cards open the profile; no-photo → initials fallback.
// The island seat is no longer shown publicly (the real roster's seats are unconfirmed and
// the team-section layout shows name + office only), so the old seat-coverage checks are gone.
// ===========================================================================
test.describe("about-web-002 — profile modal + initials fallback", () => {
  desktopOnly();

  test.beforeEach(async ({ page }) => {
    await gotoOk(page, "/about");
  });

  test("every current card renders a name and opens the matching profile", async ({
    page,
  }) => {
    const board = page.getByTestId("about-board");
    const cards = board.getByTestId("board-grid-card");
    await expect(cards).toHaveCount(currentCount);
    await expect(board.getByTestId("board-grid-name")).toHaveCount(currentCount);
    await cards.first().click();
    await expect(page.getByTestId("board-modal-name")).toHaveText(knownCurrentMember);
    await expect(page.getByTestId("board-modal-role")).not.toBeEmpty();
    await expect(page.getByTestId("board-modal-seat")).toHaveCount(0);
    await page.getByTestId("board-modal-close").click();
    await expect(page.getByTestId("board-modal")).toHaveJSProperty("open", false);
  });

  test("the no-photo member renders the initials fallback (no <img>)", async ({
    page,
  }) => {
    // Only meaningful if the live roster currently has a member WITHOUT a photo; editors
    // may have given everyone a headshot. Skip cleanly rather than assert a stale name.
    test.skip(
      noPhotoMember === null,
      "every current board member currently has a photo",
    );
    const card = page
      .getByTestId("about-board")
      .getByTestId("board-grid-card")
      .filter({ hasText: noPhotoMember! });
    await expect(card).toHaveCount(1);

    // The avatar exists for every card...
    const avatar = card.getByTestId("board-grid-avatar");
    await expect(avatar).toBeVisible();
    // ...but for the photoless member it is the navy initials block, NOT a broken
    // <img>: the photoUrl branch is skipped, so no <img> is emitted at all.
    await expect(avatar.locator("img")).toHaveCount(0);
    await expect(avatar).toHaveText(noPhotoInitials);
  });
});

// ===========================================================================
// about-web-003 — archive term link → archived roster; bad slug → real 404.
// ===========================================================================
test.describe("about-web-003 — archive detail + 404", () => {
  desktopOnly();

  test("archive link routes to the archived term's roster", async ({ page }) => {
    await gotoOk(page, "/about");

    // The archive list links to the archived term by slug.
    const archiveLink = page.locator(
      `[data-testid="about-archive-term"][href="${ARCHIVE_HREF}"]`,
    );
    await expect(archiveLink).toHaveCount(1);

    await archiveLink.click();
    await page.waitForURL(`**${ARCHIVE_HREF}`);

    // The archived roster renders with its own testid + the archived members.
    const roster = page.getByTestId("about-term-roster");
    await expect(roster).toBeVisible();
    for (const name of ARCHIVE_MEMBERS) {
      await expect(
        roster.getByTestId("board-member-card").filter({ hasText: name }),
      ).toHaveCount(1);
    }
  });

  test("a bad term slug returns a real HTTP 404", async ({ page }) => {
    // notFound() at the page → a genuine 404 response, not a soft/200 render.
    const resp = await page.goto(`/about/${BAD_TERM_SLUG}`);
    expect(resp, "no response for bad term slug").not.toBeNull();
    expect(resp!.status()).toBe(404);
  });
});
