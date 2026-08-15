/*
---
id: about-e2e-006
name: "about-e2e-006: Term rollover preserves prior board as history"
feature: softball/about
stack: web
priority: P0
group: A
references:
  - app/admin/(protected)/board/page.tsx
  - app/admin/(protected)/board/actions.ts (rollBoardTermAction)
  - components/client/roll-term-form.tsx
  - lib/board.ts (rollBoardTerm)
  - supabase/migrations/0007_about_admin.sql (board_terms_editor_insert/update; H2 permanence)
  - supabase/migrations/0008_board_term_permanence.sql (forbid_board_term_reactivation trigger)
---

GIVEN a current term with members, WHEN the editor rolls the board to a NEW term, THEN
the prior term's roster is preserved unchanged + read-only (per-term permanence) while
the new term begins empty + editable — nothing overwritten or deleted.

DESTRUCTIVE, and constrained by a HARD DB INVARIANT (migration 0008): the
`board_terms_no_reactivation` trigger forbids ANY update that turns is_current on for an
EXISTING term — for ALL writers, including the service role. A term can only become
current by INSERT. So a rollover PERMANENTLY archives the outgoing current term; it can
NEVER be flipped back. We therefore must NOT roll the live seeded current term.

Strategy that respects the trigger and restores exactly:
  - beforeAll (desktop only): CAPTURE the live current term + its roster, DELETE it
    (freeing the single-current slot; cascade removes its members), then INSERT a
    dedicated throwaway term as current with two marker members.
  - test: roll FROM the throwaway via the real editor UI; assert the throwaway roster is
    preserved read-only and the new term is empty + editable.
  - afterAll (desktop only): DELETE both throwaway terms, then RE-INSERT the captured
    term as current (born current via INSERT — the only trigger-legal way) with its
    exact roster, and VERIFY the DB is back to the captured pre-test state. If clean
    restoration cannot be guaranteed, it fails loudly rather than leaving the DB dirty.

The admin (BYPASSRLS) client is setup/teardown ONLY; the ASSERTION path (roll + reads)
is the real editor UI + real anon reads under RLS.
*/

import { test, expect, type Page, type Browser, type TestInfo } from "@playwright/test";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const SEEDED_MEMBER_TOTAL = 6; // 4 current + 2 archived (the invariant afterAll restores)

// All throwaway terms share this slug prefix so one prefix-scoped delete cleans them up
// (cascade removes their members). No seed slug starts with it.
const THROWAWAY_PREFIX = "e2e-006-throwaway";
const runId = randomUUID().slice(0, 8);
const slugA = `${THROWAWAY_PREFIX}-a-${runId}`; // throwaway current; rolled FROM
const labelA = `E2E-006 Throwaway A ${runId}`;
const slugB = `${THROWAWAY_PREFIX}-b-${runId}`; // created BY the UI roll; new current
const labelB = `E2E-006 Throwaway B ${runId}`;
const MEMBER_A1 = `e2e-006-member-a1-${runId}`;
const MEMBER_A2 = `e2e-006-member-a2-${runId}`;

// Snapshot of the live current term captured in beforeAll and restored in afterAll.
interface MemberSnap {
  name: string;
  seat: string;
  role: string;
  photo_url: string | null;
  bio: string;
  sort_order: number;
}
interface TermSnap {
  slug: string;
  label: string;
  sort_order: number;
  members: MemberSnap[];
}
let captured: TermSnap | null = null;
let throwawayTermAId = "";

function isDesktop(testInfo: TestInfo): boolean {
  return testInfo.project.name === "desktop";
}

function requireCreds(): { email: string; password: string } {
  if (!EDITOR_EMAIL || !EDITOR_PASSWORD) {
    throw new Error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set (gitignored .env.local).",
    );
  }
  return { email: EDITOR_EMAIL, password: EDITOR_PASSWORD };
}

async function signInEditor(page: Page): Promise<void> {
  const { email, password } = requireCreds();
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function deleteThrowawayTerms(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("board_terms")
    .delete()
    .like("slug", `${THROWAWAY_PREFIX}%`);
  if (error) throw error;
}

// INSERT the captured term as current (the ONLY trigger-legal path back to current) and
// re-attach its roster. Used by afterAll (restore) — never an UPDATE flip.
async function reinsertCapturedTermAsCurrent(snap: TermSnap): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("board_terms")
    .insert({
      slug: snap.slug,
      label: snap.label,
      is_current: true,
      sort_order: snap.sort_order,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (snap.members.length > 0) {
    const rows = snap.members.map((m) => ({ term_id: data.id as string, ...m }));
    const { error: mErr } = await admin.from("board_members").insert(rows);
    if (mErr) throw mErr;
  }
}

async function gotoAsAnon(
  browser: Browser,
  path: string,
  assert: (page: Page) => Promise<void>,
): Promise<void> {
  const ctx = await browser.newContext();
  try {
    const anon = await ctx.newPage();
    const res = await anon.goto(path);
    expect(res, `no response for ${path}`).not.toBeNull();
    expect(res!.status()).toBe(200);
    await assert(anon);
  } finally {
    await ctx.close();
  }
}

test.describe("about-e2e-006 — term rollover preserves history (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      !isDesktop(testInfo),
      "DESTRUCTIVE single-current-slot mutation against the shared DB — run once",
    ),
  );

  // Desktop-ONLY setup. Hooks run per project even when the test body is skipped, so we
  // gate here too — the destructive delete/reinsert must never run for the mobile project.
  test.beforeAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const admin = createAdminClient();

    // 1. Heal any throwaway leftover from a prior aborted run (frees the current slot).
    await deleteThrowawayTerms();

    // 2. Capture the live current term + roster. Exactly one current term must exist; if
    //    not, STOP rather than proceed destructively into an unknown state.
    const { data: current, error: cErr } = await admin
      .from("board_terms")
      .select("id, slug, label, sort_order")
      .eq("is_current", true);
    if (cErr) throw cErr;
    if (!current || current.length !== 1) {
      throw new Error(
        `about-e2e-006 precondition: expected exactly ONE current term, found ${current?.length ?? 0}. ` +
          "Refusing to run a destructive rollover against an unknown state.",
      );
    }
    const term = current[0];
    const { data: members, error: mErr } = await admin
      .from("board_members")
      .select("name, seat, role, photo_url, bio, sort_order")
      .eq("term_id", term.id)
      .order("sort_order", { ascending: true });
    if (mErr) throw mErr;
    captured = {
      slug: term.slug,
      label: term.label,
      sort_order: term.sort_order,
      members: (members ?? []) as MemberSnap[],
    };

    // 3. DELETE the live current term (cascade removes its members) → slot is free.
    const { error: dErr } = await admin
      .from("board_terms")
      .delete()
      .eq("id", term.id);
    if (dErr) throw dErr;

    // 4. INSERT throwaway A as the sole current term (born current via INSERT).
    const { data: ta, error: iErr } = await admin
      .from("board_terms")
      .insert({ slug: slugA, label: labelA, is_current: true, sort_order: 999 })
      .select("id")
      .single();
    if (iErr) throw iErr;
    throwawayTermAId = ta.id as string;

    // 5. Seed two marker members into throwaway A.
    const { error: smErr } = await admin.from("board_members").insert([
      { term_id: throwawayTermAId, name: MEMBER_A1, seat: "st_croix", role: "President", bio: "throwaway", sort_order: 0 },
      { term_id: throwawayTermAId, name: MEMBER_A2, seat: "at_large", role: "Secretary", bio: "throwaway", sort_order: 1 },
    ]);
    if (smErr) throw smErr;
  });

  // Desktop-ONLY teardown + full pre-test-state verification.
  test.afterAll(async ({}, testInfo) => {
    if (!isDesktop(testInfo)) return;
    const admin = createAdminClient();

    // Remove BOTH throwaway terms (cascade removes their members) — frees the slot.
    await deleteThrowawayTerms();

    // Restore the captured term as current (INSERT — the only trigger-legal path).
    if (!captured) {
      throw new Error("about-e2e-006 TEARDOWN: no captured term to restore — DB may be dirty.");
    }
    await reinsertCapturedTermAsCurrent(captured);

    // VERIFY the DB is back to the captured pre-test state, or fail loudly.
    const { count: memberTotal, error: cErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true });
    if (cErr) throw cErr;
    expect(memberTotal, "TEARDOWN: total board members must be back to the seeded 6").toBe(
      SEEDED_MEMBER_TOTAL,
    );

    const { data: currentTerms, error: tErr } = await admin
      .from("board_terms")
      .select("slug")
      .eq("is_current", true);
    if (tErr) throw tErr;
    expect(
      currentTerms.map((t) => t.slug),
      "TEARDOWN: the captured term must be the sole current term",
    ).toEqual([captured.slug]);

    const { count: leftover, error: lErr } = await admin
      .from("board_terms")
      .select("*", { count: "exact", head: true })
      .like("slug", `${THROWAWAY_PREFIX}%`);
    if (lErr) throw lErr;
    expect(leftover, "TEARDOWN: no throwaway terms may remain").toBe(0);
  });

  test("rolling to a new term archives the prior roster read-only; new term is empty + editable", async ({
    page,
    browser,
  }) => {
    // GIVEN: editor on the board admin, throwaway A is the current term (2 members).
    await signInEditor(page);
    await page.getByTestId("admin-board-link").click();
    await expect(page).toHaveURL(/\/admin\/board$/);
    await expect(page.getByTestId("board-roster-item")).toHaveCount(2);

    // WHEN: the editor rolls to a brand-new term via the UI (rollBoardTerm archives A —
    // true->false, trigger-allowed — and INSERTs B as current; the prior roster is never
    // read, updated, or deleted).
    await page.getByTestId("roll-term-slug").fill(slugB);
    await page.getByTestId("roll-term-label").fill(labelB);
    await page.getByTestId("roll-term-submit").click();

    // No form error (RLS + trigger accepted the editor rollover).
    await expect(page.getByTestId("roll-term-error")).toHaveCount(0);

    // THEN: the new current term is EMPTY (server-confirmed via revalidation) and EDITABLE.
    await expect(page.getByTestId("board-roster-item")).toHaveCount(0);
    await expect(page.getByTestId("member-add-form")).toBeVisible();

    // THEN (assertion path — anon RLS read): the prior (throwaway A) roster is preserved
    // UNCHANGED as a read-only archive — both marker members still present.
    await gotoAsAnon(browser, `/about/${slugA}`, async (anon) => {
      const roster = anon.getByTestId("about-term-roster");
      await expect(roster).toBeVisible();
      await expect(roster.getByTestId("board-member-card")).toHaveCount(2);
      for (const name of [MEMBER_A1, MEMBER_A2]) {
        await expect(
          roster.getByTestId("board-member-card").filter({ hasText: name }),
        ).toHaveCount(1);
      }
    });

    // dcon confirmation (out-of-band): permanence — throwaway A archived + BOTH members
    // still attached unchanged; the new term B is current and empty.
    const admin = createAdminClient();
    const { data: termA, error: aErr } = await admin
      .from("board_terms")
      .select("is_current")
      .eq("slug", slugA)
      .single();
    if (aErr) throw aErr;
    expect(termA.is_current, "prior term must be archived, not deleted").toBe(false);

    const { count: aMembers, error: amErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("term_id", throwawayTermAId);
    if (amErr) throw amErr;
    expect(aMembers, "prior roster must be intact (2 members)").toBe(2);

    const { data: termB, error: bErr } = await admin
      .from("board_terms")
      .select("id, is_current")
      .eq("slug", slugB)
      .single();
    if (bErr) throw bErr;
    expect(termB.is_current, "new term must be current").toBe(true);

    const { count: bMembers, error: bmErr } = await admin
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("term_id", termB.id);
    if (bmErr) throw bmErr;
    expect(bMembers, "new term must begin empty").toBe(0);
  });
});
