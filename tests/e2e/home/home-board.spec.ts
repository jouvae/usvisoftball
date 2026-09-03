/*
---
id: home-board
name: "home-board: home board grid + profile modal, and editor-editable board socials (MVP slice 5)"
feature: softball/init
stack: web
priority: P0
group: A
references:
  - app/(public)/page.tsx
  - components/client/board-grid.tsx
  - components/client/board-member-form.tsx
  - app/admin/(protected)/board/page.tsx
  - app/admin/(protected)/board/actions.ts
  - lib/board.ts
  - lib/board-view.ts
---

## Given
The public home reads listCurrentBoard(); when the current term has ≥1 member it
renders a <section data-testid="home-board"> with an "Our Board" h2, a
home-board-about-link → /about, and a <BoardGrid> of board-grid-card buttons. A card
opens a native <dialog data-testid="board-modal"> showing board-modal-name /
board-modal-role, an optional board-modal-bio, a board-modal-close button, and — when
the member has valid links — a board-modal-socials list of board-modal-social-{platform}
anchors (https, on the platform host allowlist, target=_blank rel=noopener). The admin
board form exposes member-social-{facebook|instagram|linkedin|x} inputs (name=`{platform}Url`);
the editor-gated Server Action validates each (present ⇒ https on the platform host
allowlist, else a friendly form error; '' clears it) and writes through the RLS session client.

## When
(1) An anonymous visitor loads "/", opens a card, then a card with socials. (2) They open a
card and press Escape. (3) A signed-in editor sets a valid LinkedIn URL on a socials-less
member, submits, and a fresh anon visitor opens that member's modal — then the editor clears
it. (4) The editor submits an off-host/non-https LinkedIn value.

## Then
(1) The section, grid (≥1 card), and /about link render; a card opens the modal with the
matching name + role and the close button closes it; a socials-bearing card's modal shows ≥1
valid https board-modal-social-* anchor (allowlisted host, target=_blank, rel includes noopener).
(2) Escape closes the native dialog. (3) The edit succeeds with no form error and the anon home
modal now shows a board-modal-social-linkedin anchor with that href; after the editor clears it,
the modal shows it no more. (4) The invalid value is rejected with a member-edit-error and never
persists (no board-modal-social-linkedin on a fresh anon home modal). The DB is left as found —
only the picked member's LinkedIn is ever touched, and it is restored (service-role safety net in
afterAll). The President's seeded fb/ig are never touched. Seed-agnostic: the target member, the
socials-bearing member, and every name are DERIVED from the live board, nothing hardcoded.

The auth flow reuses the established real Supabase sign-in (SEED_ADMIN_* is the seed editor),
driven through /admin/login exactly as home-highlights / init-e2e-003a do — no minted session.
*/

import { test, expect, type Page, type Browser } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── env (loaded from gitignored .env.local by playwright.config.ts loadEnvLocal) ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_KEY; // sb_secret_… — RLS-bypassing, cleanup/restore + authoritative reads only.
const EDITOR_EMAIL = process.env.SEED_ADMIN_EMAIL;
const EDITOR_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

function requireEnv(): {
  url: string;
  serviceKey: string;
  email: string;
  password: string;
} {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_KEY) missing.push("SUPABASE_KEY (service-role sb_secret_…, cleanup/restore)");
  if (!EDITOR_EMAIL) missing.push("SEED_ADMIN_EMAIL");
  if (!EDITOR_PASSWORD) missing.push("SEED_ADMIN_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `home-board spec cannot run — set these in gitignored .env.local: ${missing.join(", ")}. ` +
        "The seed editor user + role are documented preconditions (see init-e2e-003a).",
    );
  }
  return {
    url: SUPABASE_URL!,
    serviceKey: SERVICE_KEY!,
    email: EDITOR_EMAIL!,
    password: EDITOR_PASSWORD!,
  };
}

// A valid https LinkedIn URL on the allowlisted host (uniquely stamped so a stray row is
// obvious). This is the ONLY value the spec ever writes.
const STAMP = Date.now();
const VALID_LINKEDIN = `https://www.linkedin.com/in/zz-home-board-${STAMP}`;
// Off-host, still a syntactically valid https URL so the type=url input does NOT block the
// submit client-side — the SERVER-side host allowlist is what must reject it.
const BAD_LINKEDIN = "https://evil.example.com/x";

// The canonical host each platform anchor must resolve to (mirrors BOARD_SOCIAL_HOSTS in
// lib/board-view — kept as a local regex so the spec needs no server-only-adjacent import).
const PLATFORM_HOST: Record<string, RegExp> = {
  facebook: /(^|\.)facebook\.com$/,
  instagram: /(^|\.)instagram\.com$/,
  linkedin: /(^|\.)linkedin\.com$/,
  x: /(^|\.)(x|twitter)\.com$/,
};

// ── service-role client + authoritative reads (selection + cleanup only; never a write path
//    the product owns — the real editor UI does every product write) ──────────────────────
function serviceClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function currentTermId(svc: SupabaseClient): Promise<string> {
  const { data, error } = await svc
    .from("board_terms")
    .select("id")
    .eq("is_current", true)
    .single();
  expect(error, "reading the current term must succeed").toBeNull();
  return (data as { id: string }).id;
}

async function memberByName(
  svc: SupabaseClient,
  termId: string,
  name: string,
): Promise<{ id: string; linkedin_url: string | null }> {
  const { data, error } = await svc
    .from("board_members")
    .select("id, linkedin_url")
    .eq("term_id", termId)
    .eq("name", name)
    .single();
  expect(error, `reading the '${name}' member must succeed`).toBeNull();
  return data as { id: string; linkedin_url: string | null };
}

// ── real editor sign-in (the home-highlights / init-e2e-003a helper shape) ──
async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill(email);
  await page.getByTestId("admin-login-password").fill(password);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

// ── home-board DOM helpers ──
async function gotoHome(page: Page): Promise<void> {
  const res = await page.goto("/");
  expect(res, "no response for /").not.toBeNull();
  expect(res!.status()).toBe(200);
  await expect(page.getByTestId("home-board")).toBeVisible();
}

// Every current-term member's display name, in grid order — the seed-agnostic derivation key.
async function boardNames(page: Page): Promise<string[]> {
  const cards = page.getByTestId("board-grid-card");
  const n = await cards.count();
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    names.push((await cards.nth(i).getByTestId("board-grid-name").innerText()).trim());
  }
  return names;
}

// Open the modal for the card whose name span matches `name` exactly. Assumes `page` is on
// home with the modal currently closed.
async function openModal(page: Page, name: string) {
  const card = page
    .getByTestId("board-grid-card")
    .filter({ has: page.getByText(name, { exact: true }) });
  await card.first().click();
  const modal = page.getByTestId("board-modal");
  await expect(modal).toHaveJSProperty("open", true);
  await expect(page.getByTestId("board-modal-name")).toHaveText(name);
  return modal;
}

async function closeModalViaButton(page: Page): Promise<void> {
  await page.getByTestId("board-modal-close").click();
  await expect(page.getByTestId("board-modal")).toHaveJSProperty("open", false);
}

// Walk the grid once, opening each modal, to DERIVE a socials-bearing member and a
// socials-less one — both without hardcoding any identity.
async function classify(page: Page): Promise<{
  withSocials: string | null;
  without: string | null;
  names: string[];
}> {
  const names = await boardNames(page);
  let withSocials: string | null = null;
  let without: string | null = null;
  for (const name of names) {
    await openModal(page, name);
    const hasSocials = (await page.getByTestId("board-modal-socials").count()) > 0;
    await closeModalViaButton(page);
    if (hasSocials && !withSocials) withSocials = name;
    if (!hasSocials && !without) without = name;
    if (withSocials && without) break;
  }
  return { withSocials, without, names };
}

// Open a FRESH anonymous context, load home, open `name`'s modal, and report whether a
// board-modal-social-linkedin anchor is present (+ its href). The fresh context guarantees no
// editor cookie — the genuine anonymous read path.
async function anonLinkedin(
  browser: Browser,
  name: string,
): Promise<{ present: boolean; href: string | null }> {
  const ctx = await browser.newContext();
  try {
    const p = await ctx.newPage();
    await gotoHome(p);
    await openModal(p, name);
    const link = p.getByTestId("board-modal-social-linkedin");
    if ((await link.count()) === 0) return { present: false, href: null };
    return { present: true, href: await link.getAttribute("href") };
  } finally {
    await ctx.close();
  }
}

// The roster <li> for `name` on the admin board screen (name · seat · role + edit form).
function rosterItem(page: Page, name: string) {
  return page.getByTestId("board-roster-item").filter({ hasText: name });
}

// Submit a member edit form and wait for the Server Action POST to resolve, so a subsequent
// anon read observes a settled write (not a race).
async function submitMemberEdit(page: Page, save: ReturnType<Page["getByTestId"]>): Promise<void> {
  await Promise.all([
    page
      .waitForResponse((r) => r.request().method() === "POST", { timeout: 15_000 })
      .catch(() => null),
    save.click(),
  ]);
}

// Set the picked member's LinkedIn through the real editor UI, awaiting completion.
async function editLinkedinViaUi(page: Page, name: string, value: string): Promise<void> {
  await page.goto("/admin/board");
  await expect(page.getByTestId("board-admin")).toBeVisible();
  const item = rosterItem(page, name).first();
  await expect(item, `the '${name}' roster item must be present in the admin board`).toBeVisible();
  await item.getByTestId("member-social-linkedin").fill(value);
  await submitMemberEdit(page, item.getByTestId("member-save"));
}

// Derive the target (a socials-less, non-President member) via an anon page pass, then read
// its id + original LinkedIn via service role for the afterAll restore. Sets module state.
let targetId: string | null = null;
let targetName: string | null = null;
let originalLinkedin: string | null = null;

async function deriveTarget(page: Page): Promise<string> {
  const env = requireEnv();
  await gotoHome(page);
  const { without } = await classify(page);
  expect(without, "a current-term member WITHOUT socials must exist to edit").toBeTruthy();
  targetName = without!;
  const svc = serviceClient(env.url, env.serviceKey);
  const termId = await currentTermId(svc);
  const row = await memberByName(svc, termId, targetName);
  targetId = row.id;
  originalLinkedin = row.linkedin_url; // expected null for a socials-less member
  return targetName;
}

// ===========================================================================
// Gated to the `desktop` project: tests 3 & 4 drive the real editor auth flow and MUTATE a
// shared Supabase row; the two projects share ONE DB with no per-worker isolation
// (playwright.config.ts), so running the write flow in both would race. Mirrors
// home-highlights / init-e2e-003a single-project gating. The anon read tests carry no
// viewport dependence, so they run once here too.
// ===========================================================================
test.describe("home-board — board grid, profile modal, and editor-editable socials (desktop)", () => {
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "real editor sign-in + socials write, no viewport dependence — run once against the shared DB",
    ),
  );

  test.afterAll(async () => {
    // Restore the ONLY column this spec ever mutated (the picked member's LinkedIn) to its
    // original value, via the RLS-bypassing service client — the safety net even if a step
    // failed mid-flight. The President's fb/ig and every other column are never touched.
    if (!SUPABASE_URL || !SERVICE_KEY || !targetId) return;
    const svc = serviceClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await svc
      .from("board_members")
      .update({ linkedin_url: originalLinkedin })
      .eq("id", targetId);
    expect(error, "service-role restore of the picked member's LinkedIn must succeed").toBeNull();

    // Confirm the DB is left exactly as found for that member.
    const { data, error: readErr } = await svc
      .from("board_members")
      .select("linkedin_url")
      .eq("id", targetId)
      .single();
    expect(readErr, "post-restore verification read must succeed").toBeNull();
    expect(
      (data as { linkedin_url: string | null }).linkedin_url,
      "the picked member's LinkedIn is back to its original value — DB left as found",
    ).toBe(originalLinkedin);
  });

  test("public home (anon): board section + grid render, a card opens/closes its modal, and a socials card exposes a valid link", async ({
    page,
  }) => {
    // GIVEN/WHEN: an anonymous visitor loads home.
    await gotoHome(page);

    // THEN: the section, the "Our Board" h2, and the /about link render.
    await expect(
      page.getByRole("heading", { level: 2, name: /^Our Board$/i }),
    ).toBeVisible();
    const aboutLink = page.getByTestId("home-board-about-link");
    await expect(aboutLink).toBeVisible();
    await expect(aboutLink).toHaveAttribute("href", "/about");

    // The grid has ≥1 card.
    await expect(page.getByTestId("board-grid")).toBeVisible();
    const cards = page.getByTestId("board-grid-card");
    const cardCount = await cards.count();
    expect(cardCount, "the board grid renders ≥1 card").toBeGreaterThan(0);

    // Click the FIRST card → the modal opens showing THAT card's name + a role, then the
    // close button closes it (native dialog no longer open).
    const firstName = (await cards.first().getByTestId("board-grid-name").innerText()).trim();
    await openModal(page, firstName);
    await expect(page.getByTestId("board-modal-role")).toBeVisible();
    await expect(page.getByTestId("board-modal-role")).not.toBeEmpty();
    await closeModalViaButton(page);

    // Open a card whose member HAS social links (derived) and assert ≥1 valid anchor.
    const { withSocials } = await classify(page);
    expect(
      withSocials,
      "a current-term member WITH social links must exist (the seeded President)",
    ).toBeTruthy();
    await openModal(page, withSocials!);

    const socials = page.getByTestId("board-modal-socials");
    await expect(socials).toBeVisible();
    const anchors = socials.locator("a[data-testid^='board-modal-social-']");
    const anchorCount = await anchors.count();
    expect(anchorCount, "the socials modal renders ≥1 platform anchor").toBeGreaterThan(0);

    for (let i = 0; i < anchorCount; i++) {
      const a = anchors.nth(i);
      const testId = await a.getAttribute("data-testid");
      const platform = testId!.replace("board-modal-social-", "");
      const href = await a.getAttribute("href");
      expect(href, `${platform} anchor has an href`).toBeTruthy();
      const url = new URL(href!);
      expect(url.protocol, `${platform} link is https`).toBe("https:");
      expect(
        PLATFORM_HOST[platform].test(url.host),
        `${platform} link host ${url.host} is on the allowlist`,
      ).toBe(true);
      await expect(a).toHaveAttribute("target", "_blank");
      const rel = await a.getAttribute("rel");
      expect(rel ?? "", `${platform} anchor rel includes noopener`).toContain("noopener");
    }
    await closeModalViaButton(page);
  });

  test("accessibility smoke: pressing Escape closes the native dialog", async ({ page }) => {
    await gotoHome(page);
    const firstName = (
      await page.getByTestId("board-grid-card").first().getByTestId("board-grid-name").innerText()
    ).trim();
    await openModal(page, firstName);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("board-modal")).toHaveJSProperty("open", false);
  });

  test("editor socials round-trip: a valid LinkedIn saves + appears on the anon home modal, then clears", async ({
    page,
    browser,
  }) => {
    const env = requireEnv();

    // DERIVE the target (socials-less, not the President) from the live board (anon page).
    const name = await deriveTarget(page);

    // GIVEN: a signed-in editor.
    await signIn(page, env.email, env.password);

    // WHEN: the editor sets a VALID LinkedIn URL on that member and submits.
    await editLinkedinViaUi(page, name, VALID_LINKEDIN);

    // THEN: no form error is surfaced (success).
    await expect(
      rosterItem(page, name).first().getByTestId("member-edit-error"),
      "a valid https LinkedIn on the allowlisted host must NOT raise a form error",
    ).toHaveCount(0);

    // ...and a FRESH anon visitor now sees the linkedin anchor with that exact href.
    const after = await anonLinkedin(browser, name);
    expect(after.present, "the linkedin anchor now appears on the anon home modal").toBe(true);
    expect(after.href, "the anon modal linkedin href is the value the editor saved").toBe(
      VALID_LINKEDIN,
    );
    expect(new URL(after.href!).host, "the saved link is on www.linkedin.com").toBe(
      "www.linkedin.com",
    );

    // WHEN: the editor CLEARS the LinkedIn (restore) via a fresh load of the form.
    await editLinkedinViaUi(page, name, "");
    await expect(
      rosterItem(page, name).first().getByTestId("member-edit-error"),
      "clearing the LinkedIn ('') must succeed with no form error",
    ).toHaveCount(0);

    // THEN: the anon home modal no longer shows the linkedin anchor.
    const restored = await anonLinkedin(browser, name);
    expect(restored.present, "the linkedin anchor is gone from the anon home modal after clearing").toBe(
      false,
    );
  });

  test("editor validation rejection: an off-host LinkedIn is rejected and never persists", async ({
    page,
    browser,
  }) => {
    const env = requireEnv();

    // DERIVE the same class of target (idempotent; sets module state for the afterAll restore).
    const name = await deriveTarget(page);

    // GIVEN: a signed-in editor.
    await signIn(page, env.email, env.password);

    // WHEN: the editor submits an off-host / non-allowlisted LinkedIn value.
    await editLinkedinViaUi(page, name, BAD_LINKEDIN);

    // THEN: the member error slot shows the friendly validation error (mentions LinkedIn).
    const err = rosterItem(page, name).first().getByTestId("member-edit-error");
    await expect(err, "an off-host LinkedIn must raise a member-edit-error").toBeVisible();
    await expect(err).toHaveText(/linkedin/i);

    // ...and the bad value NEVER persisted: a fresh anon home modal shows no linkedin anchor.
    const probe = await anonLinkedin(browser, name);
    expect(
      probe.present,
      "the rejected value was never written — no linkedin anchor on the anon home modal",
    ).toBe(false);
  });
});
