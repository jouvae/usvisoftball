# Home layout — UX & design assessment of `softball-layout.jpeg`

**Date:** 2026-10-21 · **Source:** `softball-layout.jpeg` (repo root, untracked, 533×1600 — a
downscaled desktop comp, ~1440px original) · **Purpose:** the base for the home page layout. This
assessment feeds the design guide (next step).

> The comp is AI-generated: there are artifacts in it (the footer crest reads "SOFBALL", there is a
> "DX VIRGIN ISLANDS" banner, and "ISV Softball" appears where USVI is meant). Treat it as a **layout and
> art-direction reference**, not as copy, data, or a logo file.

---

## 1. Anatomy (top → bottom)

| # | Section | Surface | Content | Primary action |
|---|---|---|---|---|
| 0 | Nav bar | white | crest (overlaps into hero) · 8 links · yellow pill "♥ Support the Federation" | Support |
| 1 | Hero | full-bleed photo, navy scrim on the left | eyebrow "VIRGIN ISLANDS", H1 "SOFTBALL" (yellow) / "FEDERATION" (white), yellow rule, tagline, 3-line blurb | Explore Our Teams · Upcoming Events · Support the Federation |
| 2 | Proof strip | washed-out aerial island photo | 3 stats with icons in navy circles, yellow vertical dividers | none |
| 3 | Our National Teams | white | 2 photo cards: photo on top, navy text panel, yellow corner slash | Learn More ×2 · "Representing Our Islands →" |
| 4 | Upcoming Event band | navy → photo (batter), diagonal yellow/navy stripes | eyebrow, event name, date + location rows with icons | Event Details |
| 5 | Get Involved | white | 3 bordered cards, each with a navy icon, centred text and a yellow button | Learn More · Get Involved · Support the Federation · "Stronger Together →" |
| 6 | Latest News | white | 3 cards: photo, title, 4–5 line excerpt, "Read More →" in a lighter blue | Read More ×3 · "More News →" |
| 7 | Footer | navy, curved top edge with a yellow swoosh, island silhouettes | crest · Contact Us · Follow Us (FB, YouTube) · script tagline · © + Privacy / Terms / Contact | none |

**Rhythm:** dark (hero) → light (proof) → white, with navy cards → **dark** (event) → white →
white → dark (footer). The page alternates between light and dark surfaces almost the whole way
down. The one break is Get Involved followed by News, two white sections in a row.

**Section header pattern:** a short yellow bar, an UPPERCASE condensed navy heading, and a
right-aligned "label →" link. This repeats consistently, which is one of the comp's best features.

**Sampled palette** (JPEG-sampled, so ±):

| Role | Comp | Shipped token (PR #1) |
|---|---|---|
| Primary dark (cards, bands, footer) | **navy ≈ `#002557`** | none; the brand is royal `#2A51C6` |
| Accent (buttons, rules, icons) | **golden yellow ≈ `#F8D35E`** | lime-yellow `#E5E849` |
| Text link | mid blue ≈ `#4A7FD0` | `brand` `#2A51C6` |
| Royal blue | appears only in the photos (jerseys, helmet) | used as the primary UI colour |
| Page background | ≈ `#FBFCFE` | white / `surface #F4F6FB` |

**Type:** a condensed grotesk for display (it reads like Barlow Condensed or Oswald; we ship
**Oswald**), a humanist sans for body text (we ship **Geist**), and a **script** face in the footer
tagline, which would be a third family.

---

## 2. What works (pros)

### Brand & art direction
1. **It feels like a national federation, not a blog.** Navy and gold, a crest, athletes in USVI kit,
   and island imagery give it the authority of a governing body. The current home (a blue band plus a
   carousel) reads as a news site.
2. **People-first photography.** Real athletes in the hero, team photos on the team cards and an
   action shot in the event band. This is what makes sports sites emotionally credible.
3. **A recognisable motif system.** The yellow rule under headings, the diagonal yellow slashes (hero
   corner, card corners, event band edge, footer swoosh) and the island silhouettes in the footer.
   These are cheap to build in CSS and they make the site look like itself.
4. **The tagline works as a bookend.** "From the Virgin Islands to the World." opens the hero and
   closes the footer. It is a strong, ownable line.
5. **Gold is used more carefully than in our current build.** Gold appears only as a fill under navy
   text or as a thin rule. It is never used as body text on white. This is the accessibility-safe use
   that `globals.css` already documents for our accent.

### Information architecture
6. **The page answers the visitor's questions in order:** who you are (hero) → why you're credible
   (proof strip) → who represents us (teams) → what's happening next (event) → how I can take part
   (get involved) → what's new (news). That is a textbook federation or NGO landing narrative.
7. **Audience segmentation in Get Involved.** It names three real audiences (athletes and parents;
   coaches, umpires and volunteers; supporters) and gives each its own door. This is the most useful
   UX idea in the comp.
8. **One upcoming event is emphasised, not a list.** One full-width band with date and location gives
   the page a time-sensitive reason to come back. It also matches the real U18 Pan Am trip
   (Nov 2026, San Salvador; see `softball-schedule.jpeg`).
9. **The donate path is always one click away.** The nav pill is persistent, there is a hero CTA, and
   there is a Get Involved card. For a federation that funds travel by donation, prominence is correct.
   The problem is how often it repeats; see cons C4.

### Layout craft
10. **A consistent container and grid.** One content width and clean 2-column and 3-column grids,
    with the same gutters everywhere. This translates directly to `max-w-6xl` / `grid-cols-2|3`.
11. **Scannable cards.** Every card has an image or icon, a title, 1–3 lines and one action. The news
    cards are image-cover, like our `ArticleCard`.
12. **Strong hero typography.** The eyebrow, two-tone H1, rule, tagline and body make a clear
    hierarchy, and the colour split on SOFTBALL / FEDERATION carries the brand on its own.

---

## 3. What doesn't work (cons), ranked by impact

### Content & data (blocking — the comp assumes things we don't have)
**C1. It depends on photography that doesn't exist.** The hero, both team cards, the event band, all
three news cards and the proof-strip backdrop need about 8 images. There are **no real photos** today
(the article covers are typographic graphics). Even the comp reuses its hero and event photos in the
news cards. If we ship the layout without real photos, it falls apart. → The design guide needs an
**image-optional mode** for every section, plus a photo brief for the board.

**C2. The proof-strip "facts" are unverified and go stale.**
- "No. 32 WBSC world ranking": unverified, and rankings change, so a hardcoded figure goes stale.
- "**2026** Central American & Caribbean Games — Silver": our researched article covers a CAC Games
  silver. **Confirm the year and event** before it goes on the front page.
- The third item, "Preparing for the 2026…", is not a stat. It breaks the pattern of a big number or
  medal with a label, and it repeats the event band two sections below.
→ The stats need to be **editor-managed** (a small table or settings row), each with an "as of"
date, and every item has to have the same shape.

**C3. It assumes features that are switched off in prod.** National Teams and Events & Results map to
`TEAMS_ENABLED` / `EVENTS_ENABLED`, which are OFF. The event band needs an events record (or a
manually curated "featured event"). The team cards need team pages to link to. Join Us, Support,
Contact, Privacy and Terms have no routes yet.

### Interaction & IA
**C4. Too much call-to-action noise in the hero, and Support appears four times.**
- The hero has **3 CTAs**, two of them styled as identical ghost buttons. Three equal choices dilute
  the primary action.
- "Support the Federation" appears in the nav pill, the hero, the Get Involved card and the footer
  links. Once in the nav plus once in Get Involved is enough.
→ Use one primary CTA in the hero (Explore Our Teams) and at most one secondary (Upcoming Events).
Leave Support to the persistent nav pill.

**C5. The 8-item nav overlaps the page itself.** Join Us, Support and Contact duplicate Get Involved,
the donate pill and the footer contact block. Eight links plus a pill will not fit below roughly
1280px, so the comp needs a hamburger at laptop widths. → Cut it to about 5 top-level items, for
example *About · National Teams · Events · News · Get Involved*, plus the Support pill.

**C6. Unclear section links.** "Representing Our Islands →" and "Stronger Together →" are
**taglines styled as links**, so visitors can't tell where they go. → Name the destination: "All
teams →", "Ways to get involved →". "More News →" already does this correctly.

**C7. Non-descriptive repeated link text.** "Learn More" ×3 and "Read More" ×3 is a WCAG 2.4.4 / 2.4.9
problem, because screen-reader link lists read "Read More, Read More, Read More". → Make the whole
card the link, with the title as the accessible name, or add visually-hidden context.

**C8. News cards carry no date and no category.** Our feed includes 2023 stories. Without dates, a
2023 title reads as current news, which costs trust. → Add a category eyebrow and a date. The
5-line excerpts are too long; 2–3 lines is enough. Drop the per-card "Read More" when the whole card
is clickable.

**C9. The event band has no empty state or expiry.** Nov 21–28 passes in five weeks. → Show the next
event by date. If there is none, hide the band or fall back to the latest results. Keep "Event
Details" only if there is a detail page to link to.

### Visual & accessibility
**C10. The palette conflicts with the brand we just shipped.** The comp's UI colours are **navy plus
golden yellow**. PR #1 shipped **royal `#2A51C6` plus lime `#E5E849`**. Royal blue appears in the
comp only in the photos. A third blue, the mid-blue "Read More" links, makes it worse. → **Decision
needed** before the guide is written (see §5).

**C11. Contrast risks.**
- In the hero, white body text sits over a photo. Contrast holds only where the navy scrim is
  strongest, and on mobile the copy will sit over faces and jerseys. A defined scrim gradient is
  required.
- In the proof strip, small navy and grey text sits on a busy, washed-out aerial photo, which is
  borderline. Use a solid or near-solid surface and keep the photo very faint.
- The yellow "Upcoming Events" icon on navy is fine. Mid-blue links on white are about 4:1, which
  only passes for large text.

**C12. A third typeface.** The script footer tagline adds a font download for one line. → Use the
display face in italic or the condensed face instead, or ship an SVG wordmark of the tagline.

**C13. The crest breaking out of the nav.** It looks great static, but with our **sticky frosty nav**
the overlap either clips on scroll or covers hero content. → Overlap only while at the top of the
page, and shrink it to an inline mark once the page scrolls (`data-scrolled`).

**C14. Two white sections in a row, both with centred icon and image cards.** Get Involved and Latest
News together form a long, flat stretch. → Give Get Involved a tinted surface (`surface`), or move
News above Get Involved. News is fresher content, and the action stack then ends with the footer.

**C15. Decoration weight and performance.** There are four photographic backgrounds (hero, proof
strip, event band, footer silhouettes). The hero is the LCP image and must be `priority` plus a
responsive `sizes`. The other three should be optional and lazy, or use CSS or SVG instead of
photos.

### Gaps the comp doesn't show
- **Mobile.** The comp is desktop-only. Stacking rules for the hero (photo crop focal point), proof
  strip (3 → 1 column, or a horizontal scroll), event band (photo above text) and card grids still
  need defining.
- **Highlights.** The editor-curated highlights carousel (slices 4–5, and the e2e
  `home-highlights`) has no slot. Latest News is "latest", not "curated". → Either drive Latest News
  from `is_highlight` (highlights first, then latest to fill) or keep the carousel in that slot.
- **Instagram.** The footer shows Facebook and YouTube. The current footer has Facebook and
  Instagram. Use the real `contact_info` and socials rows; the comp's `info@usvsoftball.org`,
  `(340) 555-0123` and `© 2025` are placeholders.
- There is **no newsletter or email capture**, a common retention tool for federations. This is
  optional.
- There are no **sponsor or partner** logos (WBSC, the VI Olympic Committee, sponsors). Federations
  usually carry these for credibility and sponsor obligations. This is optional.

---

## 4. Fit against the current build

| Comp section | Current state | Reuse | New work |
|---|---|---|---|
| Nav + pill | frosty sticky nav, PayPal donate | `primary-nav.tsx`, `PAYPAL_DONATE_URL` | trim the IA, crest overlap behaviour |
| Hero | brand band, 2 CTAs, no photo | structure | photo + scrim, two-tone H1, rule |
| Proof strip | none | — | data source (editor-managed) + component |
| National Teams | `/teams` built, flag OFF | team data model | 2-card section, team pages ready to unflag |
| Event band | `/events` built, flag OFF | events table | "next event" query, band, empty state |
| Get Involved | none | `/donate` | 3 cards, destinations for athletes / coaches |
| Latest News | highlights carousel | `ArticleCard`, `listHighlightedArticles` | 3-up grid variant, date + category |
| Footer | centred footer, FB/IG | `contact_info` | 3-column navy footer, swoosh, silhouettes |

---

## 5. Decisions

**Resolved (2026-10-21, user):**
- **Palette → hybrid.** Navy for surfaces and headings, royal `#2A51C6` for links and focus, golden
  yellow replaces lime.
- **Nav → trimmed:** *Teams · Events · News · Get Involved · About* + the Support pill. The label is
  "Teams", not "National Teams", and About goes last, right before the pill.
- **News slot → a curated 3-up grid:** highlights first, filled with the latest. It replaces the
  carousel.
- **Teams & Events → unflag them as part of this feature.**

- **Proof strip → an editor-managed `home_stats` table, built in this feature.** No seed rows,
  every figure has an "as of" date, and the strip stays hidden until something is published.
- **Photography → image-optional variants ship first.** Real photos upgrade them later. The user is
  supplying board-member photos for `/about` separately.

→ Implemented as [`design-guide.md`](./design-guide.md).

Original options considered:

1. **Palette.** Do we adopt the comp's navy + gold (and re-tune `--brand` / `--accent`), keep the
   shipped royal + lime, or use a hybrid (navy as the dark surface, royal for links and focus, gold
   replacing lime)? *Recommendation: the hybrid. Navy `#0B2A5B`-ish for surfaces and headings, royal
   `#2A51C6` for interactive text and focus, gold `#F6CF57`-ish replacing lime. It matches the kit in
   the photos and keeps PR #1's token names.*
2. **Nav IA.** Keep 8 items, or cut to about 5 plus the Support pill? *Recommendation: about 5.*
3. **Highlights.** Should Latest News be driven by editor highlights, or should we keep the carousel?
   *Recommendation: a curated 3-up grid that takes highlights first and fills with the latest.*
4. **Teams and Events.** Unflag them as part of this feature, or ship the home sections with
   image-only and external-link fallbacks while the flags stay off?
5. **Proof-strip data.** Use an editor-managed stats table, or hardcode for launch with verified
   figures?
6. **Photography.** Who supplies real photos (the board?), and do we ship image-optional variants
   first?
