# Slice 01 — Foundation shell renders core navigation

**Scenario in scope:** `init-web-009` (and ONLY this one).
**Brand direction:** sports-editorial (ESPN / The Athletic) — near-black header bar, bold
condensed UPPERCASE type-only wordmark, dense high-contrast nav, mobile-first, one hot accent
reserved exclusively for Donate / CTAs. Works in light and dark. No logo asset exists.

> **init-web-009 — Given** an unauthenticated visitor on `/` **When** the site shell loads
> **Then** the primary navigation (News, Teams, Events, About, Shop, Donate) and the federation
> branding render, and each nav item routes to its section (sections not yet built resolve to a
> **visible placeholder**, not a broken link or error).

This contract is what `nextjs-tester` writes assertions against **before** the components exist.
Read `DESIGN.md` (repo root) first — it is the binding frontend source of truth.

---

## 1. Design tokens (Tailwind v4 `@theme`)

> **⚠️ SUPERSEDED (2026-07-09).** This §1 token table **and** the "accent-as-fill-only" reasoning
> below are superseded by **`DESIGN.md` § Brand & design tokens** and the reskin contract in
> `docs/features/softball/init/slice-01b-brand.md`. Reason: the real brand palette (navy `#1a315f`
> + gold `#f3cb36`) was extracted from the Federation crest and confirmed by the team uniforms; the
> near-black `#111` masthead + red `#e11900` accent scheme here was **provisional and off-brand**.
> The central constraint has **inverted** — gold carries **navy** text (the new hard rule is that
> gold must *never* carry white text). The original analysis below is a **valid historical record**
> and its contrast math was correct *for the palette it assumed*; it is retained deliberately, not
> deleted. Do not implement the values in this section — implement `slice-01b-brand.md`.

Declared in `app/globals.css` following the existing `:root` + `@media (prefers-color-scheme:
dark)` + `@theme inline` pattern. **The header bar and the accent are constant across light and
dark** (a sports-editorial signature: the masthead is always dark). Only page surface/text tokens
flip with the color scheme.

### Semantic tokens

| Token (CSS var) | Tailwind utility | Light | Dark | Role |
|---|---|---|---|---|
| `--background` → `--color-background` | `bg-background` | `#ffffff` | `#0a0a0a` | Page background |
| `--foreground` → `--color-foreground` | `text-foreground` | `#0a0a0a` | `#ededed` | Body text |
| `--surface` → `--color-surface` | `bg-surface` | `#f4f4f5` | `#161618` | Placeholder / card fill |
| `--border` → `--color-border` | `border-border` | `#e4e4e7` | `#27272a` | Hairline borders |
| `--muted` → `--color-muted` | `text-muted` | `#52525b` | `#a1a1aa` | Secondary text |
| `--header` → `--color-header` | `bg-header` | `#111111` | `#111111` | Header bar (constant) |
| `--header-foreground` → `--color-header-foreground` | `text-header-foreground` | `#f4f4f5` | `#f4f4f5` | Nav text (constant) |
| `--header-muted` → `--color-header-muted` | `text-header-muted` | `#a1a1aa` | `#a1a1aa` | Inactive nav (constant) |
| `--accent` → `--color-accent` | `bg-accent` | `#e11900` | `#e11900` | Hot accent — Donate/CTA only |
| `--accent-foreground` → `--color-accent-foreground` | `text-accent-foreground` | `#ffffff` | `#ffffff` | Text on accent fill |
| `--accent-hover` → `--color-accent-hover` | `bg-accent-hover` | `#b31400` | `#b31400` | Accent hover/active |

### Contrast (WCAG AA needs 4.5:1 for normal text)

| Pair | Ratio | Verdict |
|---|---|---|
| `foreground` `#0a0a0a` on `background` `#ffffff` (light) | ≈ 19.8 : 1 | PASS |
| `foreground` `#ededed` on `background` `#0a0a0a` (dark) | ≈ 16.9 : 1 | PASS |
| `header-foreground` `#f4f4f5` on `header` `#111111` | ≈ 17.1 : 1 | PASS |
| `header-muted` `#a1a1aa` on `header` `#111111` | ≈ 7.3 : 1 | PASS |
| `muted` `#52525b` on `background` `#ffffff` | ≈ 7.9 : 1 | PASS |
| `accent-foreground` `#ffffff` on `accent` `#e11900` (Donate button label) | ≈ 4.84 : 1 | PASS |
| `accent-foreground` `#ffffff` on `accent-hover` `#b31400` | ≈ 7.0 : 1 | PASS |

**Accent-usage decision (important, and a hard mathematical constraint):** on a near-black
(`#111`) surface, no single color can be *both* AA-legible as **text** (needs luminance high) and
carry **white text as a fill** (needs luminance low) — the two thresholds do not overlap. We
therefore fix the accent's role: **the accent is a FILL** (the Donate CTA is a solid accent pill
with white label, 4.84 : 1), and the accent is **never** used as small text on the dark header.
Any nav item that must read as text uses `header-foreground`/`header-muted`, not accent. This is
intentional; a reviewer should not expect accent-colored nav text.

### Token declaration shape (for the implementer)

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --surface: #f4f4f5;
  --border: #e4e4e7;
  --muted: #52525b;
  /* constant across schemes */
  --header: #111111;
  --header-foreground: #f4f4f5;
  --header-muted: #a1a1aa;
  --accent: #e11900;
  --accent-foreground: #ffffff;
  --accent-hover: #b31400;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
    --surface: #161618;
    --border: #27272a;
    --muted: #a1a1aa;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-header: var(--header);
  --color-header-foreground: var(--header-foreground);
  --color-header-muted: var(--header-muted);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-hover: var(--accent-hover);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-oswald);
}
```

## 2. Route inventory (this slice)

Seven routes. `/` is "built" (a minimal shell/hero); the six section routes render the **shared
placeholder** so no nav item 404s or dead-links (satisfying init-web-009's "visible placeholder,
not a broken link or error").

| Route | File | Renders | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | minimal home hero (Server Component) | nav + brand come from the layout, so they appear here |
| `/news` | `app/news/page.tsx` | `<SectionPlaceholder title="News" />` | placeholder |
| `/teams` | `app/teams/page.tsx` | `<SectionPlaceholder title="Teams" />` | placeholder |
| `/events` | `app/events/page.tsx` | `<SectionPlaceholder title="Events" />` | placeholder |
| `/about` | `app/about/page.tsx` | `<SectionPlaceholder title="About" />` | placeholder |
| `/shop` | `app/shop/page.tsx` | `<SectionPlaceholder title="Shop" />` | placeholder |
| `/donate` | `app/donate/page.tsx` | `<SectionPlaceholder title="Donate" />` | placeholder (accent is nav-only here) |

**Shared placeholder treatment:** a single `SectionPlaceholder` component renders a `<section
data-testid="section-placeholder">` containing an `<h1>` with the section title and a short
"Coming soon." line (e.g. *"This section is coming soon."*). Identical treatment for all six so
the tester can assert one selector across every unbuilt route. Every section page is a Server
Component (static, no params — respects the async-`params` rule by simply not using params).

The shell (header, nav, brand, footer, `<main>`) lives in `app/layout.tsx` and therefore renders
on **every** route, including `/`. That is what makes init-web-009 hold on the home page.

> **⚠️ Single `<main>` landmark (QA MAJ-01 — binding).** `app/layout.tsx` owns the one and only
> `<main data-testid="site-main">`. **No page may emit its own `<main>`.** Page files render
> *inside* the layout's `<main>` and must use `<div>`/`<section>` as their root. The current
> `app/page.tsx` on disk wraps its content in `<main>` — the implementer **must** replace that
> root element when editing it, or the DOM ends up with two `main` landmarks, violating §7 and
> breaking any `getByRole('main')` strict-mode assertion. (`SectionPlaceholder` already correctly
> roots at `<section>`.)

## 3. Component inventory

Import via the `@/*` alias (maps to repo root). Server Component unless marked otherwise.

### `app/layout.tsx` — RootLayout (Server Component, root layout)
- Required root layout with `<html>`/`<body>` (03-layouts-and-pages.md §"Creating a layout").
- Wires fonts via `next/font/google` as CSS variables on `<html>` (see §5), sets static
  `metadata` (title/description → Federation, replacing "Create Next App").
- Renders: `<SiteHeader />`, `<main data-testid="site-main">{children}</main>`, `<SiteFooter />`.
- `<main>` is the page landmark.

### `SiteHeader` — `components/ui/site-header.tsx` (Server Component)
- Root: `<header data-testid="site-header">`, `bg-header text-header-foreground`, full-width bar,
  sticky top optional. Banner landmark.
- Renders `<SiteBrand />` and `<PrimaryNav />`. Stays a Server Component; only the `PrimaryNav`
  subtree is client (interleaving pattern, 05-server-and-client-components.md).
- Props: `className?: string`.

### `SiteBrand` — `components/ui/site-brand.tsx` (Server Component)
- Root: `<Link href="/" data-testid="site-brand">` with visible text
  `USVI SOFTBALL FEDERATION`, styled `font-display uppercase` with tight tracking and heavy
  weight (the type-only wordmark). Accessible name comes from the text.
- Props: `className?: string`.

### `PrimaryNav` — `components/client/primary-nav.tsx` (**Client Component — `"use client"`**)
- **Why client (justification):** it owns the mobile open/closed `useState`, and it derives the
  active route via `usePathname()` for `aria-current`. Both are client-only capabilities
  (05-server-and-client-components.md §"When to use…"). The mobile toggle and the nav list share
  the same open/closed state, so the **smallest component enclosing both** is the client
  boundary. Everything else in the header (brand, footer, header shell, pages) stays a Server
  Component. This keeps the client bundle to ~6 links + a toggle.
- Renders:
  1. the mobile toggle `<button data-testid="mobile-nav-toggle">` (visible only `< md`), and
  2. `<nav aria-label="Primary" id="primary-nav" data-testid="primary-nav">` containing the six
     `NavLink`s in scenario order.
- Computes `pathname = usePathname()` once and passes `active={pathname === href}` to each
  `NavLink` (so `NavLink` needs no client hook of its own).
- Props: `className?: string`.
- Single DOM instance of each nav link (no separate desktop/mobile copies) → **no duplicate
  `data-testid`s** (critical for Playwright's strict single-match). Responsive behavior is CSS +
  the `open` state on this one element (see §4).

### `NavLink` — `components/ui/nav-link.tsx` (presentational; no directive)
- Stateless. Rendered inside the client `PrimaryNav`, so it ships in the client bundle, but has
  no `"use client"` of its own and no hooks.
- Root: `<Link href={href} data-testid={testId} aria-current={active ? "page" : undefined}>`
  with `{label}` text.
- `variant="cta"` (Donate) renders the accent pill: `bg-accent text-accent-foreground
  hover:bg-accent-hover`, rounded. `variant="default"` renders `text-header-foreground` with an
  inactive/active treatment (active also uses `aria-current="page"`).
- Props: `href: string; label: string; testId: string; active: boolean;
  variant?: "default" | "cta"; onNavigate?: () => void; className?: string`.
  `onNavigate` lets `PrimaryNav` close the mobile panel after a selection.

### `SiteFooter` — `components/ui/site-footer.tsx` (Server Component)
- Minimal. Root: `<footer data-testid="site-footer">` (contentinfo landmark) with a small
  wordmark echo and a copyright line. Kept intentionally thin for the shell.
- Props: `className?: string`.

### `SectionPlaceholder` — `components/ui/section-placeholder.tsx` (Server Component)
- Root: `<section data-testid="section-placeholder">` with `<h1>{title}</h1>` and a muted
  "Coming soon." paragraph. Optional `children` slot for future content.
- Props: `title: string; description?: string; className?: string; children?: React.ReactNode`.

## 4. `data-testid` contract (EXACT — hard contract for the tester)

Final strings. The tester writes these before the components exist; the implementer must emit
them verbatim.

| `data-testid` | Element | Component | Notes |
|---|---|---|---|
| `site-header` | `<header>` | SiteHeader | banner landmark |
| `site-brand` | `<Link href="/">` | SiteBrand | text = `USVI SOFTBALL FEDERATION` |
| `primary-nav` | `<nav aria-label="Primary">` | PrimaryNav | `id="primary-nav"` |
| `mobile-nav-toggle` | `<button>` | PrimaryNav | visible `< md` only; `aria-expanded`, `aria-controls="primary-nav"` |
| `nav-link-news` | `<Link href="/news">` | NavLink | order 1 |
| `nav-link-teams` | `<Link href="/teams">` | NavLink | order 2 |
| `nav-link-events` | `<Link href="/events">` | NavLink | order 3 |
| `nav-link-about` | `<Link href="/about">` | NavLink | order 4 |
| `nav-link-shop` | `<Link href="/shop">` | NavLink | order 5 |
| `nav-link-donate` | `<Link href="/donate">` | NavLink | order 6, `variant="cta"` (accent pill) |
| `site-main` | `<main>` | RootLayout | main landmark |
| `site-footer` | `<footer>` | SiteFooter | contentinfo landmark |
| `section-placeholder` | `<section>` | SectionPlaceholder | one per unbuilt route |

Nav order is exactly News, Teams, Events, About, Shop, Donate (matches the scenario). Each
`nav-link-*` appears **exactly once** in the DOM.

## 5. Font wiring & reconciliation (fixes for the implementer to fold in)

The current `app/layout.tsx` loads Geist Sans/Mono as CSS variables, while `app/globals.css`
hardcodes `body { font-family: Arial, Helvetica, sans-serif; }` and separately declares
`--font-sans`/`--font-mono` theme vars — so the theme font tokens are never actually applied to
the body. Reconcile as follows:

- **Body font:** in `app/globals.css`, replace `font-family: Arial, Helvetica, sans-serif;` with
  `font-family: var(--font-sans);` (which resolves through `@theme` to `--font-geist-sans`). The
  body then uses the loaded sans instead of Arial.
- **Display font (wordmark/headings):** add a condensed display face via `next/font/google` in
  the root layout and expose it as `--font-oswald`, mapped to `--font-display` in `@theme`.
  Recommended: **Oswald** (weights `500 600 700`) — a condensed grotesque that reads correctly
  for sports-editorial and self-hosts with no layout shift (13-fonts.md). Example:

  ```tsx
  import { Oswald } from "next/font/google";
  const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["500","600","700"] });
  // add `${oswald.variable}` to the <html> className alongside the existing Geist variables
  ```

  `SiteBrand` and placeholder `<h1>`s use `font-display uppercase`. (If the implementer wants
  zero new font dependencies, a fallback is Geist with heavy weight + `uppercase` + tighter
  tracking, but Oswald is the intended look — record the choice either way.)

  > **Oswald / offline builds (QA MIN-01).** `next/font/google` downloads the font file at
  > **build time** (it self-hosts; the browser never calls Google). Verified reachable from this
  > machine (`fonts.googleapis.com` → 200), so Oswald is safe for local dev and this prototype.
  > **If CI or the Fly.io build runs without network egress, `next build` will fail on the Oswald
  > fetch.** Revisit at `/actualize` — either pre-cache the font or vendor it via `next/font/local`.
- **Metadata:** set the root-layout `metadata` title/description to the Federation (e.g.
  `title: "USVI Softball Federation"`), replacing the create-next-app defaults.

## 6. Config fix to NOTE (not performed here)

`next.config.ts` should set `turbopack.root` to this directory. The dev server currently warns it
inferred the workspace root from the parent `/home/tony/code/package-lock.json` (confirmed to
exist). Intended change (for the implementer):

```ts
// next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  turbopack: { root: __dirname }, // or the absolute path "/home/tony/code/softball"
};
export default nextConfig;
```

## 7. Accessibility contract

- Landmarks: `<header>` (banner), `<nav aria-label="Primary">`, `<main>`, `<footer>`
  (contentinfo). One of each.
- `<nav>` carries `aria-label="Primary"` (distinguishes it from any future nav).
- Active nav link carries `aria-current="page"` (derived from `usePathname()` in `PrimaryNav`).
- Mobile toggle is a native `<button>` (keyboard-reachable, Enter/Space activate), with
  `aria-expanded={open}` and `aria-controls="primary-nav"` pointing at the nav's `id`.
- Wordmark link has an accessible name from its visible text.
- Optional (nice-to-have, not required this slice): a "skip to content" link targeting `<main>`.

**Notes for the tester (QA NIT-01/NIT-02):**
- On `/` **no** `nav-link-*` carries `aria-current="page"` — Home is not a nav item. This is
  correct; do not assert an active nav item for init-web-009's `/` case. Assert `aria-current`
  only after navigating into a section (e.g. `/news` → `nav-link-news`).
- `SiteFooter` echoes the wordmark text, so `getByText("USVI SOFTBALL FEDERATION")` matches **two**
  nodes and will trip Playwright strict mode. **Assert the brand via `getByTestId("site-brand")`,
  never by text.**

## 8. Responsive contract

- **`< md` (mobile, default / mobile-first):** `mobile-nav-toggle` is visible; the `primary-nav`
  list is **collapsed by default** (`display:none`) and revealed as a stacked panel when the
  toggle is pressed (`aria-expanded` flips `false → true`). Selecting a link (`onNavigate`)
  closes the panel.
- **`≥ md`:** `mobile-nav-toggle` is hidden (`md:hidden`); `primary-nav` is always displayed as a
  horizontal inline row (`md:flex`), all six links visible.
- **Testing note (deterministic Playwright):** every `nav-link-*` is always **attached** to the
  DOM (so attribute/href/`aria-current` assertions work at any viewport), but **visibility**
  differs by breakpoint. Recommended: assert `toBeVisible()` on the nav links at a **desktop
  viewport**; separately exercise the mobile flow by resizing `< md`, asserting the links are
  hidden and `mobile-nav-toggle` visible, clicking the toggle, then asserting `aria-expanded`
  became `true` and the links became visible.
- Sticky header (if used): pair with CSS `scroll-padding-top` so client-side scroll-to-top does
  not hide content behind the bar (04-linking-and-navigating.md §"Client-side transitions").

## 9. Out of scope (explicit)

No Supabase, no auth, no admin, no articles/real data, no data fetching, no route handlers, no
Stripe, no shadcn/ui, no logo asset (type-only wordmark), no OG images/favicons, no i18n. This
slice introduces **no entities** — `docs/entities.md` is untouched.
