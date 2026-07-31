# Information Architecture — softball/init

**Updated:** 2026-07-09   **Derived from:** event-storming.md (complete), research/, docs/entities.md

> Two halves: UX/product IA (what to prototype) + domain IA (what to build against).
> Every screen traces to a read model; every entity traces to an aggregate. Decisions of
> 2026-07-09 applied (Supabase/Neon + app-native admin CMS + Stripe Checkout; RBAC; start clean).
> **First build slice = Foundation + News feed** (marked ⭐).

## Part 1 — UX / Product IA

### Screen & route inventory
| Screen | Route | Primary actor | Renders (aggregate) | Actions (commands) | Status states |
|---|---|---|---|---|---|
| ⭐ Home | `/` | Fan | Article (feed) + featured | open article/team/player, donate, shop | loading / empty / populated |
| ⭐ News feed | `/news` | Fan | Article[] | filter by category/tag, open article | loading / empty / paginated |
| ⭐ Article page | `/news/[slug]` | Fan | Article | share; (published only) | published / 404 (draft hidden) |
| Team hub | `/teams/[slug]` | Fan | Team (roster/schedule/results/standings/stats) | open player, open event | populated / empty roster |
| Teams index | `/teams` | Fan | Team[] | open team | populated / empty |
| Player profile | `/players/[slug]` | Fan | Player (vitals, season+career stats, highlights, news) | open team, play highlight | populated / stats-empty |
| Events archive | `/events` | Fan | Event[] grouped by **edition/year** | open event | populated / empty |
| Event page | `/events/[slug]` | Fan | Event (teams, bracket/standings, results, gallery) | open team | populated / results-pending |
| About | `/about` | Fan | AboutPage (mission/history) | — | static |
| Board | `/about/board` | Fan | BoardMember[] by **seat**, current **term** | open member | populated |
| Board member | `/about/board/[slug]` | Fan | BoardMember | — | populated |
| Shop | `/shop` | Fan | Product[] (`active`) | open product | populated / empty / out-of-stock |
| Product page | `/shop/[slug]` | Fan | Product (variants) | add to cart → checkout | in-stock / out-of-stock |
| Cart / Checkout | `/cart` → Stripe | Fan | Order | Checkout (→ Stripe) | empty / redirect / success / cancel |
| Donate | `/donate` | Fan | Donation | Donate one-time / recurring (→ Stripe) | idle / processing / thanks |
| ⭐ Admin sign-in | `/admin/login` | operator | User | SubmitSignIn | idle / error / locked |
| ⭐ Admin dashboard | `/admin` | operator | role-scoped summary | navigate | — |
| ⭐ Editorial queue | `/admin/news` | Editor | Article[] by status | open, publish, unpublish | draft / in_review / published / unpublished |
| ⭐ Draft editor | `/admin/news/[id]` | Contributor/Editor | Article | edit, attach photos, submit, publish | draft / in_review / published |
| ⭐ AI draft panel | `/admin/news/ai` | Contributor/Editor | AiDraftJob | RequestAiDraft → review provenance → accept as draft | idle / generating / generated / error |
| Team manager | `/admin/teams` | Data steward | Team | create/edit, roster | — |
| Player manager | `/admin/players` | Data steward | Player | create/edit, stats (manual/CSV), highlights | — |
| Event manager | `/admin/events` | Data steward | Event | archive, record results, gallery | — |
| Board manager | `/admin/board` | Data steward | BoardMember | add/edit (seat, term) | — |
| Store manager | `/admin/store` | Store admin | Product / Order | list product, edit inventory, fulfill order | — |
| Donations ledger | `/admin/donations` | Finance admin | Donation[] | reconcile, export | — |
| Users & roles | `/admin/users` | Super admin | User / Role | invite, assign role | — |

### Navigation map
```
PUBLIC   Home ─┬─ News ── Article
               ├─ Teams ── Team hub ── Player profile ──┐
               ├─ Events ── Event page ─────────────────┘ (cross-links)
               ├─ About ── Board ── Board member
               ├─ Shop ── Product ── Cart/Checkout →(Stripe)
               └─ Donate →(Stripe)

ADMIN    /admin/login → Dashboard ─┬─ News (queue → draft editor → AI panel)   ⭐ first slice
                                   ├─ Teams / Players / Events / Board  (registry)
                                   ├─ Store (products/inventory/orders) / Donations (ledger)
                                   └─ Users & Roles
```

### Per-surface content (first slice ⭐)
- **⭐ News feed (`/news`)** — title + intro; category/tag filters; card list (hero image, headline,
  category, byline, date, excerpt); pagination; states: loading skeleton / empty ("no articles yet")
  / populated. Read model: published `Article[]`.
- **⭐ Article page (`/news/[slug]`)** — headline, byline (member author), date, hero image, rich
  body, gallery, related; only `published` renders publicly (draft/in_review → 404 for the public).
- **⭐ Editorial queue (`/admin/news`)** — tabs by status (draft / in_review / published /
  unpublished); row = headline, author, source (human/ai), updated; actions: open, publish, unpublish.
- **⭐ Draft editor (`/admin/news/[id]`)** — title, body (rich text), excerpt, category, tags, hero +
  gallery upload; Contributor: Save + Submit-for-review; Editor: also Publish/Unpublish. Provenance
  shown if `source=ai`.
- **⭐ AI draft panel (`/admin/news/ai`)** — pick owned/licensed source(s) + prompt → Generate →
  review generated draft **with provenance/attribution** → Accept (creates `status=draft` Article) or
  Discard. Never publishes. States: idle / generating / generated / error.

### Status / state model (UI) — Article (drives the first slice)
| State | Label | CTA | Surfaced where |
|---|---|---|---|
| draft | Draft | Submit for review (Contributor) / Publish (Editor) | Draft editor, queue |
| in_review | In review | Edit, Publish (Editor) | Editorial queue |
| published | Published | View, Unpublish (Editor) | Public feed + queue |
| unpublished | Unpublished | Re-publish, Edit | Editorial queue only |
| (public view of non-published) | — | — | 404 / hidden from Fan |

## Part 2 — Domain IA

### Bounded contexts (candidate module seams)
- ⬛ **Content/Editorial** — owns Article, MediaAsset, AiDraftJob; emits ArticlePublished. Talks to
  Registry via tag/link references (Article ↔ Team/Player). **First slice.**
- ⬛ **Registry** — owns Team, Player, Coach, Event, BoardMember, Stat.
- ⬛ **Commerce** — owns Product, Order, Donation; integrates Stripe (webhooks in).
- ⬛ **Identity/Access** — owns User, Role; Supabase Auth; gates every admin command via RBAC.

### Aggregate & entity map (reconciled to docs/entities.md)
```
User —has→ Role[]                         (Identity)
Article —by→ User; —has→ MediaAsset[]; —refs→ Team/Player (tags)   (Content)
AiDraftJob —produces→ Article(draft); —stores→ ai_provenance      (Content)
Team —has→ Player[] (roster), Coach[]; —in→ Event[]; —has→ Stat(agg)   (Registry)
Player —on→ Team; —has→ Stat(season+career), Highlight[]           (Registry)
Event —has→ participating Team[]; —grouped by→ edition/year        (Registry)
BoardMember —has→ seat, term                                      (Registry/About)
Product —has→ variant[] (inventory) ; —priced via→ stripe_price   (Commerce)
Order —has→ line_item[]→Product; —paid via→ Stripe                (Commerce)
Donation —paid via→ Stripe (one_time|recurring)                   (Commerce)
```
Registry status: all entities **proposed** (docs/entities.md v0.1.0) — ratify in `/plan`.

### Cross-context event flow
- Content —`ArticlePublished`→ public read models (home/feed/related team+player). Async view update.
- Commerce ←`OrderPaid`/`DonationCompleted`— **Stripe webhook** → inventory decrement + receipt email. Async.
- Identity —RBAC check→ every admin command (sync, in-request).

## TBD / carried hotspots
- **AI draft panel** — the *specific owned/licensed sources* the Federation can supply (content input), separate from the settled design.
- (Flagship-event date resolved: **St. John, March 2023**.)

## Platform (locked 2026-07-09)
- **Full Next.js app, no Go.** Backend = Next.js route handlers / server actions + `supabase-js`.
- **Supabase** = Auth + Postgres + Storage. **RBAC** (role rows + route-handler checks, optional RLS).
- **Deploy = Fly.io.** Commerce = Stripe Checkout (merch) + Stripe (donations), app-native admin.

## Handoff
- `/conceptualize` prototypes the Part-1 ⭐ screens (Foundation + News feed + editorial workflow)
  against the Part-2 Content/Editorial + Identity seams, one slice at a time.
- Entity-map changes are *proposed* until ratified in `/plan`.
