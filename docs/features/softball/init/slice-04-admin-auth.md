# Slice 04 — Admin auth gate (`init-e2e-008`)

> **Phase:** Conceptualize (Phase 2). **Type:** contract/sketch — no implementation or test code here.
> **Scenario (sole scope):** an **unauthenticated** visitor navigating to any `/admin` route is
> **redirected to `/admin/login`** and **no admin data is returned**. Human scope: **GATE + REAL
> LOGIN** — build a working email+password sign-in and verify BOTH directions (anon → login; a real
> signed-in admin reaches `/admin`) so the gate is proven non-tautological.
>
> **Read-first (binding):** `DESIGN.md` (root) §Brand & design tokens + §Directory structure +
> §"Next.js 16 breaking changes". **L-init-01:** standalone Next.js 16.2.10 + Supabase; NO Go, gRPC,
> proto, Dorothy, `gormClient`, `useApis`/`serverApiClient`, shadcn, or `src/`. `app/` is at repo root.

---

## 0. Grounding (every framework/Supabase claim is cited to installed sources)

| Claim | Source (installed) |
|---|---|
| `proxy.ts` replaces `middleware.ts` in Next 16; single file at repo root, same level as `app/` | `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` L15, L35 |
| Proxy is **NOT a security boundary** — "should not be used as a full session management or authorization solution"; "should not be your only line of defense … security checks … as close as possible to your data source" | `.../16-proxy.md` L29; `.../02-guides/authentication.md` L1119 |
| Proxy `matcher` — without it runs on every request incl. static; negative-lookahead pattern to exclude `_next`, assets | `.../03-api-reference/03-file-conventions/proxy.md` L75, L602-619 |
| Proxy defaults to the **Node.js runtime**; `runtime` config not allowed | `.../03-file-conventions/proxy.md` L221-223 |
| Proxy `NextResponse` cookie API (`request.cookies` / `response.cookies` get/set/getAll) | `.../03-file-conventions/proxy.md` L312-380 |
| Sign-in via a `<form action={serverAction}>` + `useActionState`; Server Actions "always execute on the server … secure environment for handling authentication" | `.../02-guides/authentication.md` L33-36, L206-249 |
| Auth check + `redirect()` belongs **close to the data source**; layouts "don't re-render on navigation, meaning the user session won't be checked on every route change" — do checks close to data / in the rendered component | `.../02-guides/authentication.md` L1348-1356, L1444-1447 |
| `getUser()` "performs a network request to the Supabase Auth server"; **"Should always be used when checking for user authorization on the server … `getSession` is insecure on the server"** | `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` L2515-2527; impl `_getUser` issues `GET ${url}/user` L2611-2616 |
| `getSession()` "**IMPORTANT SECURITY NOTICE:** If using an insecure storage medium, such as cookies or request headers, the user object … **must not be trusted**" | `GoTrueClient.js` L2267 |
| Existing non-cookie clients (`persistSession:false`) — cannot carry a session a Server Component/proxy can read | `lib/supabase/public.ts` L18-20, `lib/supabase/admin.ts` L31-33 |
| `params`/route props async; sole-`<main>` rule; `data-testid` mandatory | `DESIGN.md` §"Next.js 16 breaking changes", §"Component authoring conventions" |

**`@supabase/ssr` is ABSENT** (`node_modules/@supabase/` has `auth-js, functions-js, phoenix, postgrest-js,
realtime-js, storage-js, supabase-js` — no `ssr`). It **must be installed**. Latest is **0.12.3** (verified
`npm view @supabase/ssr version`). Pin `@supabase/ssr@^0.12.3` (compatible with the installed
`@supabase/supabase-js@2.109.0`). The `getAll`/`setAll` cookie interface below is `@supabase/ssr`'s
documented `createServerClient`/`createBrowserClient` contract; confirm the exact signature against the
package once installed (the implementer verifies before wiring).

---

## 1. Files to add / modify

### Architectural decision — the `<main>` landmark & public chrome (reconciled with slice 01)

Today `app/layout.tsx` (root) renders `SiteHeader` + `<main data-testid="site-main">` + `SiteFooter`
around **all** routes. If `/admin` stayed under that, the admin portal would be wrapped in the public
masthead/footer **and** nested inside `site-main` — either a duplicate `<main>` (if the admin layout adds
one) or the admin UI trapped in public chrome (the brief forbids both).

**Decision — route-group split (the standard Next idiom; URLs unchanged, route groups are path-transparent):**

- **`app/layout.tsx` (root, MODIFY):** slim to `<html><body>{children}</body></html>`. It only **removes**
  `SiteHeader` / `<main>` / `SiteFooter`; it **keeps everything else that scaffolds the page**: `className`
  with the `next/font` `variable` classes **and `h-full`** on `<html>`, **`min-h-full flex flex-col`** on
  `<body>` (the sticky-footer scaffolding — do NOT drop it, or the moved public `<main>`'s `flex-1` has no
  column to stretch in), the `import "./globals.css"`, and the `metadata` export. Net removal is the chrome
  only; the html/body attribute contract is unchanged.
- **`app/(public)/layout.tsx` (NEW, Server Component):** renders exactly the current chrome. It **returns a
  Fragment** (`<>{`SiteHeader`} {`<main …>`} {`SiteFooter`}</>`), **NOT** a wrapping `<div>` — the `<main>`
  must remain a **direct flex child of `<body>`** so `flex-1` stretches; a wrapper div would break the
  stretch. Shape: `<><SiteHeader /><main data-testid="site-main" className="flex flex-1 flex-col">{children}</main><SiteFooter /></>`.
  **Move** the existing public **route folders** under `app/(public)/`: `page.tsx`, `news/` (its
  `[slug]/` and `[slug]/not-found.tsx` ride along inside `news/`), `teams/`, `events/`, `about/`, `shop/`,
  `donate/`. **`app/globals.css` and `app/favicon.ico` STAY at the `app/` root** (they are not routes and
  must not move). **No URL changes, no testid changes** → slices 01/02/03 stay green.
- **`app/admin/login/page.tsx` (NEW):** the **ungated** login route. Inherits the slim root layout only
  (no public chrome, no admin chrome) and renders its **own** `<main data-testid="admin-login-main">`.
- **`app/admin/(protected)/layout.tsx` (NEW, Server Component):** the **security boundary** (the
  `getUser()` guard) + minimal admin chrome, rendering its **own** `<main data-testid="admin-main">`.
  Route groups are path-transparent, so `app/admin/(protected)/page.tsx` serves **`/admin`**.
- **`app/admin/(protected)/page.tsx` (NEW):** the minimal dashboard placeholder (the "admin data" marker).

Net invariant preserved: **every rendered page has exactly one `<main>`** — public pages `site-main`,
login `admin-login-main`, protected admin pages `admin-main`. Never two at once. Login sits **outside**
`(protected)`, so the guard cannot redirect-loop it.

### Full file list

| Path | New/Mod | Server/Client | Responsibility |
|---|---|---|---|
| `package.json` | MOD | — | add `@supabase/ssr@^0.12.3` dep; add `"seed:admin"` script |
| `app/layout.tsx` | MOD | Server | slim to `<html><body>` + fonts + metadata; remove chrome/`<main>` |
| `app/(public)/layout.tsx` | NEW | Server | public chrome: `SiteHeader` + `<main data-testid="site-main">` + `SiteFooter` |
| `app/(public)/…` (move 01/02/03 routes) | MOD (move) | — | relocate `page.tsx`, `news/`, `teams/`, `events/`, `about/`, `shop/`, `donate/` under `(public)/`. URLs unchanged |
| `proxy.ts` | NEW | Server (Node runtime) | refresh session cookie on every matched request + optimistic redirect anon `/admin/*` → `/admin/login` |
| `lib/supabase/server.ts` | NEW | Server-only | `@supabase/ssr` `createServerClient` bound to `next/headers` cookies; used by the guard + login action |
| `lib/supabase/proxy.ts` | NEW | Server (Node) | `updateSession(request)` helper: `createServerClient` bound to `NextRequest`/`NextResponse` cookies, calls `getUser()`, returns the cookie-synced response + user |
| `lib/supabase/browser.ts` | NEW | Client-safe | `@supabase/ssr` `createBrowserClient` (publishable key). **Defined for the contract / future client-side auth state; NOT on this slice's sign-in path** (sign-in is a Server Action) |
| `lib/auth.ts` | NEW | Server-only | `requireUser()` — the DAL: `createServerClient().auth.getUser()`; `redirect('/admin/login')` when no user. Single choke point |
| `app/admin/(protected)/layout.tsx` | NEW | Server | calls `requireUser()` **before** rendering children; renders `<main data-testid="admin-main">` + admin chrome |
| `app/admin/(protected)/page.tsx` | NEW | Server | dashboard placeholder: `data-testid="admin-dashboard"` marker + `data-testid="admin-authenticated"` (signed-in email from the guarded user) |
| `app/admin/login/page.tsx` | NEW | Server | `<main data-testid="admin-login-main">` + renders the client form; branded per DESIGN.md |
| `app/admin/login/actions.ts` | NEW | Server (`'use server'`) | `signIn` action: `signInWithPassword`, on success `redirect('/admin')`, on error return `{ error }` |
| `components/client/admin-login-form.tsx` | NEW | Client (`'use client'`) | the form island: `useActionState(signIn)`, email/password inputs, submit, error display |
| `lib/admin-user.ts` | NEW | Server-only | `provisionAdminUser({email,password})` → `createAdminClient().auth.admin.createUser({ email, password, email_confirm: true })`; idempotent |
| `scripts/seed-admin.ts` | NEW | Node script | analogue of `scripts/seed-articles.ts`; reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, calls `provisionAdminUser`, idempotent, fails loudly |
| `.env.local` | MOD (out of band, gitignored) | — | add `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (names only) |

**Unchanged & reused as-is:** `lib/supabase/public.ts` (RLS feed reads), `lib/supabase/admin.ts`
(service-role; reused **only** by `lib/admin-user.ts` provisioning). Neither is on the session/request path.

---

## 2. The protection mechanism (two layers; only layer B is the security boundary)

### Layer A — `proxy.ts` (optimistic redirect + cookie refresh; NOT a security boundary)

Per `16-proxy.md` L29 and `authentication.md` L1119, the proxy exists for UX (fast redirect) and to
**refresh the Supabase session cookie** on each request. It must **not** be trusted as the gate.

```
matcher: ['/admin/:path*']          // ONLY the admin surface needs session work this slice
```

Logic (`proxy.ts`, Node runtime — default per proxy.md L221):
1. Call `updateSession(request)` (`lib/supabase/proxy.ts`): build a `createServerClient` whose cookies
   read from `request.cookies` and write to both the forwarded request and a `NextResponse.next({request})`;
   then `const { data: { user } } = await supabase.auth.getUser()`. Return `{ user, response }`.
   Returning that exact response keeps refreshed auth cookies in sync (the Supabase SSR contract).
2. If `pathname` starts with `/admin`, is **not** `/admin/login`, and `user` is null →
   `return NextResponse.redirect(new URL('/admin/login', request.url))` (**307**, `NextResponse.redirect` default).
3. Otherwise `return response`.

> **Matcher note:** `/admin/login` is inside the matched subtree so its cookie is refreshed, but step 2
> excludes it from the redirect → no loop. We deliberately scope the matcher to `/admin/:path*` (not the
> whole site) — the public feed has no session to refresh this slice. `next/static`, `_next/image`, and
> `public/` assets are already outside `/admin`, so no negative-lookahead is needed here.
>
> **Reconciling proxy `getUser()` with authentication.md's "avoid database checks in the proxy" (L1031):**
> the proxy's `getUser()` is accepted here **for its cookie-refresh side effect** — it is the Supabase SSR
> canonical `updateSession` pattern, where the same call that reads the user also writes the rotated auth
> cookie onto the response. The **true boundary stays Layer B**, and the matcher is scoped to `/admin/:path*`
> so this per-request auth-server round-trip is bounded to the admin surface. **Do NOT "optimize" the
> proxy's `getUser()` down to `getSession()`** — that would silently stop refreshing the token cookie (and
> is insecure on the server anyway); the cost is deliberate, not an oversight.

### Layer B — server-side `getUser()` guard in the protected layout (**the** security boundary)

`app/admin/(protected)/layout.tsx` is an `async` Server Component that awaits `requireUser()` (`lib/auth.ts`)
**as its first statement, before returning any children**:

```
// lib/auth.ts (sketch — not code to ship here)
import 'server-only'
export async function requireUser() {
  const supabase = await createServerClient()          // @supabase/ssr, bound to next/headers cookies
  const { data: { user } } = await supabase.auth.getUser()   // network call → re-validates JWT
  if (!user) redirect('/admin/login')                  // 307; nothing downstream renders
  return user
}
```

**Why `getUser()` and NOT `getSession()`** — grounded, not assumed. `getSession()` reads the JWT straight
from the cookie and its own docstring warns the returned user **"must not be trusted"** on an insecure
medium like cookies (`GoTrueClient.js` L2267). `getUser()` issues a `GET /user` to the Supabase Auth
server (`_getUser`, L2611-2616), which **re-validates the JWT**, and its docstring says it "Should always
be used when checking for user authorization on the server … `getSession` is insecure on the server"
(L2515-2527). A forged/expired cookie survives `getSession` but fails `getUser`.

### What "no admin data is returned" means concretely

- The guard runs **before** the protected layout returns children and before `page.tsx` executes, so for
  an anonymous request the dashboard page never runs — **no admin query is issued, nothing is serialized**.
  For this slice the placeholder holds no real DB data; the observable contract is that the
  `data-testid="admin-dashboard"` / `data-testid="admin-authenticated"` markers are **never present** in a
  response to an unauthenticated request.
- **Redirect happens as a 307** (proxy) / `redirect()` from the layout — a redirect response has **no admin
  body**. The e2e asserts the 307 + `Location: /admin/login` on a no-follow probe, and marker-absence after
  following.
- **NEVER add `loading.tsx` (or any Suspense boundary) above the guard** in `app/admin/` — same trap as
  slice 03 (`status.md`): a streamed shell flushes a **200** and silently downgrades the gate. Recorded in §8.

---

## 3. Supabase auth clients (`@supabase/ssr`) and how they relate to the existing clients

Three new clients, **all using the PUBLISHABLE (anon) key** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — never
the service key. A session client must operate **as the end user** (their cookie JWT), RLS-enforced. This is
the key difference from `admin.ts` (service-role, RLS-bypassing) and `public.ts` (anon but
`persistSession:false`, so no cookie session).

| Client | Module | Cookie wiring |
|---|---|---|
| **Server** | `lib/supabase/server.ts` (`server-only`) | `createServerClient(url, publishableKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => { try { list.forEach(({name,value,options}) => cookieStore.set(name,value,options)) } catch {} } } })` where `cookieStore = await cookies()` (`next/headers`). The `try/catch` on `setAll` is required: during a **Server Component render** `cookies()` is read-only and `set` throws — that write is a no-op there, and the **proxy** is what actually persists the refreshed cookie. In a **Server Action** (login) `cookies()` is writable, so `setAll` persists the session. |
| **Proxy** | `lib/supabase/proxy.ts` | `createServerClient(url, publishableKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: (list) => { list.forEach(({name,value}) => request.cookies.set(name,value)); response = NextResponse.next({ request }); list.forEach(({name,value,options}) => response.cookies.set(name,value,options)) } } })`, then `await supabase.auth.getUser()`. Uses the `NextRequest`/`NextResponse` cookie API (proxy.md L312-380). |
| **Browser** | `lib/supabase/browser.ts` | `createBrowserClient(url, publishableKey)`. **Not on this slice's sign-in path** (Server Action does the sign-in); defined for the contract and future client-side session reads. |

**Relation to `public.ts` / `admin.ts`:** unchanged. `public.ts` stays the RLS feed reader (no cookies);
`admin.ts` stays the RLS-bypassing writer/seed client and is now **also** the provisioning client for
`auth.admin.createUser`. The new `server/proxy/browser` clients add the cookie-backed **session** that
`public.ts`/`admin.ts` intentionally lack.

> **Runtime risk to verify at implementation (surfaced, not hand-waved):** `admin.ts` L12-14 polyfills
> `globalThis.WebSocket` with `ws` because supabase-js eagerly builds a `RealtimeClient` and Node < 22 has
> no global `WebSocket`. `@supabase/ssr`'s `createServerClient` wraps supabase-js, so the **proxy** (Node.js
> runtime, proxy.md L221) may hit the same constructor. If the proxy throws on boot, apply the same
> `ws` polyfill at the top of `lib/supabase/proxy.ts`. Verify empirically (the Next server runtime already
> polyfills `WebSocket` via undici; the proxy runtime may or may not).

---

## 4. `/admin/login` page + sign-in action

- **`app/admin/login/page.tsx` (Server):** `<main data-testid="admin-login-main">` containing a branded
  card (`bg-surface`, `border-border`, navy `text-brand` heading via `font-display`) that renders
  `<AdminLoginForm />`. May carry `metadata` (title "Admin sign-in"). Server-Component-only metadata
  (DESIGN.md §Metadata).
- **`components/client/admin-login-form.tsx` (`'use client'`):** `const [state, action, pending] =
  useActionState(signIn, undefined)` (`authentication.md` L206-249). Fields: **email** (`type="email"`,
  `name="email"`, `data-testid="admin-login-email"`), **password** (`type="password"`, `name="password"`,
  `data-testid="admin-login-password"`), submit (`data-testid="admin-login-submit"`, disabled while
  `pending`). Error text rendered when `state?.error` (`data-testid="admin-login-error"`). Brand tokens:
  primary button `bg-brand text-header-foreground hover:bg-brand-hover`; focus rings `outline-focus`.
  **Gold is not used here** (no CTA) — keeps gold scarce per DESIGN.md rule 2.
- **`app/admin/login/actions.ts` (`'use server'`):** `signIn(prevState, formData)`:
  1. read `email`/`password` from `formData`; minimal presence validation → return `{ error: '…' }` early.
  2. `const supabase = await createServerClient()` (server client; writable cookies in an action).
  3. `const { error } = await supabase.auth.signInWithPassword({ email, password })`.
  4. on `error` → `return { error: 'Invalid email or password.' }` (generic — no user-enumeration).
  5. on success the session cookie is now set by the client's `setAll`; `redirect('/admin')`
     (a Server-Action `redirect()` responds **303**; the browser then GETs `/admin`, which passes Layer B).

> **⚠️ `redirect('/admin')` MUST be called OUTSIDE any `try/catch`.** `redirect()` works by **throwing**
> a `NEXT_REDIRECT` error that Next catches to perform the navigation
> (`node_modules/next/dist/docs/01-app/02-guides/redirecting.md` L84). If the success `redirect` sits
> inside a `try` that also wraps `signInWithPassword`, the `catch` swallows `NEXT_REDIRECT` and the user
> silently stays on the login page with no error. Enforce the order: **validate → `signInWithPassword`
> (inside try/catch if you catch transport errors) → inspect the returned `error` → then, at the top level
> outside every try/catch, `redirect('/admin')`.**

Runs **server-side** (Server Action) — chosen over a route handler or client-side sign-in because the doc
calls Server Actions "a secure environment for handling authentication" (`authentication.md` L36) and it
lets the same call set the cookie and `redirect()` atomically.

---

## 5. `data-testid` contract (hard — the e2e targets exactly these)

| `data-testid` | Element | Where |
|---|---|---|
| `admin-login-main` | `<main>` on the login route | `app/admin/login/page.tsx` |
| `admin-login-form` | `<form>` | `components/client/admin-login-form.tsx` |
| `admin-login-email` | email `<input>` | login form |
| `admin-login-password` | password `<input>` | login form |
| `admin-login-submit` | submit `<button>` | login form |
| `admin-login-error` | error message (present only on failure) | login form |
| `admin-main` | `<main>` on protected admin pages | `app/admin/(protected)/layout.tsx` |
| `admin-dashboard` | the **"admin data" marker** — must be **absent** for anon | `app/admin/(protected)/page.tsx` |
| `admin-authenticated` | the **"authenticated" marker** — renders the signed-in user's email from the guard | `app/admin/(protected)/page.tsx` |

Any new testid added during implementation must be added to this table (DESIGN.md §Component authoring).

---

## 6. Admin-user provisioning (sanctioned create path only)

- **`lib/admin-user.ts` (`server-only`):** `provisionAdminUser({ email, password })` →
  `createAdminClient().auth.admin.createUser({ email, password, email_confirm: true })`. The
  `email_confirm: true` yields a confirmed user so `signInWithPassword` works immediately with **no email
  inbox** (why password auth was chosen — deterministic for Playwright). This is the **only** create path;
  **never** hand-write an `auth.users` row. Idempotency: a second run returns an "email exists" error →
  catch that narrowly (treat as already-provisioned) and re-throw anything else, mirroring
  `scripts/seed-articles.ts`'s narrow `23505` catch.
- **`scripts/seed-admin.ts`:** reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from env, calls
  `provisionAdminUser`, logs, and **fails loudly** (non-zero exit) on any non-idempotent error — same
  discipline as `seed-articles.ts`. Wire `package.json` script
  `"seed:admin": "node --conditions=react-server --env-file=.env.local --import tsx scripts/seed-admin.ts"`.
- **Env var names (values live in gitignored `.env.local`):** `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- **How the e2e obtains the credentials:** identical to the slice-02 pattern — `playwright.config.ts`
  already parses `.env.local` into `process.env` before workers spawn (`loadEnvLocal()`), and workers
  inherit `process.env`. The spec reads `process.env.SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The
  spec's setup (or a documented pre-step) runs `provisionAdminUser` once so the admin exists before the
  positive test — reusing `lib/admin-user.ts`, never a raw insert. Add `SEED_ADMIN_*` to the
  `loadEnvLocal` expectation the same way `SUPABASE_KEY` is used today.

---

## 7. Verification plan (both directions — the anti-tautology contract)

Run against a real dev server + real Supabase (never mock). Precondition: `npm run seed:admin` has
provisioned the admin. Playwright runs serial/`workers:1` (existing config).

### Negative (the scenario) — anon cannot reach `/admin`, no admin data leaks
1. **Raw 307 probe (no-follow), out of band:** `request.get('/admin', { maxRedirects: 0 })` →
   `expect(res.status()).toBe(307)` and `expect(res.headers()['location']).toContain('/admin/login')`.
   Repeat for a **nested** path (e.g. `/admin/queue`, `/admin/anything`) to prove `/admin/:path*` coverage.
2. **Browser follow:** fresh context (no `storageState`); `page.goto('/admin')` → `expect(page).toHaveURL(/\/admin\/login$/)`.
3. **No admin data:** `expect(page.getByTestId('admin-dashboard')).toHaveCount(0)` **and**
   `expect(page.getByTestId('admin-authenticated')).toHaveCount(0)` on that redirected response. (Use
   `expect(...).toHaveCount` — auto-retrying — never a bare `count()`; see `status.md` gotcha.)

### Positive (anti-tautology) — a real admin signs in and reaches `/admin`
Drives the **real** Supabase `signInWithPassword` (Conceptualize forbids forged/minted sessions):
1. `page.goto('/admin/login')`.
2. `page.getByTestId('admin-login-email').fill(process.env.SEED_ADMIN_EMAIL)`;
   `page.getByTestId('admin-login-password').fill(process.env.SEED_ADMIN_PASSWORD)`.
3. `page.getByTestId('admin-login-submit').click()`.
4. `await expect(page).toHaveURL(/\/admin$/)` — the redirect landed on the dashboard (Layer B `getUser()`
   passed with the freshly-set cookie).
5. `await expect(page.getByTestId('admin-dashboard')).toBeVisible()` and
   `await expect(page.getByTestId('admin-authenticated')).toContainText(process.env.SEED_ADMIN_EMAIL)` —
   proves real admin data rendered for the real signed-in user (the gate is non-tautological: a gate that
   redirected everyone would fail here).
6. **Persistence:** `page.goto('/admin')` again in the same context → still `admin-dashboard` visible
   (cookie session persists; the guard re-validates via `getUser()`).

Also assert a **wrong-password** attempt shows `admin-login-error` and stays on `/admin/login` (proves the
positive path isn't passing by accident).

---

## 8. Prototype debt (recorded for `/actualize`)

- **Authentication-only gate, no RBAC.** The guard checks *"is there a verified user session,"* not role.
  Because there is **no public signup** in the app today, **authenticated ⟺ admin holds now** — a
  **temporary property**. Role-gating the admin portal and editorial actions (contributor/editor/…
  per `docs/entities.md` §Identity/Access) arrives in slices 05+; revisit the moment public accounts land.
- **No signup, no password reset, no logout UI** this slice (logout/`signOut` + session-expiry UX deferred).
- **Partial-rendering caveat** (`authentication.md` L1348-1356): a layout guard does **not** re-run on
  client-side transitions *between* admin routes. Acceptable now (no intra-admin `<Link>` transitions
  exist). Slices 05+ MUST verify auth **inside each Server Action / Route Handler** (L1449-1541), not rely
  on the layout — Server Functions can be invoked without re-rendering the layout (proxy.md L217-219).
- **Never add `loading.tsx`/Suspense above the guard** in `app/admin/` — flushes a 200 and downgrades the
  gate (same class as the slice-03 `notFound()` trap).
- **`@supabase/ssr` proxy `WebSocket` polyfill** (see §3) — verify; add `ws` shim if the proxy throws.
- **Legacy `SUPABASE_SERVICE_ROLE_KEY` JWT** retirement still deferred (open loop from slice 02).
- **Session-refresh edge cases** (token rotation near expiry, concurrent refresh) are exercised only
  incidentally; no dedicated coverage this slice.
- **Admin provisioned by script**, no user-management UI; single seed admin.
- **Nothing shippable from Conceptualize** — this slice still owes `/actualize` (debt audit, backfilled
  tests, dcon, red-team, CI) before ship.

---

## 9. Entities check (`docs/entities.md` §Identity/Access)

The registry already models **User** (`email`, `name`, `roles[]`, `status`, auth provider ref) and **Role**
(RBAC enum), and records the decision: *"Auth via Supabase Auth … Role rows in Supabase, enforced in
Next.js route handlers."* This slice **realizes the authentication half** and surfaces two facts worth
recording (it does not add or rename any entity): (a) the operator identity store for the prototype is
Supabase **`auth.users`** (provisioned via `auth.admin.createUser`), with no app-level `users`/`roles`
table yet; (b) the gate enforces **authentication only** — `User.roles[]` is not yet consulted, and the
"authenticated ⟺ admin" equivalence is a temporary consequence of there being no public signup. That is
genuinely warranted to record, so add this dated line to `docs/entities.md` Appendix A (leave the entity
bodies unchanged; ratify in `/plan`):

```
- 2026-07-17 — **Auth gate realized (slice 04 conceptualize; ratify in /plan).** Operator authentication
  runs on Supabase Auth `auth.users` (seed admin via `auth.admin.createUser`, email_confirm=true); no
  app-level users/roles table exists yet. The `/admin` guard checks AUTHENTICATION only (server-side
  `supabase.auth.getUser()` in the admin layout, JWT re-validated at the Auth server — never
  `getSession()`); `User.roles[]` / RBAC is deferred to slices 05+. "authenticated ⟺ admin" holds ONLY
  because there is no public signup today — a temporary property to revisit when public accounts land.
  Proposed — softball/init conceptualize; ratify in /plan.
```
