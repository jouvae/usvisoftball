# Home layout — Design guide

**Date:** 2026-10-21 · **Branch base:** `redesign` (PR #1) · **Inputs:** `softball-layout.jpeg`
(the comp) and [`assessment.md`](./assessment.md) (pros, cons and decisions).
**Binding for:** `app/(public)/page.tsx`, the public header and footer, `globals.css` tokens, and the
new home sections. Where this guide and `DESIGN.md` overlap, `DESIGN.md` still owns the
framework/stack rules and this guide owns the visual and home-page rules.

## 0. Decisions this guide encodes

| # | Decision | Effect |
|---|---|---|
| D1 | **Hybrid palette**: navy surfaces, royal interactive, gold accent | §1.1 token changes |
| D2 | **Nav:** Teams · Events · News · Get Involved · About + "Support the Federation" pill | §3.1 |
| D3 | **News slot = curated 3-up grid** (highlights first, filled with latest); the carousel is retired | §2.6 |
| D4 | **Unflag Teams + Events** as part of this feature | §4.2, §4.3 |
| D5 | **Stats strip = editor-managed table, built in this feature** | §4.1 |
| D6 | **Image-optional by default.** Every section ships a no-photo variant; photos upgrade it | §1.6, §6 |

The comp is used as the reference for **layout and art direction only**. None of its copy, numbers,
contact details or crest artwork is used. The crest file is `public/brand/crest.png`.

---

## 1. Foundations

### 1.1 Colour tokens (`app/globals.css` `:root` + `@theme inline`)

Keep the existing token names so PR #1 components keep working. **Change** three values and **add**
a navy family.

| Token | Value | Role | Change |
|---|---|---|---|
| `--navy` | `#0A2557` | Dark surfaces (hero scrim, team card panels, event band, footer), headings on light | **new** |
| `--navy-raised` | `#13336F` | Hover and raised surfaces on navy, dividers on navy | **new** |
| `--navy-foreground` | `#FFFFFF` | Text on navy | **new** |
| `--navy-muted` | `#C8D3EA` | Secondary text on navy | **new** |
| `--brand` | `#2A51C6` | **Interactive only:** text links, focus ring on light, active nav indicator | unchanged value, **narrowed role** |
| `--brand-hover` | `#1E3EA0` | Link hover | unchanged |
| `--accent` | **`#F7CF4F`** | Gold: primary buttons, rules, icons on navy, the Support pill | was lime `#E5E849` |
| `--accent-hover` | **`#E9BE35`** | Gold button hover | was `#D2D53B` |
| `--accent-foreground` | **`#0A2557`** | Text on gold (= navy) | was `#14245C` |
| `--surface` | `#F4F6FB` | Tinted light section (Get Involved) | unchanged |
| `--muted` | `#475569` | Secondary text on light | unchanged |
| `--focus` | `#2A51C6` on light / **`--accent` on navy** | Focus ring | context rule, §5 |
| `--primary` / `--ring` (shadcn) | `#2A51C6` | Keep in sync with `--brand` | unchanged |

Register `--color-navy`, `--color-navy-raised`, `--color-navy-foreground` and `--color-navy-muted` in
`@theme inline` so `bg-navy`, `text-navy-muted` and the rest exist.

**Measured contrast (WCAG 2.x):**

| Pair | Ratio | Use |
|---|---|---|
| navy on white | 14.8 | headings, body on light |
| white on navy | 14.8 | body on navy |
| navy-muted on navy | 9.9 | secondary text on navy |
| gold on navy | 9.9 | icons, rules, eyebrow text on navy |
| navy on gold | 9.9 | button labels |
| royal on white | 6.8 | links |
| royal on surface | 6.3 | links on the tinted section |
| muted on white | 7.6 | secondary text |
| **gold on white** | **1.5 ✗** | **never as text or icon on light.** Only as a fill or a decorative rule |

**Rules**
- **Gold is a fill or an ornament, never text on a light background.** The yellow heading rules on
  white are decorative (`aria-hidden`) and pass because they carry no information.
- **Royal is used only for interactive elements.** If royal appears and it isn't clickable, that's a
  bug. Headings use navy.
- There are only three blues: navy, navy-raised and royal. The comp's mid-blue "Read More" is
  replaced by royal.
- Photos may contain other blues (the jerseys). That's fine, because photos aren't tokens.

### 1.2 Typography

Two families, both already self-hosted (`app/layout.tsx`). **No third family.** The comp's script
footer line is dropped (§3.2).

| Role | Family | Style | Size (mobile → desktop) |
|---|---|---|---|
| Hero H1 | Oswald (`font-display`) | 700, UPPERCASE, `leading-[0.92]`, `tracking-tight` | `text-5xl` → `sm:text-6xl` → `lg:text-7xl` |
| Eyebrow | Oswald | 600, UPPERCASE, `tracking-[0.2em]` | `text-sm` → `sm:text-base` |
| Section H2 | Oswald | 700, UPPERCASE, `tracking-tight`, navy | `text-3xl` → `sm:text-4xl` |
| Band H2 (event) | Oswald | 700, sentence case, white | `text-3xl` → `lg:text-5xl` |
| Card title (H3) | Oswald | 600–700, sentence case | `text-xl` → `sm:text-2xl` |
| Stat value | Oswald | 700, navy | `text-5xl` → `sm:text-6xl` |
| Tagline | Geist (`font-sans`) | 600 | `text-lg` → `sm:text-xl` |
| Body | Geist | 400, `leading-relaxed` | `text-base` (hero blurb `sm:text-lg`) |
| Meta (date, category) | Geist / Oswald for category chips | 500 | `text-sm` |
| Button label | Oswald | 600, sentence case, `tracking-wide` | `text-sm` → `sm:text-base` |

The comp's condensed display face looks like Barlow Condensed. **Oswald is close enough, so we keep
it.** It's already vendored, and swapping it would restyle every page.

Keep measure readable: body copy `max-w-prose` (about 65ch); the hero blurb `max-w-xl`.

### 1.3 Layout grid & spacing

- **Container:** `mx-auto w-full max-w-6xl px-4 sm:px-6`, the same on every section and the
  header and footer, so edges line up.
- **Section rhythm:** `py-16 sm:py-20`. Bands (hero, event, footer) bleed to full width, and their
  inner content uses the container.
- **Grids:** `gap-6 lg:gap-8`. Two-up: `grid sm:grid-cols-2`. Three-up:
  `grid sm:grid-cols-2 lg:grid-cols-3`. For a three-up on `sm`, the third card spans both columns
  (`sm:col-span-2 lg:col-span-1`) so no card is orphaned.
- **Section order and surfaces:**

| # | Section | Surface |
|---|---|---|
| 1 | Hero | navy + photo |
| 2 | Stats strip | white with a faint island tint |
| 3 | Teams | white |
| 4 | Upcoming Event | navy band |
| 5 | Latest News | white |
| 6 | Get Involved | `surface` (tinted) |
| 7 | Footer | navy |

  This is a **change from the comp**, which put Get Involved before News (assessment C14). News is
  fresher content and sits closer to the top. Get Involved then hands off into the footer, and two
  white sections never run back to back.

### 1.4 Shape, elevation, borders

- **Radius:** cards and bands use `rounded-2xl` (matches `ArticleCard`). Buttons use `rounded-lg`.
  The comp's buttons are softly squared, not pills; the **Support pill in the nav stays
  `rounded-full`** to set it apart as the only pill.
- **Elevation:** light cards use `ring-1 ring-border` plus `shadow-sm`, with `hover:shadow-md` on
  interactive cards. There are no shadows on navy.
- **Borders on navy:** `border-white/10`.

### 1.5 Brand motifs

Each motif is a **reusable, decorative, `aria-hidden` component** in `components/ui/motifs/`.

| Motif | Component | Spec | Used in |
|---|---|---|---|
| Heading rule | `<AccentRule />` | `h-1.5 w-12 rounded-full bg-accent`. Left of the H2 on desktop, above it on mobile | every section header, hero, event band, footer tagline |
| Corner slash | `<CornerSlash corner="br" />` | A gold parallelogram (`clip-path: polygon(...)`), about 56×56, at a card or band corner | team cards (top-right of panel), hero (bottom-right) |
| Stripe edge | `<StripeEdge />` | Two diagonal bands (gold, then navy-raised), about 72px wide, on the band's right edge | event band |
| Footer swoosh | `<FooterSwoosh />` | An inline SVG curve: white page into navy, with a 4px gold stroke along it | top of the footer |
| Island silhouettes | `<IslandSilhouettes />` | **An SVG asset is needed:** an STT/STJ/STX outline, `fill-white/5` | footer (right), stats strip (faint) |

Keep it in check: **no more than 2 motifs visible in any viewport.** Motifs never sit under text.

### 1.6 Imagery (image-optional, D6)

Every photographic slot has a **no-photo variant** that looks finished on its own:

| Slot | With photo | Without photo (ships first) |
|---|---|---|
| Hero | Team photo, `object-cover`, focal point right; navy scrim gradient (§2.1) | Solid navy + `IslandSilhouettes` large at right, `fill-white/5`, + `CornerSlash` |
| Team card | Team photo 4:3 on top | Navy-raised block with the team's crest/logo if any, else a large Oswald monogram ("W" / "U18") in gold |
| Event band | Action photo right ~45% | Navy band + `StripeEdge` only; text uses full width |
| News card | Article cover (existing typographic covers count as "photo") | Existing `ArticleCard` dark base |
| Stats strip | none (dropped the comp's aerial photo — contrast risk C11) | — |

Photo rules: `next/image` only; hero is the **LCP** — `priority`, `sizes="100vw"`, `quality` 75;
everything else lazy with explicit `sizes`. Allowed hosts are the existing `remotePatterns`
(Supabase Storage). Alt text: describe the people/action ("USVI women's national team walking off
the field") — never "image of". Decorative backgrounds `alt=""`.

### 1.7 Iconography

`lucide-react` (already installed). Stroke 2, `size-6` in stat medallions / cards, `size-4` inline.
On navy: gold. On light: navy inside a navy-tint medallion (`bg-navy text-accent` circle, `size-14`)
— matches the comp. Icon set used: `Trophy`, `Medal`, `Award`, `Users`, `CalendarDays`, `MapPin`,
`Flag` (stands in for the comp's whistle, which lucide doesn't have), `Heart`, `ArrowRight`,
`Mail`, `Phone`, `Facebook`/`Instagram` stay as the current inline SVGs.

---

## 2. Home sections (top → bottom)

All sections: `<section aria-labelledby="…-heading">`, an `<h2 id>`, a stable `data-testid`.

### 2.0 Section header (shared component `SectionHeader`)

```
[▬]  OUR TEAMS                                      All teams →
```
- Props: `title`, `id`, `action?: { href, label }`, `tone?: "light" | "dark"`.
- Action label **names the destination** (assessment C6): "All teams", "All events",
  "All news", "Ways to get involved". Never a tagline.
- Mobile: rule stacks above the title; action drops below title, left-aligned.

### 2.1 Hero — `data-testid="home-hero"`

**Content**
- Eyebrow: `VIRGIN ISLANDS` (gold on navy).
- H1, two lines: `SOFTBALL` in **gold** and `FEDERATION` in **white**. The accessible name is the
  whole phrase: render "U.S. Virgin Islands Softball Federation" with `sr-only` for the parts that
  aren't visible, so the `<h1>` reads correctly to screen readers.
- `AccentRule`.
- Tagline: **"From the Virgin Islands to the World."**
- Blurb (≤ 3 lines on desktop): who we serve (athletes, coaches, officials across St. Thomas,
  St. Croix and St. John) and that we field national teams.
- **CTAs: a maximum of 2** (assessment C4):
  - Primary (gold): **Explore our teams** → `/teams`, `data-testid="hero-teams-cta"`.
  - Secondary (outline on navy, `border-white/40`): **Upcoming events** → `/events`,
    `data-testid="hero-events-cta"`.
  - "Support the Federation" is **not** in the hero; the nav pill carries it.

**Layout**
- Desktop (≥ lg): text column `max-w-xl`, left; photo fills the band. Band `min-h-[640px]`,
  vertically centred content, `pt` accounts for the sticky header.
- Scrim with a photo: `bg-gradient-to-r from-navy via-navy/85 to-navy/10` (lg),
  `bg-gradient-to-t from-navy via-navy/80 to-navy/20` (mobile). **Text never sits on an unscrimmed
  photo.** Verify contrast ≥ 4.5:1 at the darkest-photo point.
- Mobile: photo `object-position` right/centre and kept to the top ~40% under the gradient; text
  below; CTAs full-width stacked.
- `CornerSlash` bottom-right (desktop only).

**Crest overlap (comp feature, assessment C13).** On desktop at `scrollY === 0` the header crest is
large (about 96px) and overhangs the hero by about 32px. After scrolling it shrinks to the inline
32–36px mark. The header sets `data-scrolled` from a tiny client hook. Respect
`prefers-reduced-motion` and skip the transition. On mobile there is no overhang.

### 2.2 Stats strip — `data-testid="home-stats"`

**Data:** the `home_stats` table (§4.1), via `listPublishedStats()`. It takes the **first 3** by
`sort_order` and **hides the section entirely if there are 0**.

**Each stat has the same shape** (assessment C2): a medallion icon, a short label, a **value** and an
optional detail.
```
   (🏆)
 Women's National Team          ← label (Oswald 600, navy, text-lg)
      No. 32                    ← value (Oswald 700, navy, text-5xl/6xl), max 12 chars
 WBSC world ranking             ← detail (Geist, muted, text-sm), max ~40 chars
 as of Oct 2026                 ← as_of (Geist, muted, text-xs) — always shown
```
- An optional `source_url` makes the **detail** line a link (royal) to the source, for example the
  WBSC rankings page. This is credibility plus a self-service check.
- Layout: `grid sm:grid-cols-3`, centred text, `divide-x divide-accent/60` on sm+, with about 16px
  of vertical padding around the dividers. On mobile, a 1-column stack with `divide-y`.
- Surface: white, with `IslandSilhouettes` at about 4% opacity behind it. **No photo**.
- `<dl>` semantics: `<dt>` = label, `<dd>` = value + detail.

### 2.3 Teams — `data-testid="home-teams"`

**Data:** `listTeams({ kind: "national" })` (§4.2), ordered by `sort_order`, max 2–3. **Hide the
section if there are 0.**
- Header: **"Our Teams"**, action "All teams →" `/teams`.
- Card (`TeamFeatureCard`): photo or no-photo block (§1.6), 4:3 → **navy panel** with
  `CornerSlash` at the panel's top-right, title (Oswald, white), a 2–3 line description (navy-muted),
  and a gold button **"Meet the {short name}"**. Use the team's own name, not "Learn More"
  (assessment C7).
- The whole card is one link (`absolute inset-0` pattern, as in `ArticleCard`). The button is a
  visual affordance inside it, not a second link.
- Grid: 2-up on sm+. If a third national team exists, use 3-up on lg.

### 2.4 Upcoming Event band — `data-testid="home-event"`

**Data:** `getNextEvent()` (§4.3) returns the earliest event with `end_date >= today` (or no end
date) **by `start_date` ascending**. Note that `splitEventsByDate` sorts by `sort_order` first, so
don't reuse its first element. If there's no upcoming event, **hide the band** (assessment C9).
- Full-bleed navy band, `rounded-none`, with content in the container.
- Eyebrow `AccentRule` + "UPCOMING EVENT" (gold), H2 = event name (white, sentence case).
- Meta rows with gold icons: `CalendarDays` + a date range in `formatEventDateRange` (for example
  "Nov 21–28, 2026"); `MapPin` + venue/location. Use `<time dateTime>`.
- Gold button **"Event details"** → `/events/{slug}`.
- With a photo: the photo occupies the right ~45% (lg), masked with a left-edge gradient into navy.
  Mobile puts the photo on top at 16:9. `StripeEdge` sits on the right edge in both variants.
- **Content guard:** the event description and any linked detail page must never include travel
  itineraries, flight numbers or minors' arrival/departure details (see `softball-schedule.jpeg`;
  this is a safeguarding rule).

### 2.5 Latest News — `data-testid="home-news"`

**Data:** `listHomeNews(3)` (§4.4) returns highlights (`is_highlight`, newest first), then fills with
the latest published articles, de-duplicated, for exactly 3 when ≥3 exist. If there are 0, show the
existing empty state.
- Header: **"Latest News"**, action "All news →" `/articles`.
- Card: **reuse `ArticleCard`** (image-cover, category chip, byline, **date**). It already fixes
  assessment C8 (dates and categories) and C7 (the title is the link). Don't add the comp's
  white-body variant with "Read More". The overlay card is our established news pattern and works
  without photos.
- Grid: `sm:grid-cols-2 lg:grid-cols-3`; the 3rd card spans 2 on sm. The first card gets `priority`
  **only if** the hero has no photo (otherwise the hero is the LCP).
- `HighlightsCarousel` is **retired from the home page**. Delete it if nothing else uses it.

### 2.6 Get Involved — `data-testid="home-involved"`

**Data:** static copy in the component. No table yet.
- Surface `bg-surface`. Header **"Get Involved"**, action "Ways to get involved →"
  `/get-involved`.
- 3 cards, `bg-white ring-1 ring-border rounded-2xl`, centred, with a navy medallion icon, H3, 2–3
  lines and a gold button:

| Card | Icon | Button → |
|---|---|---|
| Athletes & Parents | `Users` | "Join the pathway" → `/get-involved#athletes` |
| Coaches, Umpires & Volunteers | `Flag` | "Volunteer with us" → `/get-involved#volunteers` |
| Support USVI Softball | `Heart` | "Support the Federation" → `PAYPAL_DONATE_URL` (external, `rel="noopener"`, visible ↗ icon + `sr-only` "(opens PayPal)") |

- Copy says **USVI**, never "ISV". This card is the **one** Support CTA in page content.
  The nav pill is the other.

### 2.7 Removed or not carried from the comp
- A third hero CTA, the duplicated Support CTAs, "Learn More"/"Read More" link text and tagline-as-link
  section actions.
- The stats strip's aerial photo background, the script font and the mid-blue link colour.
- Board grid: already moved to `/about` in PR #1. Board photos (incoming from the user) land there,
  not on home.

---

## 3. Global chrome

### 3.1 Header (`SiteHeader`, `PrimaryNav`, `SiteBrand`)

```
[crest] USVI SOFTBALL FEDERATION     Teams  Events  News  Get Involved  About   (♥ Support the Federation)
```
- Items, in order: **Teams** `/teams` · **Events** `/events` · **News** `/articles` · **Get Involved**
  `/get-involved` · **About** `/about`. The route stays `/articles`; only the label changes to
  "News".
- Test ids: keep `nav-link-articles` for News (renaming it breaks `shell-mvp` and `init-web-009`
  for no gain), keep `nav-link-about`, and add `nav-link-teams`, `nav-link-events` and
  `nav-link-involved`. Rename the Donate CTA's label to "Support the Federation" (show "Support"
  below `xl`) but **keep `nav-link-donate`**.
- Pill: `rounded-full bg-accent text-accent-foreground`, `Heart` icon, external → PayPal.
- The active item is navy text with a 2px gold underline **plus** `aria-current="page"`, so the
  underline isn't the only indicator.
- Shop: still gated by `SHOP_ENABLED`, and when on it's inserted before About.
- Breakpoints: full nav at **≥ lg (1024)**, which 5 items plus the pill fit. Below lg, use the
  existing toggle (`mobile-nav-toggle`) with the pill as the last full-width item in the sheet.
- The wordmark next to the crest uses navy, not royal (it isn't a link colour; it's the brand).
- The frosty treatment (`bg-white/70 backdrop-blur-md`) stays.

### 3.2 Footer (`SiteFooter`)

Navy, preceded by `FooterSwoosh`. Container grid `lg:grid-cols-[auto_1fr_1fr_1fr]`:

| Column | Content |
|---|---|
| Crest | `crest.png`, about 120px, links home |
| Contact | "CONTACT" eyebrow (Oswald, white). `Mail` email (`mailto:`), `MapPin` address, `Phone` (`tel:`), **all from `contact_info`**. Omit any empty field |
| Explore | The same 5 nav links (footer sitemap, which the comp lacked) |
| Follow | Facebook + Instagram from `contact_info` via `safeSocialHref` (current behaviour). Add YouTube only if a `youtube_url` column is added later; it is out of scope now |

Then a full-width row with the tagline **"From the Virgin Islands to the World."** in Oswald 500,
sentence case, white, preceded by an `AccentRule`, plus `IslandSilhouettes` on the right.
Bottom bar: `© {currentYear} U.S. Virgin Islands Softball Federation` (keep the dynamic year).
**No Privacy/Terms links until those pages exist.** Dead links are worse than none.

Mobile: everything stacks in a single column, left-aligned, with the crest on top.

---

## 4. Data & backend work

Migrations follow the existing pattern (additive, replayable, numbered, RLS: anon read, editor
write). See `0010_contact_info.sql` / `0015_teams_admin.sql`.

### 4.1 `0023_home_stats.sql` + admin editor (D5)

```sql
create table if not exists public.home_stats (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (char_length(label) between 1 and 40),
  value        text not null check (char_length(value) between 1 and 12),
  detail       text not null default '' check (char_length(detail) <= 60),
  icon         text not null default 'trophy'
               check (icon in ('trophy','medal','award','users','calendar','flag')),
  as_of        date not null,
  source_url   text,
  sort_order   int  not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- RLS: anon/authenticated SELECT only where is_published; editors full CRUD (0007/0015 pattern).
```
- `lib/stats.ts`: `listPublishedStats()` (public client, `is_published` order `sort_order` limit 3)
  and `listAllStats()` / `createStat` / `updateStat` / `deleteStat` for editors.
- `source_url` is validated https-only at write **and** at render (same defence-in-depth as
  `safeSocialHref`).
- Admin: `app/admin/(protected)/stats/page.tsx`, a list plus a form (label, value, detail, icon
  select, as-of date, source URL, order, published toggle). Add it to the admin nav. On save,
  `revalidatePath("/")`.
- **No seed rows.** The strip stays hidden until an editor publishes verified figures. This is also
  the fix for the unverified "No. 32" and "2026 CAC Silver" in the comp.

### 4.2 Teams: national teams (D4)

The `teams` table today models **island clubs**, and it's **seeded with sample clubs**
(Frenchtown Sluggers etc., `0013_teams.sql`). The home section needs **national teams**.
- `0024_team_kind.sql`: add `kind text not null default 'club' check (kind in ('club','national'))`,
  `cover_image_url text not null default ''` and `short_name text not null default ''` (for the "Meet
  the …" button). Make `island` nullable for national teams (relax the check to
  `island is null or island in (…)`).
- `listTeams` gains an optional `{ kind }` filter. `/teams` renders **National teams** first, then
  clubs grouped by island (existing `groupTeamsByIsland`). Admin team form gains kind, short name
  and cover.
- Content: the editor creates *Women's National Team* and *U18 Girls' National Team*.

### 4.3 Events (D4)

- `0025_event_cover.sql`: `cover_image_url text not null default ''`.
- `lib/events.ts`: add `getNextEvent()` (§2.4 ordering) and `formatEventDateRange`.
- Content: the editor creates *2026 U-18 Women's Pan American Championship*, Nov 21–28, 2026, San
  Salvador, El Salvador, with no itinerary details.

### 4.4 Articles
- `lib/articles.ts`: `listHomeNews(limit = 3)` (§2.5). It reuses `listHighlightedArticles` +
  `listPublishedArticles`, or one query ordered `is_highlight desc, published_at desc`.

### 4.5 ⚠️ Pre-unflag gate: purge the sample rows

`0013_teams.sql` and `0017_events.sql` **seed placeholder rows** ("Sample Territorial Championship"
dated 2099, fictional clubs). The DB is shared with prod. **Before** turning on
`NEXT_PUBLIC_TEAMS_ENABLED` / `NEXT_PUBLIC_EVENTS_ENABLED` in Fly:
1. Delete the sample rows (by slug) and their `event_teams` links, and check `team_players` for
   seeded players.
2. Remove or neutralise the seed `insert`s in those migrations so a replay doesn't bring them back.
3. Make sure the e2e specs for teams and events seed their **own** fixtures and clean them up. The
   same prod-DB hazard as `init-web-001/002` applies (see the redesign status).
4. Enter the real national teams and the event (§4.2, §4.3).
5. Then flip both flags in the Fly env and redeploy. Flags are inlined at build (`NEXT_PUBLIC_*`), so
   this needs a rebuild, not just a restart.

### 4.6 New route
- `app/(public)/get-involved/page.tsx` is static. It has three anchored sections (`#athletes`,
  `#volunteers`, `#support`), each with 1–2 paragraphs, a contact CTA (`mailto:` from
  `contact_info` with a prefilled subject) and Support → PayPal. The copy is drafted and the
  Federation should review it.

---

## 5. Accessibility checklist (blocking for the home slice)

- [ ] One `<h1>` (hero). Section `<h2>`s in order, card `<h3>`s.
- [ ] Every card is **one** link, and its accessible name is the title. No repeated "Learn/Read
      More".
- [ ] Focus ring: `outline-2 outline-offset-2`, **royal on light and gold on navy**, and visible on
      every interactive element, including the Support pill (navy ring on gold).
- [ ] Contrast measured on the real hero photo's worst region (≥ 4.5:1 body, ≥ 3:1 large text).
- [ ] The external PayPal link is announced ("opens PayPal").
- [ ] Motif components are `aria-hidden="true"` and never interactive.
- [ ] `prefers-reduced-motion`: no crest shrink animation and no card hover scale.
- [ ] Target size ≥ 44×44 for buttons and nav items on touch.
- [ ] `<time dateTime>` on article and event dates; `<dl>` for stats.

## 6. Performance checklist

- [ ] The hero photo is the only `priority` image when present; otherwise the first news card is.
- [ ] Every `next/image` has explicit `sizes`. No CSS `background-image` photos, so the browser can
      prioritise and size them.
- [ ] Motifs are inline SVG or CSS, so they add no requests. `IslandSilhouettes` is a single SVG
      reused via `<use>` or a component.
- [ ] The home page stays `force-dynamic` (it reads the DB). Every section's data loads in **one
      `Promise.all`** so the page doesn't fetch in a waterfall.
- [ ] No new fonts.

## 7. Photo brief (for the board)

The no-photo variants ship first. These photos upgrade them when they're supplied (landscape, ≥ 2400px
wide, uploaded through the admin):

| Slot | Shot | Notes |
|---|---|---|
| Hero | A national team group, in motion or celebrating, USVI kit | Subjects in the **right ~60%**; left side quieter for text |
| Women's National Team card | A posed team photo | 4:3 crop-safe |
| U18 Girls' team card | A posed team photo | 4:3; **parental consent** for minors on file |
| Event band | A single action shot (batter or pitcher) | Subject on the right; 16:9 mobile crop-safe |
| Board (on `/about`, not home) | Headshots | Already planned by the user |

Every photo needs a credit or consent record. Never publish minors' names together with travel
details.

## 8. Implementation slices (each one verified in the browser at 1440 / 820 / 390)

1. **Tokens + motifs + chrome:** `globals.css` (§1.1), motif components (§1.5), `SectionHeader`,
   button variants (gold primary, outline-on-navy, outline-on-light) in `components/ui/button.tsx`
   via `cva`, plus the header nav (§3.1) and footer (§3.2). This re-skins every page, so walk
   `/articles` and `/about` as well.
2. **Hero + Get Involved + `/get-involved`:** static content only, no data dependencies.
3. **News grid:** `listHomeNews`, retire the carousel, and update `home-highlights.spec.ts` to assert
   highlights-first ordering in the grid.
4. **Stats:** migration, `lib/stats.ts`, the admin editor and the strip (hidden when empty).
5. **Teams + Events:** migrations, `getNextEvent`, home sections and the `/teams` national-first
   layout, then the **§4.5 gate** and the flag flip.

**Test impact:** `hero-articles-cta` is replaced by `hero-teams-cta` and `hero-events-cta`. Check
`shell-mvp.spec.ts`, `init-web-009.spec.ts` and `home-highlights.spec.ts`. Nav test ids are kept
(§3.1). Run only targeted specs (`-g`) until e2e is pointed at a non-prod DB.
