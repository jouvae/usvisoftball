# slice-07 — contributor cannot publish (permission-denied)

**Scenario `init-e2e-004` (sole scope):**
> Given a signed-in `contributor` viewing their own `in_review` article, When they attempt to
> publish it (via UI and via a direct publish request), Then no Publish control is available in
> the UI and the direct request is rejected as permission-denied; the article's status is unchanged.

**Verdict: VERIFICATION slice. The barrier is complete at all three layers as-is. No implementation
needed.** The value of this slice is the empirical + e2e assertion contract that pins the barrier so
a later change cannot silently open it.

---

## 1. Enforcement confirmation (three layers, cited to real code)

### Layer 1 — RLS (DB): a contributor genuinely cannot reach `published`
- `supabase/migrations/0003_profiles_and_authorship.sql:162-175` — `articles_contributor_update`.
  `USING` gates which rows are updatable (`author_id = auth.uid()` AND `has_role(...,'contributor')`
  AND `status in ('draft','in_review')`); the **`WITH CHECK` pins the RESULT row to
  `status in ('draft','in_review')`** (lines 171-175). A contributor UPDATE targeting
  `status='published'` fails this `WITH CHECK`.
- `supabase/migrations/0004_editor_policies.sql:48-53` — `articles_editor_update` is the only policy
  whose `WITH CHECK` permits any status (published/unpublished), and it is gated
  `has_role(auth.uid(),'editor')` (line 53). A contributor lacks that role.
- Permissive policies are OR-combined, so a contributor targeting `published` passes **neither**
  UPDATE `WITH CHECK` — own requires draft/in_review, editor requires a role they lack. The 0001
  table CHECK (`published => published_at not null`) is an additional backstop for every writer.
- **Already proven empirically** by slice-05 probe 5 / slice-06 probe 5 (re-run to prove 0004 did
  not weaken it): contributor session `in_review → published` PATCH → `42501` (PostgREST 403),
  status unchanged (`slice-06-editor-publish.md:142-143`, `:496-497`). **Verdict: holds.**

### Layer 2 — Server Action + route gate: contributor is redirected, action rejects non-editor
- `app/admin/(protected)/review/[id]/page.tsx:23` — `await requireRole("editor")` at the top of the
  **only** route that renders a Publish control. A contributor hitting `/admin/review/[id]` is
  redirected.
- `lib/roles.ts:75-92` — `requireRole` calls `requireUser()` (redirects if unauthenticated), reads
  the caller's own profile via the RLS session client, and returns only if the profile is `active`
  and `roles.includes('editor')`; otherwise `return redirect("/admin")` (line 91). A signed-in
  contributor is authenticated, so `requireUser` passes, then the role check fails →
  **redirect to `/admin`**.
- `app/admin/(protected)/review/[id]/actions.ts:26` — `publishArticle` independently calls
  `await requireRole("editor")` before touching the DB (it is a standalone POST endpoint, not
  protected only by the layout), and the publish itself runs through the session client so RLS
  (layer 1) re-enforces. **Verdict: holds.**

### Layer 3 — Contributor UI: no Publish control, and no dead control on the `in_review` case
- `app/admin/(protected)/articles/[id]/page.tsx` (the contributor's own-article editor) renders a
  read-only view — status badge (`draft-status-badge`), source, title, category, hero, body — and
  **no publish control** (no `publish-article`, no link to `/admin/review/[id]`).
- **The `in_review` case specifically:** the only mutating control, `SubmitForReviewButton`, is
  gated `article.status === "draft"` (line 63). For an `in_review` article the button **does not
  render**. So there is **no dead "Submit for review" no-op** to hide — the potential coherence gap
  the sketch was asked to check **does not exist**. The contributor's in_review view is already a
  clean read-only page with the "In review" status badge. **Verdict: holds; no gap.**
- The contributor queue (`app/admin/(protected)/queue/page.tsx:48-58`) links a contributor's rows to
  `/admin/articles/[id]` (their own editor), never `/admin/review/[id]` — so there is no in-app path
  to the publish surface at all.

**Barrier is complete as-is. No files to change.**

## 2. Minimal implementation

**None — verification slice.** The `in_review` contributor view already renders no Publish control
and no dead Submit-for-review control (it is gated to `draft` only), and it shows a clear "In review"
status via `draft-status-badge`. Nothing to build. Do not invent work.

## 3. `data-testid` / assertion contract (all testids already exist)

**(a) Contributor on their own `in_review` article view** (`/admin/articles/[id]`):
- `expect(page.getByTestId("draft-editor")).toBeVisible()`
- `expect(page.getByTestId("draft-status-badge")).toHaveText(/in.?review/i)` — visible status is `in_review`.
- **Absence of any publish control:** `expect(page.getByTestId("publish-article")).toHaveCount(0)`.
- **No link to the review surface:** `expect(page.locator('a[href^="/admin/review/"]')).toHaveCount(0)`.
- (Bonus, optional) `expect(page.getByTestId("submit-for-review")).toHaveCount(0)` — confirms the
  own-view exposes no status-mutating control at all on an `in_review` row. Not required by the
  scenario (it only demands *no Publish* control), but cheap and documents the "no dead control" fact.

**(b) Contributor navigating directly to `/admin/review/[id]` → redirected:**
- `await page.goto('/admin/review/' + id)`
- `expect(page).toHaveURL(/\/admin$/)` — landed on the dashboard, NOT the review view (`requireRole`
  redirect target, `roles.ts:91`).
- `expect(page.getByTestId("review-view")).toHaveCount(0)` — the review desk did not render.

**(c) Status unchanged afterward:**
- Re-open `/admin/articles/[id]` and `expect(page.getByTestId("draft-status-badge")).toHaveText(/in.?review/i)`.
- **Backup (out-of-band):** an admin-client read of the row's `status` column == `'in_review'`
  (teardown-path client, never the assertion path).

**No new testids.** Reuses `draft-editor`, `draft-status-badge` (articles/[id]/page.tsx),
`review-view` (review/[id]/page.tsx), `publish-article` (publish-article-form).

## 4. Data setup

The e2e needs a **contributor-owned `in_review`** article. **Create it through the real contributor
flow** (mirrors `init-e2e-003`), not a seed — this yields a genuinely `author_id = contributor` row
without looking up the contributor's auth id, and exercises the real transition:
1. Real Supabase sign-in as the seed contributor (`SEED_CONTRIBUTOR_EMAIL` / `_PASSWORD` from
   gitignored `.env.local`; `signIn` helper identical to `init-e2e-003:83-93`).
2. `admin-new-article-link` → fill a **marker-prefixed** unique title (`[e2e-004] contributor cannot publish {uuid}`) → `draft-save` → lands on `/admin/articles/[id]`.
3. `submit-for-review` → `draft-status-badge` flips to `/in.?review/i`. Capture the `[id]` from the URL.

**Teardown:** targeted `deleteMarkedArticles()` via the BYPASSRLS admin client, `LIKE '<prefix>%'`
(never `deleteAllArticles()`), in `afterAll` — keeps `/news` at exactly **2 published**
(`init-web-001` `toHaveCount(2)`), `workers:1`, `fullyParallel:false`, desktop-only gate
(`beforeEach` skip on non-desktop) — the slice-05/06 shared-DB discipline. This slice writes only a
non-published row and deletes it, so the anon feed count is never perturbed.

## 5. Verification plan

- **Real contributor sign-in — no forged session, no raw session mint** (drive the Supabase login
  UI, `init-e2e-003` helper). Real Supabase throughout; never mock. Auto-retrying `expect` only —
  never a bare `count()` (the recorded false-defect gotcha).
- **UI half of the scenario** — assertions (a), (b), (c) above prove: no Publish control on the
  contributor's own `in_review` view; direct navigation to `/admin/review/[id]` is redirected to
  `/admin`; status is still `in_review`.
- **"Direct publish request rejected" half** — **reuse the out-of-band probe 5 / E5**: a contributor
  JWT `PATCH` of own `in_review → published` → `42501` (403), status unchanged. This is the
  documented out-of-band probe run the slice-05a/06 way (there is deliberately **no** in-app path for
  a contributor to issue a publish, so the "direct request" can only be an out-of-band PATCH with the
  contributor's token). Record its result in `status.md`; it is the empirical proof that the RLS
  barrier — not just the UI — rejects the publish. Combined with the redirect assertion (b), both the
  "via UI" and "via a direct publish request" clauses of the scenario are covered.

## 6. Prototype debt / notes

- The out-of-band E5 probe is a manual/documented step (like every prior slice's §1.4 probes), not a
  Playwright test. If a repeatable programmatic contributor-JWT probe is wanted, that's a separate,
  explicitly-scoped harness decision — do not invent it here.
- The contributor `in_review` view is intentionally read-only (no re-edit / no withdraw-from-review
  control). Withdraw/re-edit-after-submit is **out of scope** and not implied by this scenario;
  leave as forward work if a persona need arises.
- Disabled-account and missing-profile variants of `requireRole` are already covered by
  `roles.ts:82-91` and are out of scope for this scenario (contributor is `active`).
</content>
</invoke>
