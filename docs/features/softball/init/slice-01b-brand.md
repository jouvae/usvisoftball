# Slice 01b — Brand reskin (navy + gold)

**Type:** brand reskin. **No new behavior and no new routes.** This slice repaints slice-01's shell
in the real Federation brand (navy `#1a315f` + gold `#f3cb36`) extracted from the crest, replacing
the provisional near-black/red palette. It makes **two** contract additions beyond pure repaint,
both mandated by the coordinator: **one** new `data-testid` (`site-brand-crest`, for the crest
`<img>`, §3) and the **first color assertions** in the e2e suite (§4). Everything else — routes,
landmarks, nav order, hrefs, ARIA, existing testids — is unchanged.

**Binding sources:** `DESIGN.md` § Brand & design tokens (the authoritative token + contrast +
rules reference) and this contract (files, exact CSS, e2e delta). Where they overlap, they agree;
if they ever drift, `DESIGN.md` wins on values and this file wins on file/line mechanics.

**Supersedes:** `slice-01-shell.md` §1 (token table); §5's Oswald wiring is *kept* (see §6 below).
The `data-testid` table in `slice-01-shell.md` §4 remains binding verbatim and is **extended** by
exactly one entry, `site-brand-crest` (§3).

---

## 1. Files that change (exhaustive)

| File | Change | Kind |
|---|---|---|
| `app/globals.css` | Replace the `:root` / `@media dark` / `@theme inline` color block with §2 verbatim; drop the dark `@media` block (light-only). | tokens |
| `components/ui/site-header.tsx` | No class change required — `bg-header text-header-foreground` now resolve to navy/white. Optional: add `border-b border-border` only relevant to the reserve dark mode; not required light-only. | none/opt |
| `components/ui/site-brand.tsx` | Add the crest via `next/image` (see §5) before the wordmark text. Wordmark text + `text-header-foreground` unchanged. | markup |
| `components/ui/nav-link.tsx` | No token-name change (CTA still `bg-accent text-accent-foreground hover:bg-accent-hover` → now gold + navy). Add the **active gold underline** signal for `variant="default"` when `active` (e.g. `border-b-2 border-accent`), replacing the current color-only active state. | markup |
| `components/ui/site-footer.tsx` | No change required — `bg-surface text-muted border-border text-foreground` reflow to the new values. Optional: wordmark echo → `text-brand`. | none/opt |
| `components/ui/section-placeholder.tsx` | Optional: `<h1>` → `text-brand` (navy heading) instead of `text-foreground`. Purely cosmetic; not asserted. | opt |
| `components/client/primary-nav.tsx` | No token-name change; mobile toggle border `border-header-muted/40` reflows. No logic change. | none |
| `app/page.tsx` | Optional: hero `<h1>` → `text-brand`. Not asserted. | opt |
| `app/layout.tsx` | No change (fonts + metadata unchanged). | none |

Everything above is **class/markup + token-value** work. No test file, no `next.config.ts`, no new
route, no new component.

## 2. The exact token block to write (supersedes slice-01 §1 verbatim)

Replace lines 1–43 of the current `app/globals.css` (the `@import`, `:root`, `@media dark`, and
`@theme inline` blocks) with this. The `body { … }` rule at the bottom of the file stays as-is.

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --brand: #1a315f;
  --brand-hover: #0c203c;
  --surface: #f5f7fa;
  --border: #e2e8f0;
  --muted: #475569;
  /* masthead + accent are constant (no dark variants) */
  --header: #1a315f;
  --header-foreground: #ffffff;
  --header-muted: #cbd5e1;
  --header-hover: #24427a;
  --accent: #f3cb36;
  --accent-foreground: #1a315f;
  --accent-hover: #d9b021;
  --focus: #3b82f6;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-header: var(--header);
  --color-header-foreground: var(--header-foreground);
  --color-header-muted: var(--header-muted);
  --color-header-hover: var(--header-hover);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-hover: var(--accent-hover);
  --color-focus: var(--focus);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-display: var(--font-oswald);
}
```

**Dark-mode note:** the `@media (prefers-color-scheme: dark)` block from slice-01 is **removed**
(light-only, per `DESIGN.md` § Dark mode). If it is ever reinstated, use the *complete* reserve
palette in `DESIGN.md`'s token table — do not reintroduce a partial block.

**Token-name stability is the whole trick:** every token name slice-01 components already reference
(`--color-header`, `--color-accent`, `--color-accent-foreground`, `--color-accent-hover`,
`--color-surface`, `--color-border`, `--color-muted`, `--color-foreground`, `--color-background`,
`--color-header-foreground`, `--color-header-muted`) keeps its name and only changes value. New
names added: `--color-brand`, `--color-brand-hover`, `--color-header-hover`, `--color-focus`.

## 3. `data-testid` contract — ONE addition: `site-brand-crest`

The reskin introduces exactly **one** new observable element (the crest `<img>`), and `DESIGN.md`
mandates a `data-testid` on every observable element — so "unchanged" no longer holds. Add exactly
one testid; nothing is renamed or removed.

| `data-testid` | Element | Component | Notes |
|---|---|---|---|
| `site-brand-crest` | `<img>` (the `next/image` element) | SiteBrand | decorative crest, `alt=""`; lives **inside** the `site-brand` link |

Every existing testid in `slice-01-shell.md` §4 stands verbatim. All other DOM structure,
landmarks, nav order, hrefs, `aria-label`, `aria-current`, `aria-expanded`/`aria-controls`, and
visibility semantics are identical.

**`getByTestId("site-brand")` still resolves to exactly one element — strict mode holds.**
`data-testid="site-brand"` is on the `<Link>` (the `<a>`); `data-testid="site-brand-crest"` is on
the `<img>` nested inside it. They are two **distinct** testid strings on two **distinct**
elements, so `getByTestId("site-brand")` matches the single `<a>` and `getByTestId("site-brand-crest")`
matches the single `<img>`. Playwright's `getByTestId` matches the attribute value exactly (not a
substring), so the `<img>` is not a second match for `"site-brand"`. The existing
`getByTestId("site-brand").toHaveText("USVI SOFTBALL FEDERATION")` also still passes: an `alt=""`
image contributes no text, so the link's text content is unchanged.

## 4. e2e assertions — mandatory additions + confirmed non-changes

**Correction of record: `tests/e2e/init/init-web-009.spec.ts` currently asserts ZERO computed
colors.** Every assertion in the file was read; there is **no** `toHaveCSS`, no `rgb(...)`, no
`backgroundColor`/`color` check (`grep -niE 'toHaveCSS|rgb\(|background-color' tests/` returns
nothing). The `rgb(225, 25, 0)` figure came from a prior session's **manual browser observation
recorded in `status.md`**, not from a test. So **no existing assertion needs its value changed.**

**But the coordinator has mandated new color assertions** (human override): this slice's entire
payload *is* color, and a reskin no test can observe regresses silently. `nextjs-tester` **MUST
add** the assertion set in §4.1 to `tests/e2e/init/init-web-009.spec.ts`. These are the **first
color assertions in the suite.**

### 4.1 Mandatory assertions to ADD (exact Chromium `rgb()` strings)

Chromium reports `getComputedStyle` colors as `rgb(r, g, b)` (no alpha when opaque), space after
each comma. Add these against the existing testids; run at the **desktop** project where nav links
and the pill are visible (the `nav-link-donate` CTA and `site-header` are always attached, but the
label color read needs the element rendered).

| # | Target (testid) | Property | Expected exact string | Token / rule |
|---|---|---|---|---|
| 1 | `nav-link-donate` | `background-color` | `rgb(243, 203, 54)` | `--accent` gold `#f3cb36` |
| 2 | `nav-link-donate` | `color` | `rgb(26, 49, 95)` | `--accent-foreground` navy `#1a315f` |
| 3 | `nav-link-donate` | `color` **NOT** | `rgb(255, 255, 255)` | **guard on the forbidden pair** — white-on-gold is 1.57:1; encode the one hard rule as a test |
| 4 | `site-header` | `background-color` | `rgb(26, 49, 95)` | `--header` navy `#1a315f` (constant masthead) |
| 5 | `nav-link-*` (a `default` link, e.g. `nav-link-news`) | `color` | `rgb(203, 213, 225)` | `--header-muted` `#cbd5e1` (inactive nav on the bar) — see note |

Assertion shapes for the tester (illustrative, tester owns final form):
```ts
await expect(page.getByTestId("nav-link-donate")).toHaveCSS("background-color", "rgb(243, 203, 54)");
await expect(page.getByTestId("nav-link-donate")).toHaveCSS("color", "rgb(26, 49, 95)");
// Forbidden-pair guard — must NOT be white on gold:
await expect(page.getByTestId("nav-link-donate")).not.toHaveCSS("color", "rgb(255, 255, 255)");
await expect(page.getByTestId("site-header")).toHaveCSS("background-color", "rgb(26, 49, 95)");
```

**Note on #5 (nav text color):** assert an **inactive** default link at a route where it is not
active. On `/`, no nav link is active (`slice-01-shell.md` QA NIT-02), so any `nav-link-*` default
link computes to `--header-foreground`? No — inactive default links use `--header-muted` `#cbd5e1`
= `rgb(203, 213, 225)`; the **active** one (only inside its own section) uses `--header-foreground`
white = `rgb(255, 255, 255)`. Pick one and assert deterministically: on `/`, `nav-link-news` is
inactive → `rgb(203, 213, 225)`. If the tester prefers the white-nav proof instead, navigate to
`/news` and assert `nav-link-news` `color` = `rgb(255, 255, 255)`. Either satisfies "nav text is
legible white/light on the navy bar"; specify one and keep it stable. Do not assert both states on
the same element at the same route.

### 4.2 Crest assertions (mandatory, tied to §3 / §5)

| # | Target (testid) | Assertion | Purpose |
|---|---|---|---|
| 6 | `site-brand-crest` | `toBeVisible()` | crest renders in the bar |
| 7 | `site-brand-crest` | `toHaveAttribute("alt", "")` | crest stays **decorative**; a future `alt="USVI Softball Federation"` that duplicates the link's accessible name **fails loudly** |
| 8 | `site-brand` | `toHaveText("USVI SOFTBALL FEDERATION")` (**existing**, line 74) | still passes — `alt=""` `<img>` adds no text |

### 4.3 Existing assertions — confirmed UNCHANGED

Full inventory of what the spec already asserts, and why each survives the reskin untouched:

| Assertion class (spec lines) | What it checks | Affected by reskin? |
|---|---|---|
| `getByTestId(...).toBeVisible()/toBeAttached()` (66–70, 114+) | landmarks/brand/nav present | No — structure unchanged |
| `site-brand` `toHaveText("USVI SOFTBALL FEDERATION")` (74) | wordmark text | No — crest is `alt=""`, adds no accessible text (§5) |
| `getByRole("main").toHaveCount(1)` (80) | single main landmark | No |
| `primary-nav` `toHaveAttribute("aria-label","Primary")` (87) | nav label | No |
| `navLinkOrder` equals the six testids (90) | DOM order | No |
| each `nav-link-*` `toHaveCount(1)` + `href` (97–99) | link identity/href | No |
| `aria-current="page"` present/absent (107, 136, 170, 233) | active state as an **attribute** | No — active is still an attribute; the new gold underline is CSS only, not asserted |
| route `status() === 200` + placeholder heading text (125–139) | routes resolve | No |
| desktop: six links visible, toggle hidden (191–194) | responsive visibility | No — breakpoints unchanged |
| mobile: toggle `aria-expanded` flip, links collapse/reveal (212–234) | responsive behavior | No |

None of the above 33 existing assertions checks a color, header background, nav text color, or
`aria-current` *styling* (all confirmed by reading all 236 lines) — so **no existing assertion
changes value**. The mandated color coverage is **additive** (§4.1–§4.2), not a rewrite.

### 4.4 Full `rgb()` reference (for QA spot-checks and any future assertion)

Every token → the exact `rgb()` Chromium reports, including tokens not in the mandatory set:

| Element / property | Old provisional value | New value (this slice) | Asserted? |
|---|---|---|---|
| Donate CTA `background-color` | `rgb(225, 25, 0)` (`#e11900`) | `rgb(243, 203, 54)` (`#f3cb36`) | §4.1 #1 |
| Donate CTA text `color` | `rgb(255, 255, 255)` (white) | `rgb(26, 49, 95)` (`#1a315f`) | §4.1 #2, #3 |
| Donate CTA `:hover` background | `rgb(179, 20, 0)` (`#b31400`) | `rgb(217, 176, 33)` (`#d9b021`) | no (hover) |
| Masthead `background-color` | `rgb(17, 17, 17)` (`#111111`) | `rgb(26, 49, 95)` (`#1a315f`) | §4.1 #4 |
| Nav text `color` (active) | `rgb(244, 244, 245)` | `rgb(255, 255, 255)` (white) | optional #5 |
| Nav text `color` (inactive) | `rgb(161, 161, 170)` | `rgb(203, 213, 225)` (`#cbd5e1`) | §4.1 #5 |
| Active-nav underline `border-color` | (none) | `rgb(243, 203, 54)` (`#f3cb36`) | no |
| Body text `color` | `rgb(10, 10, 10)` | `rgb(15, 23, 42)` (`#0f172a`) | no |

## 5. The crest in `SiteBrand` (`next/image`)

Add the crest as a decorative image to the left of the wordmark text inside the existing
`<Link href="/" data-testid="site-brand">`.

```tsx
import Image from "next/image";
// ...inside the Link, before the wordmark text:
<Image
  src="/brand/crest-sm.png"
  alt=""
  data-testid="site-brand-crest"
  width={128}
  height={120}
  loading="eager"
  className="h-8 w-auto sm:h-9"
/>
```

- **`src="/brand/crest-sm.png"`** — a real, pre-optimized asset already on disk
  (`public/brand/crest-sm.png`, 128×120 RGBA; the larger `crest.png` 512×480 is available if a
  higher-DPI source is wanted). Files under `public` are referenced from the base URL `/`
  (`node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` § "Local images").
- **`width={128} height={120}`** — a non-static-import string `src` **requires** explicit
  `width`/`height`; these are the asset's intrinsic pixels and only set the aspect ratio to reserve
  space / avoid layout shift — **rendered size is controlled by CSS**
  (`.../03-api-reference/02-components/image.md` § "width and height"). The `h-8 w-auto sm:h-9`
  class renders it at ~32–36px tall in the bar while preserving the 128:120 ratio.
- **`alt=""`** — the crest is **decorative**: the visible text `USVI SOFTBALL FEDERATION` right
  beside it is already the accessible name of the link, so the crest adds no information and would
  only produce a redundant/duplicated announcement. The images API doc endorses `alt=""` for a
  "purely decorative image that doesn't add any information"
  (`.../02-components/image.md` § "alt"). This is also why the `site-brand` `toHaveText(...)`
  assertion is unaffected — an empty-alt `<img>` contributes no text.
- **`loading="eager"` — NOT `priority`, NOT `preload`.** In **Next.js 16 the `priority` prop is
  deprecated** (`.../02-components/image.md` § "priority": *"Starting with Next.js 16, the
  `priority` property has been deprecated in favor of the `preload` property"*). `preload` is
  reserved for the **LCP / hero** image (same doc, § "preload"); a ~32px crest is neither the LCP
  element nor worth a `<head>` preload link. Because it *is* above the fold, use `loading="eager"`
  so it paints immediately with no lazy flash — the doc explicitly recommends `loading="eager"` (or
  `fetchPriority="high"`) over `preload` "in most cases." Do not set `priority` (deprecated) and do
  not set `preload` (over-eager for a tiny mark).
- **`data-testid="site-brand-crest"`** — `next/image` forwards unknown DOM props to the rendered
  `<img>`, so the testid lands on the actual image element. This is the one new testid (§3); the
  crest assertions in §4.2 select on it. It does **not** collide with `site-brand` (exact-match
  selection — see §3).
- **No `remotePatterns` needed.** `remotePatterns` in `next.config.ts` is only for **absolute
  external URLs** (`12-images.md` § "Remote images"). A local `/public` path is served directly and
  requires no image config. `next.config.ts` is untouched by this slice.

## 6. Typography — keep Oswald

**Recommendation: keep Oswald as `--font-display`; keep Geist as `--font-sans`.** The crest's own
lettering is a bold, italic, condensed sport face; Oswald is a bold condensed grotesque — the
closest self-hostable match to that register, already wired in `app/layout.tsx` and mapped to
`--font-display` in `@theme`. Swapping the display face would be scope creep on a pure reskin and
would risk the offline-build issue below. The upright-vs-italic difference is acceptable for a
UPPERCASE wordmark; if an italic sport face is ever wanted, that is its own scoped decision with its
own contrast/legibility pass, not part of this reskin.

> **Do not make the build-time font risk worse.** `next/font/google` fetches Oswald at **build
> time** (self-hosted thereafter), which fails on a network-less CI/Fly build. This is already
> logged as `slice-01-shell.md` §5 QA MIN-01 and deferred to `/actualize`. This slice **adds no new
> Google font** and changes nothing about font loading — leave the risk exactly where it is.

## 7. Out of scope (explicit)

- Article cards / the category eyebrow (slice-02) — **not touched here**. Its treatment is
  *decided* (navy-text-on-gold chip, recorded in `DESIGN.md` usage rule 6) but implemented by
  slice-02; this slice does not edit the slice-02 contract.
- Any new `data-testid` beyond `site-brand-crest` (§3), route, component, or page.
- `next.config.ts` (`turbopack.root`, `images.remotePatterns`) — untouched.
- Reinstating dark mode (light-only is canonical; reserve palette lives in `DESIGN.md`).
- Favicons, OG images, `apple-touch-icon` from the crest — future slice.
- The larger `crest.png` (512×480) as a hero/OG source — future slice.
- Chartreuse `#e6e647` and rust `#973b2d` — reserved, unassigned; do not use.

## 8. Resolved (previously open) — human decisions, 2026-07-09

All three questions this contract raised are now decided; recorded here so no downstream agent
relitigates them.

1. **Article-card category eyebrow (slice-02): RESOLVED — navy-text-on-gold chip** (`bg-accent
   text-accent-foreground`, 8.13:1), the same inversion as the Donate pill. Gold-on-white text
   (1.57:1) is banned. Canonicalized in `DESIGN.md` usage rule 6. Slice-02 implements it; this
   slice does not.
2. **Pin the brand with tests: RESOLVED — mandatory.** The human overrode the "pure reskin, no new
   test" default: because the slice's whole payload is color and CI cannot currently observe color,
   the assertions in §4.1–§4.2 are **required**, including the white-on-gold forbidden-pair guard.
3. **Dark mode: RESOLVED — dropped.** Ship light-only; the `@media (prefers-color-scheme: dark)`
   block is removed (§2). The complete dark palette stays in `DESIGN.md` as a labelled reserve;
   reintroducing it requires re-verifying the full contrast table (never a silent fallback).
