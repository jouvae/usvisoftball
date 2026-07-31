# Status: softball/init

**Active tier:** T3   **Phase:** Actualize (Phase 3) — **MERGED to `main`; pre-deploy pending**   **Updated:** 2026-07-31

> ▶ **SESSION HANDOFF (2026-07-31)** — *this block + the Resume recipe are the single entry point
> for a fresh session with no memory of the prior conversation.*
>
> **State:** **Actualize (Phase 3) STARTED (human kicked it off 2026-07-31).** Conceptualize is complete
> — all 9 of 9 scenarios `prototyped`, each human-confirmed + independently verified. Migrations
> `0001`–`0005` applied + replayable; suite **86/22/0**, `tsc`/`eslint` clean; branch `init`, **nothing
> committed**. **Tier T3** (auth + money + PII) → full apparatus: promotion-gate debt audit + entity
> ratification → backfill/confirm tests → **dcon + red-team-code + red-team-interactive** (all blocking;
> auth/money/PII always block) → CI → pre-merge + pre-deploy checkpoints → ship.
>
> **Actualize Step 1 — promotion gate: audit DONE, resolution IN PROGRESS.** Auditor gave a clean bill on
> the security spine (no TODOs/raw-fetch/`dangerouslySetInnerHTML`/hardcoded-secrets; full e2e coverage;
> no auth/money/PII code defect). Debt: **8 resolve-now** (2 ship-blocking: S1 build-time font fetch, S2
> Fly deploy config; + R1 error boundaries, R2 `published_at` churn, R3 entities ratification, R4 hero
> validation, R5 magic-string, R6 README), **15 deferred**, **2 blocked-on-Federation** (B1 owned/licensed
> AI source list, B2 real-Claude go).
>
> **Human decision (2026-07-31): the AI draft panel is GATED OFF for the initial ship** via
> `NEXT_PUBLIC_AI_DRAFT_ENABLED` (on in dev/test so `init-e2e-007` stays green; unset/false in prod →
> panel `notFound()`s + nav hidden). **`init-e2e-007` → deferred-behind-flag; 8 of 9 scenarios ship this
> pass.** The AI panel lights up when the Federation delivers the source list (B1) + a real-model go (B2).
>
> **Step 1 promotion gate: RESOLVED + independently verified** — all 8 resolve-now done (S1 fonts
> self-hosted → `next build` offline OK; S2 Fly config; R1 error boundaries; R2 `published_at` guard; R3
> entities ratified v0.2.0; R4 hero validation; R5 constant; R6 README), AI panel gated off in prod via
> `NEXT_PUBLIC_AI_DRAFT_ENABLED`. Suite **86/22/0**, `tsc`/`eslint` clean. Tests are already backfilled
> (every scenario has an e2e from Conceptualize) — Step 2/3 are effectively satisfied; mark
> `tests-backfilled` on gate pass.
>
> **Step 4 blocking gates (T3): ✅ ALL THREE PASS — no auth/money/PII blocking findings.**
> - **dcon PASS** (5/5 data-writing scenarios — real rows read out-of-band match every `Then`; invariants
>   hold: contributor-publish denied, anon published-only, no AI row without provenance).
> - **red-team-code PASS-with-notes** (0 blocking; confirmed service-key isolation, `getUser()` boundary,
>   per-action authz, no self-escalation, flag-gated AI actions, no injection/leak).
> - **red-team-interactive PASS** (0 blocking; live-auth probes — unauth blocked, forged cookie rejected,
>   RLS is the real boundary at the REST API, no draft/PII/secret leak).
> - **Fix applied:** the one MEDIUM PII (latent) — dropped `user.email` from the `author_name` byline
>   fallback (both create paths) → `profile.name ?? user.id`. Re-verified: suite 86/22/0, `tsc`/`eslint`
>   clean, DB = 5 seed fixtures. Deferred/advisory (non-blocking): D1 editor col-pin trigger, D2 legacy
>   JWT, cookie `Secure`-in-prod (deploy checklist), AI-provenance allow-list (B1/Federation), WAF-500 nit.
>
> All 9 scenarios: `prototyped` + `tests-backfilled` (e2e from Conceptualize) + `dcon-passed` +
> `red-team-passed`. CI: repo `.github/workflows/ci.yml` is partial — **gates enforced locally here**
> (the approved model); CI wiring is a follow-up.
>
> **✅ MERGED to `main` (2026-07-31): `cb165f9`, pushed to `origin`.** All gates passed; pre-merge
> checkpoint cleared (human: commit + merge). All 9 scenarios **shipped to `main`** (`init-e2e-007` behind
> the `NEXT_PUBLIC_AI_DRAFT_ENABLED` flag, off in prod).
>
> **▶ NEXT: pre-deploy checkpoint (HUMAN) — the Fly production rollout.** Deploy artifacts are ready
> (`Dockerfile`, `fly.toml`, `output:'standalone'`, self-hosted fonts → offline `next build`). Rollout
> needs human infra setup, NOT code: (1) create the Fly app (`fly launch`/`fly apps create`; set the app
> name in `fly.toml`); (2) set the Supabase values as **Fly secrets** (`fly secrets set NEXT_PUBLIC_SUPABASE_URL=…
> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_KEY=…`; leave `NEXT_PUBLIC_AI_DRAFT_ENABLED` unset →
> AI panel stays off); (3) decide the **prod Supabase target** (the current project is the dev one — a
> separate prod project is advisable) and **apply migrations `0001`–`0005`** there; (4) `fly deploy`;
> (5) confirm the auth cookie is `Secure` over HTTPS (red-team LOW). Then mark scenarios `deployed`.
>
> **`/actualize` deferred debt (follow-ups, tracked):** real media upload (MediaAsset); the AI drafter's
> real-Claude swap-in + the Federation's owned/licensed source list (B1/B2); retire the legacy
> service-role JWT (D2); editor UPDATE `source`/`author_id` column-pin trigger (D1); CI wiring;
> rich-text renderer; editorial audit trail; role hierarchy. See slice-09 block + §Open loops.
>
> | Slice | Scenario | State |
> |---|---|---|
> | 01 | `init-web-009` — foundation shell + nav | **`prototyped`** ✅ |
> | 01b | *(reskin of 01, no new scenario)* — brand system | **ratified** ✅ |
> | 02 | `init-web-001` — public news feed | **`prototyped`** ✅ |
> | 03 | `init-web-002` — article page + draft 404 | **`prototyped`** ✅ (human-confirmed 2026-07-15) |
> | 04 | `init-e2e-008` — unauthenticated cannot reach `/admin` | **`prototyped`** ✅ (human-confirmed 2026-07-17) |
> | 05a | `init-e2e-003` (Given) — role foundation | **`prototyped`** ✅ (human "go ahead" 2026-07-30) |
> | 05b | `init-e2e-003` (When/Then) — draft create+submit | **`prototyped`** ✅ (human "carry on" 2026-07-30) |
> | 06 | `init-e2e-005` — editor reviews + publishes | **`prototyped`** ✅ (human "continue" 2026-07-31) |
> | 07 | `init-e2e-004` — contributor cannot publish | **`prototyped`** ✅ (human "continue" 2026-07-31) |
> | 08 | `init-e2e-006` — editor unpublishes a live article | **`prototyped`** ✅ (human "continue" 2026-07-31) |
> | 09 | `init-e2e-007` — AI draft, never autopublish | **`prototyped`** ✅ (human "looks good" 2026-07-31) |
>
> ### 🏁 CONCEPTUALIZE COMPLETE — all 9 of 9 first-slice scenarios `prototyped` (2026-07-31)
> Every scenario is human-confirmed in the browser and independently verified (observed, not inferred).
> The feature is at the **post-prototype / pre-build checkpoint** → the decision to enter **`/actualize`**
> (promotion/deliver gate: prototype-debt audit, backfilled tests from the BDD scenarios, dcon + both
> red-team levels, CI). **Nothing is committed; nothing is shippable until it passes `/actualize`.**
>
> > **05a is CONFIRMED (done).** RBAC foundation: migration `0003` (`public.profiles` `roles text[]`, a
> > `SECURITY DEFINER has_role()`, an `auth.users` trigger, `articles.author_id`, contributor RLS), a
> > seeded contributor + admin-as-editor, and a `SECURITY DEFINER`/BYPASSRLS chain proven by **RLS probes
> > 8/8** (exit gate, publish barrier, no-escalation). *(History: the Supabase project's subdomain stopped
> > resolving mid-session — paused/deleted — briefly halting the build; the human restored it. On record.)*
> >
> > ### ⏳ Slice 05b — draft create+submit (`init-e2e-003` **When/Then**) — BUILT + INDEPENDENTLY VERIFIED, *not human-confirmed*
> > Completes `init-e2e-003`. A **contributor** signs in → **New article** (`/admin/articles/new`) form
> > (title/body/category/hero/hero-alt) → **Save** creates a `draft` (`source=human`, `author_id`) via
> > the **session client** (RLS-enforced) → lands on the `[id]` editor (status chip + Source) → **Submit
> > for review** transitions `draft→in_review` → it appears in the **editorial queue** and is **absent
> > from `/news`**. Server Actions each `requireRole('contributor')` (a Server Action is its own entry
> > point); `createArticle` is now client-injectable (seed=admin client, contributor=session client, one
> > typed write path); `redirect` outside try/catch; `submitForReview` catches `PGRST116`.
> >
> > **Verified (observed, not inferred):** full suite **82/18/0** on my own clean server; `init-e2e-003`
> > passes; `tsc`+`eslint` clean. Real-browser **9/9** driving the whole flow via the real UI (session
> > client → RLS): create → editor shows `draft`/`human` → submit → `in_review` → queue lists it → absent
> > from `/news`. **Out-of-band DB read confirms the RIGHT data** (dcon-style): the row is
> > `status=in_review`, `source=human`, `author_name='Test Contributor'` (byline chain), `author_id` set,
> > `cover_image_alt` set. Probe/verify rows cleaned up (articles back to the seeded 5). Screenshots
> > captured (editor "IN REVIEW" navy-on-gold chip; editorial queue).
> >
> > **Deviations (honestly flagged, both sound):** (1) the **New article / Queue nav is gated to
> > `contributor` only, not editor** — an editor's editorial nav + the *editor-wide* queue are **slice 07**;
> > gating to contributor keeps the 05a "admin dashboard is non-navigating" assertion green. **When slice
> > 07 lands editor nav, that 05a assertion must be retired together with it.** (2) The optional in-place
> > editor **Save** (edit a draft's fields) was omitted — the scenario path is create→submit; `saveDraftFields`
> > exists in `lib/articles.ts` for slice 07.
> >
> > **✅ 05b CONFIRMED (human "carry on", 2026-07-30) → `init-e2e-003` `prototyped` (5 of 9 done).**
> >
> > ### ⏳ Slice 06 — editor reviews + publishes (`init-e2e-005`) — BUILT + INDEPENDENTLY VERIFIED, *not human-confirmed*
> > Closes the editorial loop: an **editor** (the seeded admin, `roles=['editor']`) opens an `in_review`
> > article, edits the body, and **publishes** it → `status=published` + `published_at` → it goes **live on
> > `/news`** and its article page. Migration `0004_editor_policies.sql`: two additive permissive
> > `to authenticated` policies gated by `has_role(...,'editor')` — `articles_editor_read_all` (SELECT any)
> > + `articles_editor_update` (UPDATE any). Editor UI: role-aware dashboard nav (**editor now gets the
> > Editorial-queue link** — this **RESOLVES the 05b deviation**; the 05a `init-e2e-003a` "non-navigating"
> > assertion was **retired** by the tester), a role-aware `/admin/queue` (editor sees ALL `in_review`), a
> > dedicated `/admin/review/[id]` review/edit/publish view, and a `published` status chip (white-on-navy
> > 12.74:1, **not** gold). Publish runs through the **session client** (RLS `articles_editor_update`).
> >
> > **The anti-tautology core, verified empirically (out-of-band, real JWTs):** **6/6 RLS probes** — the
> > editor CAN publish an unauthored `in_review` row (→ anon then sees it); **a contributor STILL CANNOT
> > publish** (403, status unchanged — `0004` did NOT weaken the slice-05 barrier, so `init-e2e-004`/slice
> > 07 stays a *genuine* negative); publishing without `published_at` is rejected by the 0001 CHECK; anon
> > still cannot read `in_review`; and **provenance is untouched** by publish (`source`/`author_id`
> > unchanged — the app patches only `body`/`status`/`published_at`; the editor UPDATE policy *permits*
> > changing them but the app doesn't — recorded as debt).
> >
> > **Verified (observed, not inferred):** `0004` applied + replayable; catalog check confirms both editor
> > policies + anon-still-published-only + contributor policies intact. Full suite **83/19/0** on my own
> > clean server; `init-e2e-005` + the retired `init-e2e-003a` test 3 pass; `tsc`+`eslint` clean.
> > Real-browser **9/9** driving the full editor publish flow via the real UI: editor → queue (sees the
> > unauthored row) → review → edit body → publish → **Published** → article live on `/news` with the
> > **edited body** on its page. Out-of-band read confirms `status=published`, `published_at` not null,
> > edited body persisted. Throwaway/probe rows cleaned up (**`/news` back to exactly 2**, DB at 5).
> > Screenshots captured (review PUBLISHED chip; the live article page).
> >
> > **Deviations (both recorded as debt):** editor UPDATE `WITH CHECK` pins only the editor role — it does
> > NOT pin `source`/`author_id` unchanged (an RLS `WITH CHECK` can't see the OLD row; pinning needs a
> > trigger → deferred to `/actualize`; the app path never alters them). `publishArticle` sets
> > `published_at=now()` unconditionally (not idempotent on re-publish).
> >
> > **✅ 06 CONFIRMED (human "continue", 2026-07-31) → `init-e2e-005` `prototyped` (6 of 9).** Demo
> > throwaway reverted; `/news` back to 2 published.
> >
> > ### ⏳ Slice 07 — contributor cannot publish (`init-e2e-004`) — BUILT + VERIFIED (VERIFICATION SLICE, *zero new code*), *not human-confirmed*
> > The anti-tautology payoff of building editor-publish (06) first: the barrier was **already complete at
> > all three layers**, confirmed by the architect against real code and by e2e + probe: (a) **RLS** —
> > contributor UPDATE `WITH CHECK` pins `status in ('draft','in_review')` (`0003`), only the
> > editor-gated policy permits `published` (`0004`); (b) **route/action** —
> > `/admin/review/[id]` page + the publish action both `requireRole('editor')`, so a contributor is
> > redirected to `/admin`; (c) **UI** — the contributor `[id]` editor renders no Publish control, and its
> > Submit-for-review button is already gated to `status==='draft'` so it doesn't render on `in_review`
> > (no dead control). **Nothing needed building** — the architect confirmed and did not invent work.
> >
> > **Verified (observed, not inferred):** new `tests/e2e/init/init-e2e-004.spec.ts` **passed on the first
> > run** (barrier confirmed, no gap); full suite **84/20/0** on my own clean server; `tsc`/`eslint` clean.
> > Independent checks **6/6**: out-of-band **E5** (real contributor JWT, direct publish PATCH → **403**,
> > status unchanged — the "direct request rejected" clause), and real-browser — the contributor's own
> > `in_review` view has **no `publish-article` control** and **no `/admin/review/` link**, direct nav to
> > `/admin/review/[id]` **redirects to `/admin`** (`review-view` never renders), status stays `in_review`.
> > Marker rows cleaned up (`/news` at 2, DB at 5). Screenshot captured.
> >
> > **✅ 07 CONFIRMED (human "continue", 2026-07-31) → `init-e2e-004` `prototyped` (7 of 9).**
> >
> > ### ⏳ Slice 08 — editor unpublishes a live article (`init-e2e-006`) — BUILT + INDEPENDENTLY VERIFIED, *not human-confirmed*
> > An editor unpublishes a `published` article → `status=unpublished`; it **vanishes from `/news`**, its
> > slug returns a **real HTTP 404** (branded not-found), but it **remains in the editorial queue as
> > Unpublished for re-publish**. **NO migration** — the editor UPDATE-any policy (`0004`) already permits
> > `published→unpublished` (slice-06 probe 2), the `0001` status CHECK allows `unpublished`, and anon read
> > is published-only so an unpublished slug 404s exactly like a draft. Build (all under `app/admin/**` +
> > `lib/articles.ts` + `components/client/**`; nothing under `app/(public)/news/`): `unpublishArticle`
> > mutator + Server Action (session client, `requireRole('editor')`, revalidate `/news`+slug+queue, no
> > redirect); a **status-aware review view** (in_review→Publish, published→live link + **Unpublish**,
> > unpublished→**Re-publish** reusing `publishArticle`); a **broadened editorial queue**
> > (`listEditorialQueue` = in_review + published + unpublished; `listReviewQueue` removed); a new
> > `unpublish-article-form` island. `published_at` is **retained** on unpublish (historical record; the
> > `0001` CHECK only constrains the `published` state; the feed filters by status so it can't leak back).
> >
> > **Verified (observed, not inferred):** full suite **85 passed / 21 skipped / 0 failed** on my own
> > clean server; `init-e2e-006` passes; `tsc`+`eslint` clean. **Real-browser 8/8**
> > (real editor sign-in, no forged session): editor queue surfaces the published throwaway (badge
> > "Published") → review shows Published + live link + Unpublish → click Unpublish → **Unpublished**, live
> > link gone, **Re-publish** shown → `/news` card **absent** → slug returns **HTTP 404** + `article-not-found`
> > → queue still lists it as **Unpublished**. **Out-of-band:** row is `status=unpublished`, **`published_at`
> > retained** (2026-07-20 preserved), anon by-slug read → `[]`. Throwaway cleaned up (`/news` back to
> > exactly **2**). Screenshots: the muted UNPUBLISHED chip + Re-publish button; the branded 404 page.
> >
> > **✅ 08 CONFIRMED (human "continue", 2026-07-31) → `init-e2e-006` `prototyped` (8 of 9).** Demo deleted;
> > `/news` back to 2.
> >
> > ### ⏳ Slice 09 — AI draft, never auto-published (`init-e2e-007`) — BUILT + INDEPENDENTLY VERIFIED, *not human-confirmed* — THE LAST SCENARIO
> > A contributor/editor on the **AI draft panel** (`/admin/news/ai`) picks a source + prompt → **Generate**
> > (a **deterministic stub** drafter; real Claude is a one-function swap-in seam — human decision) → review
> > the draft **+ provenance** → **Accept** → an Article is created **`source=ai`, `status=draft`**, with
> > **`ai_provenance` `{source, model:'stub'}`** stored, entering the normal review workflow (Submit for
> > review → …); it shows in the editorial queue and is **NEVER on `/news`** (slug 404s). Migration `0005`:
> > `articles.ai_provenance jsonb` + CHECK (`source<>'ai' OR ai_provenance IS NOT NULL`) + a **separate**
> > INSERT policy `articles_ai_draft_insert` (`author_id=self AND status='draft' AND source='ai' AND
> > ai_provenance IS NOT NULL AND has_role(contributor|editor)`). The `status='draft'` pin **is** the
> > never-autopublish guarantee; the slice-05 `source='human'` contributor policy is untouched.
> >
> > **The safety property, proven empirically at the DB (out-of-band, real JWTs — 10/10 probes):** **P2/P2e
> > — NEITHER a contributor NOR an editor can insert an `(ai, published)` row** (rejected); `ai`+`in_review`
> > also rejected (only `draft`); `ai`+null-provenance rejected; foreign `author_id` rejected; anon rejected;
> > and the `human`/`draft` path is **unbroken**. This is the whole point of `init-e2e-007`, and it holds
> > independent of the UI.
> >
> > **Verified (observed, not inferred):** `0005` applied + replayable; catalog confirms the column, CHECK,
> > and the new INSERT policy (contributor `source='human'` pin intact). Full suite **86/22/0** on my own
> > clean server; `init-e2e-007` passes; `tsc`+`eslint` clean. **Real-browser 11/11** (real contributor
> > sign-in): panel → Generate → review shows draft + provenance (`stub`) → Accept → draft editor with
> > `source=ai` + provenance block → in the queue as `draft` → **absent from `/news`** + slug **404s**.
> > **dcon read:** row is `source=ai`, `status=draft`, `ai_provenance={source, model:'stub'}`, `published_at`
> > null. Marker rows cleaned up (contains-match — the marker sits mid-title; `/news` back to **2**).
> > Screenshot: the draft editor with the AI-provenance block.
> >
> > **Deviations (both sound):** a shared `lib/ai-sources.ts` (a `'use server'` module can't export the
> > source list); `ai_provenance.source` stores the human-readable label (the editor renders straight from
> > the row). **Debt:** the stub drafter is the real-Claude swap-in seam; the source list is a placeholder
> > (Federation owes the real owned/licensed list); an editor accepting an AI draft won't see it in the
> > editor queue (excludes `draft`) — the contributor path shows it.
> >
> > **✅ 09 CONFIRMED (human "looks good", 2026-07-31) → `init-e2e-007` `prototyped`. ALL 9 of 9 done.**
> > Conceptualize (Phase 2) is COMPLETE — see the 🏁 block in the table above. **NEXT = the human's
> > decision to enter `/actualize`.** The accumulated prototype debt (per slice + §Open loops below) is
> > `/actualize`'s input: real image upload (MediaAsset); the AI drafter's real-Claude swap-in + the
> > owned/licensed source list the Federation owes; retire the legacy `SUPABASE_SERVICE_ROLE_KEY` JWT;
> > editor UPDATE not pinning `source`/`author_id` (needs a trigger); `published_at` re-publish churn;
> > seed can't backfill added columns; `next/font` Oswald build-time fetch (offline CI/Fly); no role
> > hierarchy; no editorial audit trail; body still React-escaped (rich-text renderer TBD).
>
> **Suite: 86 passed / 22 skipped / 0 failed** (independently re-run from a clean `.next` on my own
> `:3001`; +1 desktop `init-e2e-007` AI-draft). `tsc --noEmit` clean. `eslint` clean (0 warnings).
> Branch `init`. **Nothing is committed** — the whole tree is still untracked/uncommitted.
> Migrations `0001`–`0005` applied + replayable.
>
> ### ⏳ Slice 04 — admin auth gate (`init-e2e-008`) — BUILT + INDEPENDENTLY VERIFIED, *not yet human-confirmed*
> **Scenario:** an unauthenticated visitor navigating to any `/admin` route is **redirected to
> `/admin/login`** and **no admin data is returned**. Human scope: **GATE + REAL LOGIN** — a working
> `/admin/login` against real Supabase Auth (**email + password**, `signInWithPassword`), verified
> **both** directions so the gate is proven non-tautological. RBAC/roles remain slices 05+.
>
> **What was built:** a **route-group refactor** — public routes moved under `app/(public)/` (its own
> Fragment layout owning `SiteHeader` + `<main data-testid="site-main">` + `SiteFooter`); slim root
> `app/layout.tsx` (keeps `h-full`/`min-h-full flex flex-col`/fonts/`globals.css`/metadata, no chrome);
> `app/admin/(protected)/` (guarded) + `app/admin/login/`. **`@supabase/ssr@^0.12.3` installed**; new
> cookie-session clients `lib/supabase/{server,proxy,browser}.ts` (all on the **anon/publishable** key).
>
> **The security spine, and why it is shaped this way:**
> - **Two layers, one boundary.** `proxy.ts` (matcher `/admin/:path*`) refreshes the session cookie and
>   307-redirects anon → `/admin/login` — **optimistic only, NOT the boundary**. The real boundary is a
>   server-side **`supabase.auth.getUser()`** guard (`lib/auth.ts` `requireUser()`) in
>   `app/admin/(protected)/layout.tsx`, run as the first `await` before any child/admin query renders.
> - **`getUser()`, never `getSession()`** — `getUser()` re-validates the JWT at the Supabase Auth server;
>   `getSession()` trusts an unverified cookie (per installed `@supabase/auth-js` docstrings). A
>   forged/expired cookie survives `getSession` but fails `getUser`.
> - **"No admin data" is concrete:** the guard redirects (bodyless 307/`redirect()`) before
>   `app/admin/(protected)/page.tsx` runs, so `admin-dashboard`/`admin-authenticated` never render for
>   anon. **Never add `loading.tsx`/Suspense above the guard** (streamed-200 trap — same as slice 03).
> - **Login `signIn` action:** `redirect('/admin')` is called **outside** any try/catch (it throws
>   `NEXT_REDIRECT`); errors return a **generic** "Invalid email or password." (no user-enumeration).
> - Admin user provisioned ONLY via **`supabase.auth.admin.createUser({ email, password, email_confirm:
>   true })`** (`lib/admin-user.ts` + `scripts/seed-admin.ts`, `npm run seed:admin`) — never a hand-built
>   `auth.users` row. Test creds in gitignored `.env.local` (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).
>
> **Deviation from the sketch (anticipated):** the **`ws` `WebSocket` polyfill was required on the proxy**
> (Node runtime, no global `WebSocket`) — same shim as `lib/supabase/admin.ts`. No new `data-testid`.
>
> **How it was verified (observed, not inferred):** full suite **78/14/0** on my own clean server;
> `tsc`/`eslint` clean; raw no-follow probes `/admin`, `/admin/queue`, `/admin/anything` → **307
> `/admin/login`**, `/admin/login` → 200 (no loop), anon body has **0** admin markers; then a real
> Chromium session drove the **real Supabase sign-in** (no forged session) **10/10** both directions —
> anon → login (markers absent, form visible), wrong password → generic error + stays on login, valid
> creds → lands on `/admin` with `admin-dashboard` + "Signed in as admin@usvisoftball.test", session
> persists on re-nav. Screenshots captured (anon login card; signed-in dashboard).
>
> **▶ NEXT: get the human to confirm slice 04 in the browser** (open `http://localhost:3001/admin` while
> signed out → must bounce to `/admin/login`; sign in with `admin@usvisoftball.test` / the
> `SEED_ADMIN_PASSWORD` → must land on the admin dashboard). On confirmation, mark `init-e2e-008`
> **`prototyped`** on the board below. **Then slice 05** = the contributor/editor workflow
> (`init-e2e-003/004/005`) — the first slices needing **roles/RBAC** (no app-level roles table exists
> yet; auth today is authentication-only, "authenticated ⟺ admin" holds only because there is no public
> signup).
>
> ### ⏳ Slice 03 — article page — BUILT + INDEPENDENTLY VERIFIED, *not yet human-confirmed*
> `/news/[slug]` renders the published article (category chip, `<h1>` headline, byline, deterministic
> date, hero, prose body, gallery). `draft` / `in_review` / `unpublished` / nonexistent slugs each
> return a **real HTTP 404** with a branded not-found page, and the draft's title appears in neither
> the served HTML nor the `<title>`. The card headline is now a `<Link>` to the article.
>
> **The security spine, and why it is shaped this way:**
> - `getPublishedArticleBySlug()` reads through the **publishable (RLS-enforced)** client and
>   **deliberately omits** a `.eq("status","published")` filter. With that filter present, a **broken
>   RLS policy would still 404 the draft** and the suite would pass green while RLS was defeated.
>   Without it, RLS is the sole visibility control and the 404 test is a *real* RLS assertion.
>   **Do not "fix" this asymmetry** — `listPublishedArticles` filters; this deliberately does not.
> - `.maybeSingle()` → zero rows becomes `null` → `notFound()`; a genuine DB/transport error **throws**.
>   So **a 404 can never hide an outage.**
> - **Never add `app/news/[slug]/loading.tsx`** (or any Suspense boundary above the awaited fetch).
>   `notFound()` yields **404 only for a non-streamed response**; a `loading.tsx` flushes the shell and
>   silently downgrades the security property to a **200**.
> - **`dangerouslySetInnerHTML` is banned** on `body` — an editor/AI-authored body is untrusted input.
>
> **Migration `0002_articles_gallery.sql` is APPLIED** (`gallery jsonb not null default '[]'` +
> `jsonb_typeof = 'array'` CHECK), replayable, with **no grant/policy change** — 0001's *whole-table*
> `grant select` auto-covers new columns, and RLS gates rows not columns. Proven empirically, not just
> structurally: anon reads the new column on published rows, anon still gets `[]` for the draft by
> slug, anon `PATCH` → **401**, and the CHECK really rejects a non-array.
>
> **▶ NEXT: get the human to confirm slice 03 in the browser** (`http://localhost:3001/news` → click a
> headline; then try `/news/unannounced-roster-shakeup` → must 404). On confirmation, mark
> `init-web-002` **`prototyped`** on the board below. **Then slice 04 = `init-e2e-008`** (unauthenticated
> cannot reach `/admin`) — the first slice that needs Supabase Auth.
>
> ### 🎨 Slice 01b — brand system — BUILT, VERIFIED, human-confirmed 2026-07-10
> The provisional slice-01 palette (near-black `#111` masthead, red `#e11900`) was **off-brand** and
> is superseded. The real palette was **measured from the Federation crest**, pixel-by-pixel, and
> corroborated by the team's navy-and-gold uniforms: navy **`#1a315f`** (48% of crest) + gold
> **`#f3cb36`** (24%). Human decisions: white primary background · solid navy masthead · gold reach =
> "Donate + small signals" · crest + text wordmark · **dark mode dropped (light only)**.
>
> **The one hard rule: gold NEVER carries white text (1.57:1).** It is now an executable test — the
> forbidden-pair guard asserts the Donate label's computed color is never `rgb(255,255,255)`.
>
> Verified independently from a clean `.next`: **37 passed / 11 skipped**, plus a real-browser read of
> the live DOM (Donate navy-on-gold **8.13:1**; inactive nav on masthead **8.58:1**; gold 2px active
> underline; crest `alt=""`; one `<main>`; one `site-brand`). Sources of truth: **`DESIGN.md`
> §Brand & design tokens** and `slice-01b-brand.md`.
>
> ### ✅ Slice 02 — public news feed — BUILT, VERIFIED, human-confirmed 2026-07-10
> `public.articles` exists on Supabase Postgres 17.6. **RLS enabled AND forced**; one policy
> (`SELECT` for `{anon,authenticated}` `USING (status = 'published')`); **no write policy →
> default-deny**. Grants narrowed: `anon`/`authenticated` hold **SELECT only**. Migration applied
> **four times, still replayable**. `/news` renders 2 published cards, newest-first, with a real
> empty state; the draft never appears.
>
> **RLS proven empirically, not just structurally** (probing the live REST API out of band):
> service_role sees 3 rows · anon sees exactly the 2 published · **anon asking for the draft by slug
> gets `[]`** · anon `INSERT`/`DELETE` → **401** · row count intact. Structural checks only prove a
> policy *exists*; this proves it *works*.
>
> **Suite: 52 passed / 12 skipped / 0 failed.** `tsc` clean, `eslint` clean.
>
> **⚠️ CREDENTIAL CORRECTION — earlier guidance in this file was wrong.** `SUPABASE_KEY` is **not**
> a stale, role-ambiguous leftover to delete. It is **`sb_secret_…`, Supabase's new-format secret
> key** — full-access and RLS-bypassing, equivalent to `service_role`. `.env.local` holds **two
> generations of full-access secret** (`SUPABASE_KEY` new, `SUPABASE_SERVICE_ROLE_KEY` legacy JWT),
> plus `SUPABASE_DB_URL` (psql only; **never** for application code). **Nothing was deleted.**
> Retiring the legacy JWT is deferred to `/actualize`. *Decode a credential before deleting it.*
>
> **API keys ≠ a database connection.** Supabase API keys reach PostgREST, which operates on rows in
> *existing* tables; **DDL is not exposed over HTTP at all**, so even the RLS-bypassing secret key
> cannot create a schema. Migrations require `SUPABASE_DB_URL` + `psql`. This confused us once; it
> will confuse the next reader too.
>
> **The trap this slice existed to avoid:** a broken RLS policy and a broken seed both produce an
> empty feed, and a naive empty-state test passes against either — green, and proving nothing. The
> suite therefore asserts `toHaveCount(2)` (non-empty **and** draft-excluded), the draft's absence
> by slug, newest-first DOM order, and the newest card's known headline text.
>
> **What exists on disk now**
> - **`DESIGN.md`** (repo root) — binding frontend source of truth, incl. **§Brand & design tokens**
>   (the authoritative palette, contrast table, and usage rules). It did not exist before this feature;
>   both `nextjs-*` agents hard-require it. Records **L-init-01**: the inherited `.opencode/rules/*`,
>   `.claude/rules/data.md`, and `AGENTS.md`'s Go/GORM guidance target the unrelated **Jouvae**
>   Go/gRPC/SpiceDB monorepo and are **reference-only** here. **Brief every subagent on this** or it
>   will invent `src/`, `useApis`, `serverApiClient`, shadcn, Dorothy, or `gormClient`.
> - Contracts: `slice-01-shell.md` (§1 palette **superseded** by DESIGN.md §Brand),
>   `slice-01b-brand.md`, `slice-02-news-feed.md`.
> - App: `app/layout.tsx` (Oswald display font, Federation metadata, **sole `<main>`**),
>   `components/ui/{site-header,site-brand,nav-link,site-footer,section-placeholder,article-feed,
>   article-card,empty-state}.tsx`, `components/client/primary-nav.tsx` (the **only** `"use client"`
>   island), `app/page.tsx`, real `app/news/page.tsx`, placeholders for `/teams /events /about /shop
>   /donate`. `next.config.ts` → `turbopack.root` only (**no `remotePatterns`** — seed images are local).
> - Data: `lib/supabase/public.ts` (publishable key, RLS-enforced — **the feed reads through this**),
>   `lib/supabase/admin.ts` (`server-only`, `sb_secret_`), `lib/articles.ts`
>   (`listPublishedArticles` / `createArticle` / `deleteAllArticles`), `lib/format.ts` (deterministic
>   UTC date — **never `toLocaleDateString`**), `lib/seed/fixtures.ts`, `scripts/seed-articles.ts`.
> - DB: `supabase/migrations/0001_articles.sql`, applied and **replayable** (run 4×).
> - Tests: `tests/e2e/init/{init-web-009,init-web-001}.spec.ts`, `tests/tsconfig.json`,
>   `tests/support/server-only-stub.ts`.
> - Assets: `public/brand/crest{,-sm}.png` (trimmed from the Federation crest),
>   `public/seed/*.png` (3 on-brand 1200×675 placeholders).
>
> **Non-negotiables that produced the current green state — do not regress them**
> - **`createArticle()` is the ONE write path.** No hand-written rows, no raw SQL, no direct inserts
>   — in the seed, in tests, anywhere. The admin editor (slices 05–07) will reuse it verbatim.
> - **The feed reads via the publishable (RLS-enforced) client**, never the admin client. That is the
>   point: a broken policy must *fail the tests* rather than be masked by a bypassing key.
> - **Never mock mode.** Real Supabase data underneath, always.
> - **Verify by observing, never by inferring.** A green build, a compiling type, or "the request
>   reached the DB" is necessary and never sufficient. Run the suite yourself and drive a real browser.
>
> **Commands**
> ```
> setsid nohup npx next dev -p 3001 > /tmp/dev.log 2>&1 < /dev/null &   # a subagent's server dies with its task
> npm run seed                                                          # idempotent; goes through createArticle()
> PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
> psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_articles.sql      # replayable
> ```
>
> **Branch:** `init`. **Build:** `tsc --noEmit` clean; `eslint` clean (0 errors, 0 warnings);
> Playwright **52 passed / 12 skipped / 0 failed**. **Nothing is committed** — the entire tree is
> still untracked/uncommitted on branch `init`. **Nothing is shippable from Conceptualize** — every
> slice must pass `/actualize` (debt audit, backfilled tests, dcon, red-team, CI) before it can ship.
>
> **Gotchas for the next session:**
> - **Replacing a `public/` image without renaming it serves STALE bytes.** Next's image optimizer
>   caches on the source URL. The same URL returned 7578 B (old) on page load and 22011 B (new) under
>   `fetch(…, {cache:'reload'})`. Clearing `.next/cache/images` was **not** enough — a full `rm -rf
>   .next` + dev-server restart was required. Rename the asset, or expect to chase a ghost.
> - **`pgrep -f "next"` matches your own shell** (its command line contains the string) and will kill
>   the command you are running. **But `pgrep -x next-server` does NOT work either** (corrected
>   2026-07-10): the process `comm` is truncated to `next-server (v1`, so exact-match never fires and a
>   live server looks absent — this cost real time when :3001 turned out to be held by a leftover
>   softball server. **The only reliable identification is `readlink /proc/<pid>/cwd`** (skip `$$`);
>   `ss -ltnp` finds the port's true owner. Never identify a server by port alone.
> - **A green Playwright suite does not mean a raw `locator.count()` will find the element.** Playwright's
>   `expect()` **auto-retries**; a bare `count()` does not. Sampling the DOM right after
>   `domcontentloaded` races the render and produces a *convincing false defect* (this happened with the
>   404 not-found boundary). Wait for the element, then assert. Cf. the transition-tween near-miss below.
> - **`npm run seed` cannot backfill a column added by a later migration.** It is INSERT-only and
>   idempotent (catches only `23505`), so after `0002` added `gallery`, the pre-existing rows kept `[]`
>   and the seed cheerfully reported `0 created, 5 already existed` — assertions unsatisfiable, **no error
>   anywhere**. Reset via the sanctioned `deleteAllArticles()` admin helper, then re-seed through
>   `createArticle()`. Recorded as prototype debt for `/actualize`.
> - **Never read a computed style while a CSS transition is running.** Tailwind's `transition-colors`
>   is 150ms; sampling inside it returns a *tween*, not the design. This produced a convincing false
>   defect (the gold active-nav underline appeared to be `currentColor`). Settle first, then assert.
> - **A subagent's dev server dies when its task ends.** A green suite reported by an agent whose
>   server has since exited cannot be re-verified as-is — start your own and re-run. Always identify
>   servers by `readlink /proc/<pid>/cwd`, never by port.
> - **`playwright.config.ts` is now `fullyParallel: false`, `workers: 1` — do NOT "optimize" this
>   back.** The `desktop` and `mobile` projects share **one** Supabase database, the empty-state test
>   **mutates** it (`deleteAllArticles()`), and there is no per-worker DB isolation. Running them
>   concurrently makes the suite non-deterministic in *both* directions (mobile reads a truncated
>   table; or desktop's re-seed lands first and mobile passes for the wrong reason). Cost: slice-01
>   went 6s → 12.3s. Worth it.
> - **`import "server-only"` throws under Playwright's Node worker** (no `react-server` export
>   condition), and `NODE_OPTIONS=--conditions=react-server` cannot be injected from the config
>   because workers are already spawned. Resolved by aliasing `server-only` → a no-op stub in a
>   **test-scoped `tests/tsconfig.json`**. The Next build still uses the real, throwing fence — do
>   not weaken it.
> - Next.js 16 enforces **one dev server per project directory** (`.next/dev/lock`). Playwright's
>   webServer boots its own on :3100 — stop any stray `next dev` for this repo first. A `next-server`
>   on **:3000 belongs to `/home/tony/code/inspirations`** — a different project. Do not kill it.
> - If Playwright fails with **"Manifest file is empty"**, `rm -rf .next` and re-run (stale Turbopack
>   dev manifest across restarts).
> - `next/font/google` downloads **Oswald at build time**. Fine locally (verified reachable). A
>   network-less CI / Fly build **will fail** — resolve at `/actualize`.

## Resume recipe — slice 03 (`init-web-002`, article page + draft 404) — ✅ BUILT & VERIFIED
<!-- Written 2026-07-10 so a fresh session with no memory of the prior conversation can resume cold. -->

> **⚠️ This recipe is now HISTORICAL.** Slice 03 is built, the suite is green (68/12/0), and it was
> independently verified in a real browser. The only thing outstanding is the **human's browser
> confirmation** (see the handoff block above). Read this section for the *reasoning* behind slice 03,
> not as a to-do list. **Its old step 3 ("no migration is needed") was wrong and has been corrected.**

**Scenario (sole scope):**
> **Given** one article is `published` and another is `draft`/`in_review`
> **When** an unauthenticated visitor opens the published article's `/news/[slug]` and then attempts
> the draft's slug
> **Then** the published article renders (headline, byline, body, gallery), and the draft/`in_review`
> slug returns **404** (never exposed to the public).

**Read first, in order:** `DESIGN.md` (root — binding, incl. §Brand & design tokens) →
`slice-02-news-feed.md` (slice 03 follows its conventions; §3.3/§8-#5 record *why* the headline is
plain text today) → `docs/entities.md` §Content/Editorial (the `Article` shape) → `scenarios.md`
(`init-web-002` only) → `supabase/migrations/0001_articles.sql` (the live schema + policy).

**Before writing code:**
1. **`AGENTS.md` binds:** this is **Next.js 16.2.10**, not the Next.js in your training data. Read
   `node_modules/next/dist/docs/01-app/` before writing any code — especially
   `03-layouts-and-pages.md` §"Creating a dynamic segment" (**`params` is a `Promise`:
   `const { slug } = await params`**) and the `notFound()` / `not-found.tsx` API.
2. **L-init-01:** the inherited `.opencode/rules/*`, `.opencode/skills/design-system`,
   `.claude/rules/data.md`, and `AGENTS.md`'s Go/GORM guidance target the unrelated **Jouvae**
   monorepo. No Go, gRPC, proto, Dorothy proxy, `gormClient`, `useApis`/`serverApiClient`, shadcn,
   or `src/` exists here. **Brief every subagent explicitly** or it will invent them.
3. **A migration IS needed** (this line previously said the opposite — it was wrong). The scenario's
   *Then* clause requires the article page to render a **gallery**, and `0001_articles.sql` has no
   `gallery` column (slice-02 §1.1 deferred `gallery[]`). Slice 03 introduces
   **`supabase/migrations/0002_articles_gallery.sql`** — additive, replayable: `gallery jsonb not
   null default '[]'` + a `jsonb_typeof(gallery) = 'array'` CHECK. **No grant/RLS change** — 0001
   granted whole-table `select` (which auto-covers columns added later) and RLS gates *rows*, not
   columns, so a draft's gallery is hidden for the same reason its title is. Apply out of band:
   `psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_articles_gallery.sql`. **Skip this and every
   article page 500s** — the `select` of a nonexistent column makes PostgREST error, and
   `getPublishedArticleBySlug` throws by design rather than masking it as a 404.

**The loop** (per `/conceptualize`: one slice, hard stop at the end):
`architect` sketches the slice → `nextjs-qa-reviewer` reviews the sketch → `nextjs-tester` writes the
**failing** Playwright e2e → `nextjs-implementer` makes it pass → **you self-verify by observing**:
run the suite yourself, drive a real browser, assert the rendered DOM, screenshot.

**Slice-03 specifics, learned the hard way:**
- **The 404 must be asserted, not assumed.** RLS already makes it true (the publishable client simply
  gets no row for a non-published slug), but assert the actual HTTP **404** for `draft`, `in_review`,
  **and** `unpublished`. The seed provides `unannounced-roster-shakeup` (`draft`).
- **The card headline becomes a `<Link>`** now that the route exists. That changes `ArticleCard`'s
  accessible-name semantics (link name vs `<h2>` heading name) — update `slice-02-news-feed.md` §4
  and the e2e together, and re-check Playwright strict mode.
- **`add a new testid` ⇒ update the contract's testid table.** It is a hard contract, not decoration.
- **The category chip is navy-text-on-gold (8.13:1).** Gold text on white is **1.57:1 — banned.**
  See `DESIGN.md` §Brand usage rule 6.
- Dates render through `lib/format.ts` (deterministic UTC). **Never `toLocaleDateString`** — it drifts
  between local and CI.

**Environment gotchas (each of these cost real time):**
- **A subagent's dev server dies with its task.** Start your own:
  `setsid nohup npx next dev -p 3001 > /tmp/dev.log 2>&1 < /dev/null &`
- **`pgrep -f "next"` matches your own shell and will kill your command.** Use `pgrep -x next-server`,
  skip `$$`. Identify servers by `readlink /proc/<pid>/cwd`, **never by port** — the `next-server` on
  **:3000 belongs to `/home/tony/code/inspirations`**, an unrelated project. Do not kill it.
- Next.js 16 enforces **one dev server per project directory** (`.next/dev/lock`). With a server
  already up, run `PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test` (this disables the
  managed `webServer`; `reuseExistingServer` does *not* help — it probes :3100).
- **Replacing a `public/` image without renaming it serves stale bytes** (optimizer caches on source
  URL). `rm -rf .next` + restart; clearing `.next/cache/images` alone is not enough.
- **Never sample a computed style mid-`transition-colors`** (150ms) — you read a tween, not the design.
- Playwright "Manifest file is empty" = stale Turbopack state → `rm -rf .next`, re-run.
- `next/font/google` fetches **Oswald at build time**; a network-less CI/Fly build will fail. `/actualize`.

## Checkpoints (human-in-the-loop)
<!-- Default: all selected. Unselected checkpoints proceed automatically. -->
- [x] post-triage
- [x] post-problem-statement   ← current gate (present validated problem + drafted scenarios)
- [x] post-prototype / pre-build
- [x] pre-merge
- [x] pre-deploy

## Scenario board
<!-- draft → prototyped → tests-backfilled → dcon-passed → red-team-passed → shipped -->
<!-- Scope = FIRST SLICE only (Foundation + News feed + editorial workflow). Other capabilities author their own scenarios in their child features. -->
| Scenario | State | Notes |
|---|---|---|
| init-web-001 | **prototyped** ✅ | Public news feed. **Slice 02.** Human confirmed 2026-07-10. Migration applied (RLS enabled+forced, `anon` = SELECT only); seeded through the real `createArticle()`. RLS proven empirically (anon cannot read the draft even by slug; anon writes → 401). |
| init-web-002 | **prototyped** ✅ | Article page `/news/[slug]`. **Slice 03.** Human confirmed 2026-07-15. Migration `0002` applied (gallery jsonb; no grant/policy change needed). Published renders headline/byline/date/hero/body/gallery; `draft`/`in_review`/`unpublished`/nonexistent all return a real **404** with no title leak. Card headline is now a `<Link>`. RLS is the sole visibility control on the by-slug read (no redundant status filter) — so a broken policy fails the suite instead of hiding. |
| init-e2e-003 | **prototyped** ✅ | Contributor creates + submits draft. **05a** (role foundation — `profiles`/`roles[]`, `has_role` SECURITY DEFINER, `auth.users` trigger, `articles.author_id`, contributor RLS; seed contributor + admin=editor; `admin-roles` badge; RLS probes 8/8 incl. exit gate + publish barrier) + **05b** (new-article form + `[id]` editor + editorial queue + `createDraft`/`submitForReview` Server Actions through the session/RLS client; suite 82/18/0; real-browser 9/9; out-of-band read confirms `source=human`/`in_review`/`author_id`/byline). Human-confirmed 2026-07-30. **Open deviation:** nav gated to `contributor` only — editor nav + editor-wide queue land in slice 06 (`init-e2e-005`), at which point the 05a `init-e2e-003a` "admin dashboard is non-navigating" assertion must be retired. |
| init-e2e-004 | **prototyped** ✅ | Contributor cannot publish (permission-denied). **Slice 07 — verification slice, zero new code.** Human-confirmed 2026-07-31. Barrier already complete at 3 layers (RLS contributor WITH CHECK pins draft/in_review; `/admin/review/[id]` + publish action `requireRole('editor')`; no Publish control in the contributor UI). e2e passed first run; independent 6/6 (out-of-band E5: contributor direct publish → 403 status unchanged; browser: no publish control, redirected from review surface). Suite 84/20/0. **Mark `prototyped` only after the human confirms.** |
| init-e2e-005 | **prototyped** ✅ | Editor reviews/edits/publishes. **Slice 06.** Human-confirmed 2026-07-31. Migration `0004` (editor SELECT-any + UPDATE-any, `has_role('editor')`); editor-wide queue + `/admin/review/[id]` + publish via session client; `published` chip white-on-navy. Editor now has editorial nav — **05b deviation RESOLVED**, `init-e2e-003a` "non-navigating" assertion **retired**. Verified: RLS probes 6/6 (editor publishes; **contributor still can't** — anti-tautology; provenance untouched; anon composition intact); suite 83/19/0; real-browser 9/9 (publish → live on `/news` with edited body); `/news` back to exactly 2 after cleanup. **Mark `prototyped` only after the human confirms in the browser.** |
| init-e2e-006 | **prototyped** ✅ | Editor unpublishes a live article → `unpublished`, gone from `/news`, slug **real 404**, remains in editorial queue as Unpublished (Re-publish available). Human-confirmed 2026-07-31. **Slice 08 — NO migration** (editor UPDATE-any already permits it). Status-aware review view + `unpublishArticle` action (session client) + broadened `listEditorialQueue`; `published_at` retained. Verified: suite 85/21/0; real-browser 8/8; out-of-band status=unpublished/published_at retained/anon `[]`. `/news` back to 2. **Mark `prototyped` only after the human confirms.** |
| init-e2e-007 | **prototyped** ✅ | AI draft → review, never autopublish, provenance stored. **Slice 09 (last).** Human-confirmed 2026-07-31. Migration `0005` (`ai_provenance jsonb` + CHECK + separate `articles_ai_draft_insert` policy pinning `status='draft'`/`source='ai'`/provenance). Deterministic stub drafter (Claude swap-in seam); placeholder sources. **Never-autopublish proven at the DB — probes 10/10** (neither contributor nor editor can insert `(ai,published)`). Suite 86/22/0; real-browser 11/11 (Generate → provenance → Accept → draft, not on `/news`, slug 404); dcon confirms `source=ai`/`status=draft`/`ai_provenance`/`published_at` null. **Mark `prototyped` only after the human confirms.** |
| init-e2e-008 | **prototyped** ✅ | Admin auth gate. **Slice 04.** Human confirmed 2026-07-17. Anon → any `/admin` route 307-redirects to `/admin/login`, no admin data returned; a real email+password Supabase sign-in reaches `/admin` (gate proven non-tautological). Two layers: `proxy.ts` (optimistic cookie-refresh + redirect) + server-side `getUser()` guard (the boundary, never `getSession()`). Route-group refactor (`app/(public)/`), `@supabase/ssr` cookie clients on the anon key, admin seeded via `auth.admin.createUser`. RBAC/roles deferred to slices 05+. Suite 78/14/0; 10/10 real-browser checks both directions. |
| init-web-009 | **prototyped** ✅ | Foundation shell + core nav. **Slice 01.** Human confirmed 2026-07-09. **Re-skinned by slice 01b** (navy/gold brand tokens + crest), human-confirmed 2026-07-10 — behavior unchanged, palette and crest replaced. |

## Open loops
- **✅ RESOLVED — Supabase env contract.** `.env.local` (untracked, gitignored) now provides
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe, RLS-enforced),
  and `SUPABASE_SERVICE_ROLE_KEY` (**server-only; bypasses RLS; verified NOT `NEXT_PUBLIC_`-prefixed**,
  so it is never inlined into the client bundle). Slice 02 is unblocked.
- **🔴 RETRACTED — "delete the stale `SUPABASE_KEY`".** That advice was **wrong** and would have
  destroyed a live root credential. `SUPABASE_KEY` is `sb_secret_…`: Supabase's **new-format secret
  key**, full-access and RLS-bypassing. It is not stale and its role is not ambiguous — it was simply
  never decoded. `.env.local` carries **two generations of full-access secret** (`SUPABASE_KEY` new,
  `SUPABASE_SERVICE_ROLE_KEY` legacy JWT) plus the browser-safe `sb_publishable_…`. Nothing deleted.
  **Deferred to `/actualize`:** retire the legacy `SUPABASE_SERVICE_ROLE_KEY` JWT and standardize on
  the new-format pair. *Lesson: decode a credential before deleting it.*
- **✅ `@supabase/supabase-js@2.109.0` installed** (2026-07-09).
- **⏳ `SUPABASE_DB_URL` needed** (blocks slice 02): Dashboard → Settings → Database → Connection
  string → URI, pooler port 6543. `psql` is installed; the Supabase CLI is not. Migrations are
  versioned in `supabase/migrations/` **precisely because RLS is the security control** behind
  `init-web-002`'s "drafts never leak" — that policy must be reviewable in git, not typed into a
  dashboard once and forgotten.
- Recommended: commit a **`.env.example`** documenting the variable *names* (never values), so the
  contract survives a fresh clone.
- **Prototype debt (for `/actualize`), recorded now so it is not lost:** seed hero images are local
  `public/seed/*.png`, not Supabase Storage uploads; `author_name` is a denormalized byline with no
  `author_id` FK (auth does not exist yet); `tsx` is needed as a devDependency to run the seed script
  on this repo's Node (v20.20.2 has no native TS stripping).
  - **(slice 03)** `gallery` is an inline `jsonb` array on `articles`, **not** the `MediaAsset` entity
    `docs/entities.md` models. The upload pipeline is still unbuilt; galleries point at local
    `public/seed/*.png`. Revisit when MediaAsset lands.
  - **(slice 03)** The `gallery` CHECK is shallow (`jsonb_typeof = 'array'`) — safe only because
    `createArticle()` is the sole, typed write path and anon has no INSERT/UPDATE. **If a second write
    path is ever added, this guard is no longer sufficient.**
  - **(slice 03) An additive migration + an insert-only idempotent seed is a silent-drift trap.** The
    seed cannot backfill a new column onto existing rows and reports success while doing nothing. The
    seed needs an upsert/backfill path, or migrations need explicit data backfill.
  - **(slice 03)** `body` is rendered as plain React-escaped prose split on `\n\n`, but
    `docs/entities.md` calls it *rich text*. A real rich-text slice must pick a sanitizer/renderer —
    **`dangerouslySetInnerHTML` on DB-sourced content stays banned.**
- **⚠️ Never let `SUPABASE_SERVICE_ROLE_KEY` reach a Client Component.** It bypasses Row Level
  Security entirely. Read it only in Server Components / route handlers. The publishable key is the
  only one that may appear in browser-bound code, and it must be paired with **RLS policies that are
  actually enabled** — RLS is what makes it safe, not the key's name. Enabling RLS on the `articles`
  table is part of slice 02, not an afterthought (`init-web-002` requires drafts to be invisible to
  the public, which is an RLS/authorization property, not merely a query filter).
- **Slice sequencing:** `status.md` previously called the first slice "Foundation + News feed +
  editorial workflow" — that is *nine* scenarios and violates the smallest-visible-slice principle.
  Decomposed into: **01** `init-web-009` (shell, done) → **02** `init-web-001` (feed) → **03**
  `init-web-002` (article page + draft 404) → **04** `init-e2e-008` (admin auth gate) → **05–07**
  `init-e2e-003/004/005` (contributor + editor workflow) → **08** `init-e2e-006` (unpublish) →
  **09** `init-e2e-007` (AI draft, never autopublish).
- **Frontend conventions re-baselined early.** L-init-01 said "re-baseline at `/plan`", but the
  `nextjs-*` agents read `DESIGN.md` at *Conceptualize* time and it did not exist. It is now written
  for this stack. `/plan` should ratify it rather than author it.
- **✅ RETRACTED — "`NAV_HREFS` is dead code".** There is no `NAV_HREFS` symbol in
  `tests/e2e/init/init-web-009.spec.ts`. Line 40 declares `NAV_TEST_IDS`, which **is** used (line 110),
  and `eslint` reports **0 warnings**. Verified 2026-07-10 by grep + a clean lint run. No cleanup is
  pending. *Lesson: a "trivial cleanup" note that nobody re-verifies outlives the thing it described.*
- **Scope reality:** `softball/init` as briefed is an entire platform, not one feature. Empathize output decomposes it into a feature roadmap (overview §Roadmap); each becomes its own ECA feature. Decide at/before `/plan` whether to split.
- **Stack RESOLVED (2026-07-09):** full Next.js (no Go), Fly.io, Supabase (Auth+DB+Storage), RBAC. The inherited Jouvae Go/gRPC/SpiceDB tooling + `AGENTS.md`/`data.md` are **reference only** on this repo (see lessons L-init-01); re-baseline conventions at `/plan`.
- Federation to supply the *specific owned/licensed sources* for the AI drafter (content, not a design blocker).
