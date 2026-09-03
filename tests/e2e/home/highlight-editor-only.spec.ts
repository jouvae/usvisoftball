/*
---
id: highlight-editor-only
name: "is_highlight is editor-only — the 0021 BEFORE UPDATE trigger rejects a contributor flipping the curation flag"
feature: softball/init
stack: db (out-of-band REST probe, not a UI/page test)
priority: P0
kind: security-regression
references:
  - supabase/migrations/0021_highlight_editor_only.sql
  - supabase/migrations/0020_article_highlight.sql
  - supabase/migrations/0004_editor_policies.sql
  - supabase/migrations/0003_profiles_and_authorship.sql
---

## Given
Migration `0021_highlight_editor_only.sql` is applied: a BEFORE UPDATE trigger on
`public.articles` (`articles_highlight_editor_only`) raises SQLSTATE 23514
("only an editor may change is_highlight") whenever an *authenticated* caller who
is NOT an editor tries to CHANGE `is_highlight`. Two users are provisioned out of
band (documented preconditions, never a minted session): the seed contributor
(`profiles.roles` contains `contributor`) and the seed admin (role `editor`).

## When
This is an OUT-OF-BAND REST PROBE, not a page test. It drives the REAL Supabase
auth HTTP flow via `signInWithPassword` (never a forged JWT / fake cookie), then
exercises PostgREST directly with each user's real-role JWT — exactly the surface
a malicious contributor would reach with their own publishable-key session.

## Then
  1. CONTRIBUTOR is BLOCKED: they may INSERT their own draft (0003 policy) and it
     comes back `is_highlight = false`, but an UPDATE flipping `is_highlight` to
     true is REJECTED by the trigger — the row's flag stays false (confirmed with
     a service-role re-read).
  2. EDITOR is ALLOWED: the same row flipped to `is_highlight = true` by the seed
     editor SUCCEEDS (no false-positive lockout of the legitimate curation path).

Cleanup: the throwaway row is DELETED via a service-role client in afterAll
(contributors have no DELETE policy), leaving the DB exactly as found.
*/

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// This spec does NOT import any `@/lib/...` module: `lib/supabase/admin.ts` and
// friends are `server-only`-fenced and THROW under the plain-Node Playwright
// worker. We construct supabase-js clients directly here. (Node >= 22 provides a
// global `WebSocket`, so supabase-js's eager RealtimeClient construction needs no
// `ws` polyfill in this runner.)

// ── env (loaded from gitignored .env.local by playwright.config.ts loadEnvLocal) ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.SUPABASE_KEY; // sb_secret_… — RLS-bypassing, cleanup only.
const CONTRIBUTOR_EMAIL = process.env.SEED_CONTRIBUTOR_EMAIL;
const CONTRIBUTOR_PASSWORD = process.env.SEED_CONTRIBUTOR_PASSWORD;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

// This is a SECURITY regression — it must actually run, never silently skip. If a
// precondition is missing, fail loudly naming exactly what to set (mirrors
// init-e2e-003a's requireCreds).
function requireEnv(): {
  url: string;
  anonKey: string;
  serviceKey: string;
  contributorEmail: string;
  contributorPassword: string;
  adminEmail: string;
  adminPassword: string;
} {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!SERVICE_KEY) missing.push("SUPABASE_KEY (service-role sb_secret_…, cleanup)");
  if (!CONTRIBUTOR_EMAIL) missing.push("SEED_CONTRIBUTOR_EMAIL");
  if (!CONTRIBUTOR_PASSWORD) missing.push("SEED_CONTRIBUTOR_PASSWORD");
  if (!ADMIN_EMAIL) missing.push("SEED_ADMIN_EMAIL");
  if (!ADMIN_PASSWORD) missing.push("SEED_ADMIN_PASSWORD");
  if (missing.length > 0) {
    throw new Error(
      `highlight-editor-only security regression cannot run — set these in gitignored .env.local: ${missing.join(", ")}. ` +
        `Provision users with \`npm run seed:contributor\` / \`npm run seed:admin\` (seed admin's role is \`editor\`).`,
    );
  }
  return {
    url: SUPABASE_URL!,
    anonKey: ANON_KEY!,
    serviceKey: SERVICE_KEY!,
    contributorEmail: CONTRIBUTOR_EMAIL!,
    contributorPassword: CONTRIBUTOR_PASSWORD!,
    adminEmail: ADMIN_EMAIL!,
    adminPassword: ADMIN_PASSWORD!,
  };
}

// A fresh anon (publishable-key) client — the browser-equivalent surface. Each
// caller gets its own so the contributor and editor sessions never bleed.
function anonClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Unique, clearly-marked throwaways so a crashed run is easy to spot / sweep.
// All rows created by this spec share the `zz-regression-highlight-` slug prefix
// so afterAll can sweep every one via a single service-role LIKE delete.
const SLUG_PREFIX = "zz-regression-highlight-";
const STAMP = Date.now();
const SLUG = `${SLUG_PREFIX}${STAMP}`;
const TITLE = `zz-regression-highlight ${STAMP}`;
// A second slug for the INSERT-with-is_highlight=true attempt (which must be
// rejected outright, so it should never actually create a row).
const SLUG_INSERT_TRUE = `${SLUG_PREFIX}${STAMP}-insert-true`;

// Shared across the single test + afterAll cleanup.
let draftId: string | null = null;

test.describe("highlight-editor-only — the 0021 trigger gates is_highlight to editors (out-of-band REST probe)", () => {
  // Pure supabase-js probe: no viewport dependence and it mutates one shared DB
  // row, so run ONCE (desktop project only), mirroring init-e2e-003a's gating.
  test.beforeEach(({}, testInfo) =>
    test.skip(
      testInfo.project.name !== "desktop",
      "out-of-band REST probe, no viewport dependence — run once against the shared DB",
    ),
  );

  test.afterAll(async () => {
    // CRITICAL cleanup: contributors have NO DELETE policy, so throwaway rows can
    // only be removed by the RLS-bypassing service-role client. Sweep EVERY row
    // this spec's slug prefix could have created (the rejected INSERT-true attempt
    // should have left nothing, but delete-by-prefix is the safe superset), then
    // assert the DB is left exactly as found.
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    const svc = serviceClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await svc
      .from("articles")
      .delete()
      .like("slug", `${SLUG_PREFIX}%`);
    expect(error, "cleanup delete of zz-regression-highlight-% rows must succeed").toBeNull();

    // Confirm the sweep left nothing behind — DB clean.
    const { data: remaining, error: readErr } = await svc
      .from("articles")
      .select("id")
      .like("slug", `${SLUG_PREFIX}%`);
    expect(readErr, "post-cleanup verification read must succeed").toBeNull();
    expect(
      remaining ?? [],
      "no zz-regression-highlight-% rows may remain — DB left exactly as found",
    ).toHaveLength(0);
  });

  test("a contributor is BLOCKED from flipping is_highlight; an editor is ALLOWED", async () => {
    const env = requireEnv();

    // ── 1. CONTRIBUTOR is BLOCKED ────────────────────────────────────────────
    const contributor = anonClient(env.url, env.anonKey);
    const { data: cSignIn, error: cSignInErr } =
      await contributor.auth.signInWithPassword({
        email: env.contributorEmail,
        password: env.contributorPassword,
      });
    expect(cSignInErr, "contributor sign-in must succeed").toBeNull();
    const contributorUid = cSignIn.user?.id;
    expect(contributorUid, "contributor JWT must carry a uid").toBeTruthy();

    // Insert an OWN draft via the contributor's session. The 0003 INSERT policy
    // allows author_id = auth.uid() + status draft + source human. title/slug/
    // author_name/category are NOT NULL; is_highlight defaults false (0020).
    const { data: inserted, error: insertErr } = await contributor
      .from("articles")
      .insert({
        title: TITLE,
        slug: SLUG,
        author_name: "zz regression",
        category: "regression",
        author_id: contributorUid,
        // status defaults 'draft', source defaults 'human' — the 0003 policy path.
      })
      .select()
      .single();
    expect(insertErr, "contributor may create their own draft (0003 INSERT policy)").toBeNull();
    expect(inserted, "insert must return the created row").not.toBeNull();
    draftId = inserted!.id as string;
    expect(draftId, "the throwaway draft must have an id").toBeTruthy();
    expect(
      inserted!.is_highlight,
      "a freshly created draft comes back with is_highlight = false (0020 default)",
    ).toBe(false);

    // ── 1b. CONTRIBUTOR INSERT with is_highlight=true is BLOCKED ─────────────
    // The 0021 trigger is BEFORE INSERT OR UPDATE: `tg_op='INSERT' and new.is_highlight`
    // rejects a non-editor creating a pre-highlighted row (the same carousel gap
    // through a different door). A default/false insert stays allowed (proven in 1
    // above); only TRUE-at-insert is guarded.
    const svcForInsertCheck = serviceClient(env.url, env.serviceKey);
    const { data: badInsert, error: insertTrueErr } = await contributor
      .from("articles")
      .insert({
        title: `${TITLE}-insert-true`,
        slug: SLUG_INSERT_TRUE,
        author_name: "zz regression",
        category: "regression",
        author_id: contributorUid,
        is_highlight: true, // the forbidden move: pre-highlight at creation.
      })
      .select();
    expect(
      insertTrueErr,
      "a contributor INSERTing is_highlight=true must be REJECTED by the 0021 trigger",
    ).not.toBeNull();
    expect(
      insertTrueErr?.message?.toLowerCase() ?? "",
      "the rejection must be the is_highlight editor-only trigger (message mentions editor)",
    ).toContain("editor");
    if (insertTrueErr?.code) {
      expect(
        insertTrueErr.code,
        "the rejection maps to PG check_violation (23514)",
      ).toBe("23514");
    }
    expect(
      badInsert ?? [],
      "a rejected insert returns no created row",
    ).toHaveLength(0);

    // Belt-and-suspenders: authoritative service-role read — NO row with that slug
    // exists, i.e. the pre-highlighted insert did not slip through.
    const { data: insertProbe, error: insertProbeErr } = await svcForInsertCheck
      .from("articles")
      .select("id")
      .eq("slug", SLUG_INSERT_TRUE);
    expect(insertProbeErr, "service-role probe read must succeed").toBeNull();
    expect(
      insertProbe ?? [],
      "no is_highlight=true row was created by the contributor — the insert was blocked, not merely errored",
    ).toHaveLength(0);

    // Attempt to flip the editor-only curation flag as the contributor. The 0021
    // BEFORE UPDATE trigger must REJECT this (SQLSTATE 23514). PostgREST surfaces
    // the exception as a non-null error; the row must NOT change.
    const { data: badUpdate, error: updateErr } = await contributor
      .from("articles")
      .update({ is_highlight: true })
      .eq("id", draftId)
      .select();

    if (updateErr) {
      // Expected path: the trigger raised and PostgREST forwarded it.
      expect(
        updateErr.message?.toLowerCase() ?? "",
        "the rejection must be the is_highlight editor-only trigger (message mentions editor)",
      ).toContain("editor");
      // errcode 23514 = check_violation. supabase-js maps the PG code to error.code.
      if (updateErr.code) {
        expect(
          updateErr.code,
          "the rejection maps to PG check_violation (23514)",
        ).toBe("23514");
      }
    } else {
      // Belt-and-suspenders: even if PostgREST returned no error object, the
      // trigger must have prevented any row from actually changing.
      expect(
        badUpdate ?? [],
        "with no surfaced error, the blocked update must have touched ZERO rows",
      ).toHaveLength(0);
    }

    // Re-read as the contributor (own-row SELECT policy 0003): flag still false.
    const { data: reread } = await contributor
      .from("articles")
      .select("is_highlight")
      .eq("id", draftId)
      .single();
    expect(
      reread?.is_highlight,
      "after the blocked update the contributor's own read shows is_highlight still false",
    ).toBe(false);

    // Belt-and-suspenders: authoritative service-role re-read confirms the DB row
    // was never mutated (independent of any RLS-narrowed view).
    const svc = serviceClient(env.url, env.serviceKey);
    const { data: svcRead, error: svcReadErr } = await svc
      .from("articles")
      .select("is_highlight")
      .eq("id", draftId)
      .single();
    expect(svcReadErr, "service-role re-read must succeed").toBeNull();
    expect(
      svcRead?.is_highlight,
      "authoritative service-role read: is_highlight MUST remain false after the contributor's blocked update",
    ).toBe(false);

    // ── 2. EDITOR is ALLOWED ─────────────────────────────────────────────────
    // A fresh anon client signed in as the seed admin (role: editor). The 0004
    // articles_editor_update policy lets an editor UPDATE any row, and the 0021
    // trigger permits the change because has_role(editor) is true.
    const editor = anonClient(env.url, env.anonKey);
    const { data: eSignIn, error: eSignInErr } =
      await editor.auth.signInWithPassword({
        email: env.adminEmail,
        password: env.adminPassword,
      });
    expect(eSignInErr, "editor (seed admin) sign-in must succeed").toBeNull();
    expect(eSignIn.user?.id, "editor JWT must carry a uid").toBeTruthy();

    const { data: goodUpdate, error: editorUpdateErr } = await editor
      .from("articles")
      .update({ is_highlight: true })
      .eq("id", draftId)
      .select()
      .single();
    expect(
      editorUpdateErr,
      "the editor path must NOT be locked out — the trigger permits an editor to change is_highlight",
    ).toBeNull();
    expect(
      goodUpdate?.is_highlight,
      "after the editor's update the row now has is_highlight = true",
    ).toBe(true);

    // Authoritative confirmation of the editor-allowed write.
    const { data: svcFinal } = await svc
      .from("articles")
      .select("is_highlight")
      .eq("id", draftId)
      .single();
    expect(
      svcFinal?.is_highlight,
      "authoritative service-role read: is_highlight is true after the editor's allowed update",
    ).toBe(true);
  });
});
