# DESIGN.md — Frontend source of truth (softball)

This is the frontend contract for the USVI Softball Federation platform. `nextjs-tester`
and `nextjs-implementer` both hard-require this document. It is written **for this repo** —
a standalone Next.js 16 App Router app — not for any other platform.

- **Stack (locked in Empathize):** Next.js **16.2.10** (App Router, Turbopack) · React **19.2.4** ·
  Tailwind CSS **v4** (CSS-first `@theme`, **no `tailwind.config.js`**) · TypeScript.
- **Not yet installed / out of scope for the current slice:** Supabase, Stripe, shadcn/ui.
- **Deploy target:** Fly.io.

---

## Inherited-rules disclaimer (lesson L-init-01)

`.opencode/rules/*`, `.opencode/agents/*`, `.claude/rules/data.md`, and `AGENTS.md`'s Go/GORM
guidance were inherited from the unrelated **Jouvae** Go/gRPC/SpiceDB/GORM monorepo. On this
repo they are **reference-only** and mostly do not apply. Specifically, in this repo there is:

- **No** Go, gRPC, protobuf, GORM, SpiceDB, `.zed` schema, Dorothy/Fiber gateway, or
  `libs/go/postgres/migrations` package.
- **No** `src/` directory and **no** `clients/web/` — `app/` lives at the **repo root**.
- **No** `useApis`, `serverApiClient`, or `apiClient` abstraction. Those are Jouvae concepts
  and must not be invented here.

The one part of `AGENTS.md` that **does** bind: *"This is NOT the Next.js you know … Read the
relevant guide in `node_modules/next/dist/docs/` before writing any code."* Obey it. Every
framework claim below is grounded in those bundled docs and cited by path.

---

## Directory structure

Next.js is unopinionated about non-route file placement
(`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` §"Organizing
your project"). We use the **"store project files outside of `app`"** strategy from that doc:
`app/` is for routing only; shared components live in root-level folders.

```
app/                       # routes ONLY (App Router). Root of the app tree.
  layout.tsx               # root layout (Server Component) — html/body, fonts, header/footer shell
  globals.css              # Tailwind v4 entry + @theme design tokens
  page.tsx                 # "/" home
  news/page.tsx            # "/news"    (placeholder this slice)
  teams/page.tsx           # "/teams"   (placeholder)
  events/page.tsx          # "/events"  (placeholder)
  about/page.tsx           # "/about"   (placeholder)
  shop/page.tsx            # "/shop"    (placeholder)
  donate/page.tsx          # "/donate"  (placeholder)
components/
  ui/                      # stateless / presentational (Server Components by default)
  client/                  # components that require "use client" (state, events, browser APIs)
lib/                       # (future) server-side data helpers; empty for now
```

- Route files map folders → URL segments; a segment is only public once it has `page.tsx`
  (project-structure.md §"Colocation").
- The `@/*` TypeScript alias maps to the **repo root** (`tsconfig.json` → `"@/*": ["./*"]`),
  so import components as `@/components/ui/site-header`, `@/components/client/primary-nav`.
- Folder naming (`components/ui`, `components/client`) is our convention, not a framework one
  — the docs explicitly note `components`/`lib` are placeholders with "no special framework
  significance" (project-structure.md §Examples). We split by **render environment** so the
  server/client boundary is legible at a glance.

## Server vs Client Components

**Server Components are the default. Add `"use client"` only when a component needs one of:**
state or event handlers, lifecycle hooks (`useEffect`), browser-only APIs (`window`,
`localStorage`), or a client hook such as `usePathname`
(`05-server-and-client-components.md` §"When to use Server and Client Components?").

Rules for this repo:
- Put the `"use client"` boundary **as low as possible**. A layout of mostly static UI with one
  interactive island keeps the island client and the rest server
  (05-server-and-client-components.md §"Reducing JS bundle size").
- A Server Component may render a Client Component as a child, and may pass a Server Component
  into a Client Component via `children`/props (same doc, §"Interleaving"). Use this to keep the
  header, brand, footer, and pages as Server Components even when they contain a client nav.
- `metadata` / `generateMetadata` exports are **only** valid in Server Components
  (`14-metadata-and-og-images.md`). Never put them in a `"use client"` file.
- Anything imported by a `"use client"` file is pulled into the client bundle
  (05-server-and-client-components.md §"Using Client Components"). Keep client subtrees small.

## Data fetching

- **This slice fetches nothing.** All screens are static/presentational.
- **When Supabase lands (future slice):** Server Components read data through a **server-side
  supabase client** close to the source (05-server-and-client-components.md §"Use Server
  Components when you need … Fetch data from databases or APIs close to the source"). Client
  Components that need server data go through **Next.js Route Handlers** under `app/api/*`
  (`route.ts`, listed in project-structure.md §"Routing Files").
- **Raw `fetch` from a Client Component to an external/DB endpoint is banned.** Secrets must
  not reach the client; only `NEXT_PUBLIC_`-prefixed env vars are exposed
  (05-server-and-client-components.md §"Preventing environment poisoning"). Use `server-only`
  to fence server modules when that slice arrives.
- **Deferred decision:** whether to wrap data access in a typed client abstraction is a
  question for the data slice. Do **not** invent a `useApis`/`serverApiClient` layer now.

## Component authoring conventions

- **`data-testid` is mandatory** on every observable or interactive element. Playwright selects
  on it; it is a hard contract, not decoration. Per-slice `data-testid` tables are the source of
  truth (see `docs/features/softball/init/slice-01-shell.md`).
- Every component accepts a `className?: string` prop and merges it onto its root element, so
  callers can adjust layout without forking the component.
- Prefer composition: expose `children` / named slot props over hardcoding content.
- Keep components typed; use the generated `PageProps<'/route'>` / `LayoutProps<'/route'>`
  global helpers for route files (03-layouts-and-pages.md §"Route Props Helpers") — they are
  ambient (no import) and generated by `next dev` / `next build` / `next typegen`.

## Styling — Tailwind CSS v4 (CSS-first)

- Tailwind v4 is configured **entirely in CSS**. There is **no `tailwind.config.js`**. The entry
  is `app/globals.css` with `@import "tailwindcss";` and the PostCSS plugin
  `@tailwindcss/postcss` in `postcss.config.mjs` (11-css.md §"Tailwind CSS"; matches the current
  repo setup).
- **Design tokens are declared as CSS custom properties inside `@theme`** in `app/globals.css`.
  Colors declared as `--color-<name>` become utilities (`bg-<name>`, `text-<name>`,
  `border-<name>`); fonts declared as `--font-<name>` become `font-<name>`.
- Light/dark values live in `:root` and a `@media (prefers-color-scheme: dark)` block and are
  wired into Tailwind via `@theme inline { --color-*: var(--*) }` — the pattern already present
  in `app/globals.css`. Keep that pattern; extend it with the tokens in the slice contract.
- Global CSS is for **truly global** base styles only; component styling goes through Tailwind
  utilities; use CSS Modules only when utilities are insufficient (11-css.md §Recommendations).
- **shadcn/ui is NOT installed and must NOT be introduced** in the shell slice. If a component
  library is ever wanted, it is a separate, explicitly-scoped decision.

## Fonts

- Use `next/font` (`13-fonts.md`). It self-hosts fonts as static assets — no runtime request to
  Google, no layout shift. Configure fonts in the **root layout** (a Server Component) and expose
  them as CSS variables via the `variable` option, then map them into `@theme`.
- Body copy uses a sans (`--font-sans`). The sports-editorial **wordmark and display headings**
  use a condensed display face exposed as `--font-display` (see slice contract for the concrete
  choice and the body-font reconciliation).

## Brand & design tokens

> **Authoritative since 2026-07-09.** This section is the single source of truth for color, type,
> and their usage rules. It **supersedes** the provisional near-black/red palette in
> `docs/features/softball/init/slice-01-shell.md` §1. The concrete reskin contract (files, exact
> CSS block, e2e delta) lives in `docs/features/softball/init/slice-01b-brand.md`.

### Brand story

The USVI Softball Federation runs on **navy and gold** — the two colors that dominate the
Federation crest (navy `#1a315f` is 48% of it, gold `#f3cb36` a further 24%) and the colors the
teams actually wear on the field. The system puts that brand on a **white, bright, vibrant field**:
navy carries structure (masthead, headings, body), gold is a scarce "act now / you are here"
signal (the Donate CTA plus a small set of wayfinding marks), and everything else is navy or slate
on white.

### The inversion vs slice 01 (why the rules changed)

Slice 01 used a near-black masthead with a red accent and proved a hard constraint: on `#111`, one
color cannot be **both** legible as text **and** carry white text as a fill. Navy/gold has **no**
such conflict — gold reads on navy at 8.13:1, navy reads on white at 12.74:1, and gold carries
**dark** text at 13.41:1. The single hard color rule that survives is the mirror image of the old
one: **gold must never carry white text** (1.57:1 — a severe failure). Gold carries **navy** text;
navy and slate carry white or gold.

### Contrast method (stated, so every ratio below is reproducible)

WCAG 2.x relative-luminance formula. Per channel `V∈[0,255]`: `v=V/255`; `c = v/12.92` if
`v≤0.03928`, else `c=((v+0.055)/1.055)^2.4`. `L = 0.2126·R + 0.7152·G + 0.0722·B` on the linearized
channels. Contrast ratio `= (L_light+0.05)/(L_dark+0.05)`. AA thresholds: **4.5:1** normal text,
**3:1** large text (≥24px, or ≥18.66px bold) and non-text UI boundaries (WCAG 1.4.3 / 1.4.11).

### Semantic token table (canonical = LIGHT)

Follows the existing `:root` / `@theme inline` structure in `app/globals.css`. **The light column
is _the_ column** — it is what ships. The **Dark (reserve)** column is an explicitly-labelled,
**unused** palette retained only so a future reintroduction is safe. Reintroducing dark mode is a
**deliberate, documented change** that requires the full contrast table below to be **re-verified**
against the reserve values before shipping — it is never a silent fallback.

| CSS var | Tailwind utility | Light value | Dark (reserve) | Role |
|---|---|---|---|---|
| `--background` → `--color-background` | `bg-background` | `#ffffff` | `#0b1220` | Page background (white canonical) |
| `--foreground` → `--color-foreground` | `text-foreground` | `#0f172a` | `#e6ecf5` | Body text |
| `--brand` → `--color-brand` | `text-brand` `bg-brand` `border-brand` | `#1a315f` | `#e6ecf5` | Navy — headings, footer wordmark, links, on-white structure |
| `--brand-hover` → `--color-brand-hover` | `bg-brand-hover` | `#0c203c` | `#cbd5e1` | Navy hover/darken (deep-navy crest outline) |
| `--surface` → `--color-surface` | `bg-surface` | `#f5f7fa` | `#131c2e` | Card / placeholder fill |
| `--border` → `--color-border` | `border-border` | `#e2e8f0` | `#24314a` | Hairline borders |
| `--muted` → `--color-muted` | `text-muted` | `#475569` | `#9fb0c9` | Secondary text |
| `--header` → `--color-header` | `bg-header` | `#1a315f` | `#1a315f` | Masthead bar (**constant navy**) |
| `--header-foreground` → `--color-header-foreground` | `text-header-foreground` | `#ffffff` | `#ffffff` | Nav text (**constant**) |
| `--header-muted` → `--color-header-muted` | `text-header-muted` | `#cbd5e1` | `#cbd5e1` | Inactive nav text (**constant**) |
| `--header-hover` → `--color-header-hover` | `bg-header-hover` | `#24427a` | `#24427a` | Nav hover surface on masthead (**constant**) |
| `--accent` → `--color-accent` | `bg-accent` | `#f3cb36` | `#f3cb36` | **Gold** — Donate/CTA + signals (**constant**) |
| `--accent-foreground` → `--color-accent-foreground` | `text-accent-foreground` | `#1a315f` | `#1a315f` | **Navy** text on gold (**constant** — the inversion) |
| `--accent-hover` → `--color-accent-hover` | `bg-accent-hover` | `#d9b021` | `#d9b021` | Gold hover/active (darker gold, **constant**) |
| `--focus` → `--color-focus` | `outline-focus` `ring-focus` | `#3b82f6` | `#60a5fa` | Focus ring (meets 3:1 on white **and** navy) |

`--font-sans` (Geist) and `--font-display` (Oswald) are unchanged from slice 01 — see Fonts above
and the recommendation in `slice-01b-brand.md`.

### Measured contrast table (every pair the UI actually uses)

| Pair | Ratio | AA verdict |
|---|---|---|
| `foreground` `#0f172a` on `background` `#ffffff` (body) | 17.85:1 | PASS |
| `brand` `#1a315f` on `background` `#ffffff` (headings/links) | 12.74:1 | PASS |
| `muted` `#475569` on `background` `#ffffff` | 7.58:1 | PASS |
| `brand` `#1a315f` on `surface` `#f5f7fa` | 11.87:1 | PASS |
| `muted` `#475569` on `surface` `#f5f7fa` | 7.06:1 | PASS |
| `header-foreground` `#ffffff` on `header` `#1a315f` (nav text) | 12.74:1 | PASS |
| `header-muted` `#cbd5e1` on `header` `#1a315f` (inactive nav) | 8.58:1 | PASS |
| `accent` `#f3cb36` on `header` `#1a315f` (gold signal / active underline) | 8.13:1 | PASS |
| `accent-foreground` `#1a315f` on `accent` `#f3cb36` (Donate label) | 8.13:1 | PASS |
| `accent-foreground` `#1a315f` on `accent-hover` `#d9b021` (Donate hover) | 6.18:1 | PASS |
| `header-foreground` `#ffffff` on `header-hover` `#24427a` (nav hover) | 9.83:1 | PASS |
| `accent` `#f3cb36` on `header-hover` `#24427a` | 6.28:1 | PASS |
| `focus` `#3b82f6` vs `background` `#ffffff` (ring on white) | 3.68:1 | PASS (UI 3:1) |
| `focus` `#3b82f6` vs `header` `#1a315f` (ring on navy) | 3.46:1 | PASS (UI 3:1) |
| `border` `#e2e8f0` on `background` `#ffffff` (hairline) | 1.23:1 | N/A — decorative separator, WCAG 1.4.11 exempt |
| **`#ffffff` on `accent` `#f3cb36` (white-on-gold)** | **1.57:1** | **FAIL — forbidden, never emit** |

### Hard usage rules

1. **Gold never carries white text.** White-on-gold is 1.57:1. Text on any gold fill is
   `accent-foreground` (navy `#1a315f`). This is the one inviolable color rule.
2. **Gold is an accent, never a section surface.** Gold fills the Donate CTA and a small number of
   signals (active-nav underline, article-card category eyebrow, section rules). It is **not** a
   background fill for sections and **not** a card-hover tint. Target ≈4 gold appearances per
   screen — scarcity is what makes "gold = act now / you are here" legible.
3. **The masthead is constant navy** (`--header` `#1a315f`) across light and dark. Nav text is
   constant white; the Donate pill is constant gold with navy text.
4. **The accent's meaning is "act now" (Donate/CTA) plus wayfinding.** It never decorates.
5. **Gold as small text on a light field is banned** (gold-on-white 1.57:1, gold-on-surface
   1.46:1). Any "gold" signal on white must be realized as a **shape** (a rule, an underline, or a
   navy-text-on-gold chip at 8.13:1), never as gold-colored text.
6. **The article-card category eyebrow (slice-02) is a navy-text-on-gold chip** — `bg-accent
   text-accent-foreground` (navy `#1a315f` on gold `#f3cb36`, 8.13:1), the same inversion as the
   Donate pill. It is **never** gold text on the card's white/`surface` background (1.57:1 / 1.46:1
   — unusable). Resolved 2026-07-09; the slice-02 implementer follows this and does not relitigate.

### Derived tokens (defined + justified)

- **`--accent-hover` `#d9b021`** — gold darkened ~10% luminance. Keeps navy text at **6.18:1**
  (≥4.5 required) and is visibly distinct from `#f3cb36`, so the hover/active state reads. Still
  fails white-on-hover (rule 1 holds).
- **`--header-hover` `#24427a`** — navy lightened for a nav-item hover surface on the masthead.
  White stays **9.83:1**, gold **6.28:1**; both pass.
- **`--brand-hover` `#0c203c`** — the crest's own deep-navy outline, used to darken navy
  buttons/links on the white field. White-on-`#0c203c` exceeds white-on-navy (>12.74:1).
- **`--surface` `#f5f7fa`** — a cool off-white for cards/placeholders; navy 11.87:1, muted 7.06:1.
- **`--border` `#e2e8f0`** — slate-200 hairline. At 1.23:1 it is a **decorative** separator
  (1.4.11 exempt). Any border that conveys state (e.g. a future input outline) must switch to a
  ≥3:1 value — do not reuse `--border` for that.
- **`--muted` `#475569`** — slate-600 secondary text, 7.58:1 on white.
- **`--focus` `#3b82f6`** — a real dual constraint: a focus ring appears on both the white field
  and the navy masthead, so it must clear **3:1 against both**. `#3b82f6` measures **3.68:1** vs
  white and **3.46:1** vs navy — the narrow band that satisfies both (navy candidates like
  `#1d4ed8` pass white but fail navy at 1.90:1; gold passes navy but fails white at 1.57:1). It is
  deliberately blue — not a brand color — so it reads unambiguously as "focus," not decoration.

### `#e6e647` (chartreuse) and `#973b2d` (rust): held in reserve

Both stay in the brand record **unassigned**. Chartreuse is a near-hue twin of gold (and fails on
white even harder than gold, ~1.3:1) — giving it a role would create two competing yellows and
dilute the single gold signal. Rust is the softball's stitch detail (1.2% of the crest) and reads
as an earthy red that would collide with a future error/danger semantic. Neither earns a token
until a concrete need arrives **with its own contrast check**. Do not invent uses.

### Dark mode — DROPPED (light-only). Human decision, 2026-07-09.

**The canonical build ships light-only. The `@media (prefers-color-scheme: dark)` block is
removed** from `app/globals.css` (see the token block in `slice-01b-brand.md` §2). The human made
white the canonical, "bright and vibrant" background, and the brand is defined on a white field; a
half-committed dark theme is exactly the "silent degrade" risk to avoid. With no `@media` block
there is exactly **one** scheme, fully legible for everyone — a dark-OS user gets the intended
white site, not a broken inversion. The masthead was already constant navy, so nothing flips.

The **Dark (reserve)** column in the token table is a **complete, fully-passing** palette retained
**unused**, only so reintroduction is safe. **Reintroducing dark mode is a deliberate, documented
change** — whoever does it MUST re-verify the **entire** contrast table against the reserve values
(and add the dark-only pairs below) before shipping; it is never a silent fallback. For the record,
those reserve pairs already measure: fg `#e6ecf5` on bg `#0b1220` 15.76:1; muted `#9fb0c9` on bg
8.49:1; gold on bg 11.95:1; gold on surface `#131c2e` 10.87:1; focus `#60a5fa` 7.36:1 vs bg /
5.01:1 vs navy; masthead/accent constant (unchanged from light). The navy masthead vs dark bg is
only 1.47:1, so in dark mode the header **must** carry a `border-border` hairline to separate from
the page — it no longer separates by contrast alone.

## Metadata

- Define static site metadata with the `metadata` object export from the **root layout**
  (`14-metadata-and-og-images.md` §"Static metadata"). Charset and viewport tags are injected
  automatically (§"Default fields") — do not hand-write them.
- The create-next-app default title/description ("Create Next App") must be replaced with the
  Federation's. OG/favicon files are out of scope for the shell slice.

## Next.js 16 breaking changes / conventions a developer here MUST know

Grounded in the bundled docs read for this slice:

1. **`params` and `searchParams` are async (`Promise`).** In pages/layouts they must be
   `await`ed: `const { slug } = await params`
   (03-layouts-and-pages.md §"Creating a dynamic segment", §"Rendering with search params").
   The shell's placeholder pages take no params, but any dynamic route added later must await.
2. **Typed route-props helpers `PageProps` / `LayoutProps` are ambient globals**, generated by
   `next dev` / `next build` / `next typegen` — no import (03-layouts-and-pages.md §"Route Props
   Helpers"). Prefer them over hand-rolled prop types.
3. **`proxy.ts` replaces `middleware.ts`** as the request-proxy file convention
   (02-project-structure.md §"Top-level files" lists `proxy.ts`, "Next.js request proxy"). Not
   needed for the shell, but relevant when auth arrives.
4. **`<Link>` is a Client Component** and auto-prefetches routes that enter the viewport
   (04-linking-and-navigating.md §Prefetching). It can still be rendered from Server Components.
   Use `<Link>` for internal navigation; a bare `<a>` opts out of prefetch/client transitions.
5. **`metadata` / `generateMetadata` are Server-Component-only** (14-metadata-and-og-images.md).
6. **Sticky/fixed header + client-side scroll restoration:** Next.js scrolls to top on client
   transitions; if content hides behind a sticky header, fix with CSS `scroll-padding-top`
   (04-linking-and-navigating.md §"Client-side transitions").
7. **React context / providers must be Client Components** — context is unsupported in Server
   Components; wrap in a `"use client"` provider rendered from a layout
   (05-server-and-client-components.md §"Context providers"). Not needed this slice.
