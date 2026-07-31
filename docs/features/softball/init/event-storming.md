# Event Storming — softball/init

**Updated:** 2026-07-09   **Session pass:** complete (converged; Pass-1 events unchallenged, hotspots resolved by 2026-07-09 decisions)   **Facilitator:** event-storm

> Big-Picture EventStorming model. Deliberately shared-but-incomplete. Hotspots are open
> questions, not defects. Entity names reconcile to `docs/entities.md`.
>
> **Spine:** _Turn event-driven attention into fans, donors, and funds — via a news feed, a
> registry of teams/players/events, and donations + merch — operated by a few volunteers behind an
> editorial gate._ Detail is deepest on the **first build slice: Foundation + News feed**.

## Actors / roles (🟨)
- 🟨 **Fan / Public** — reads published content; no account.
- 🟨 **Contributor** — federation member; drafts articles + photos; may request an AI draft; **cannot publish**.
- 🟨 **Editor** — reviews (human + AI) drafts, edits, **publishes / unpublishes / removes**.
- 🟨 **Data steward** — maintains teams, players, coaches, events, board members.
- 🟨 **Store/Finance admin** — manages products/inventory, orders, and reconciles donations.
- 🟨 **Super admin** — manages users, roles, settings. (One person may hold several roles.)

## Commands → Events (cause → effect)
| 🟦 Command | 🟨 Actor | 🟫 Aggregate | 🟧 Event(s) | 🟩 Read model |
|---|---|---|---|---|
| SubmitSignIn | operator | User | UserSignedIn | Admin login |
| StartArticleDraft | Contributor | Article | ArticleDrafted | Draft editor |
| RequestAiDraft | Contributor/Editor | AiDraftJob | AiDraftRequested → AiDraftGenerated | AI-draft panel (with provenance) |
| AttachPhotos | Contributor | Article/MediaAsset | PhotosAttachedToArticle | Media picker |
| SubmitForReview | Contributor | Article | ArticleSubmittedForReview | Editorial queue |
| EditArticle | Editor | Article | ArticleEdited | Draft editor |
| PublishArticle | Editor | Article | ArticlePublished | Feed + article page |
| UnpublishArticle | Editor | Article | ArticleUnpublished | Editorial queue |
| CreateTeam | Data steward | Team | TeamCreated | Team admin |
| CreatePlayer / AssignToTeam | Data steward | Player | PlayerProfileCreated / PlayerAssignedToTeam | Player admin |
| UpdateStats (manual/CSV) | Data steward | Player/Stat | PlayerStatsUpdated | Stats editor / CSV import |
| AddHighlight | Data steward | Player/Team | HighlightAdded | Highlight embed field |
| ArchiveEvent / RecordResults | Data steward | Event | EventArchived / EventResultsRecorded | Event admin |
| AddBoardMember | Data steward | BoardMember | BoardMemberProfileAdded | About/board admin |
| ListProduct | Store admin | Product | ProductListed | Store admin |
| Checkout | Fan | Order | CartCheckedOut → OrderPaid | Stripe Checkout (external) |
| FulfillOrder | Store admin | Order | OrderFulfilled | Order admin |
| Donate | Fan | Donation | DonationInitiated → DonationCompleted (→ RecurringDonationScheduled) | Donate page (Stripe) |
| InviteUser / AssignRole | Super admin | User | UserInvited / RoleAssigned | User admin |

## Policies (🟪 whenever → then)
- 🟪 Whenever **ArticleSubmittedForReview** → notify Editor (appears in editorial queue).
- 🟪 Whenever **AiDraftGenerated** → create Article as `status=draft` (**never autopublish**); attach provenance.
- 🟪 Whenever **OrderPaid** → decrement variant inventory; email order confirmation.
- 🟪 Whenever **DonationCompleted** → send tax receipt (`DonationReceiptSent`); if recurring, schedule next.
- 🟪 Whenever **ArticlePublished** → appears in feed, homepage, and (if tagged) related team/player pages.

## Read models / views (🟩 → become screens)
- 🟩 Home feed · Article page · Team hub · Player profile · Event/Edition archive · About + board ·
  Shop · Product page · Donate · **Admin:** editorial queue, draft editor, AI-draft panel, registry
  managers (team/player/event/board), store manager (products/inventory/orders), user/role admin.

## External systems (🟥)
- 🟥 **Stripe** — Checkout (merch) + Payments/Billing (donations, incl. recurring). Out: create
  session; In: webhook (`OrderPaid`, `DonationCompleted`, subscription events). Async.
- 🟥 **Supabase** — Postgres + Auth + Storage (media), via `supabase-js`. Our data plane; the integration boundary for auth/data/storage. (Host: **Fly.io**; full Next.js app, no Go.)
- 🟥 **Email provider** — receipts + editorial notifications (e.g. Resend). Async.
- 🟥 **YouTube** — highlight embeds (out, read-only).
- 🟥 **AI model provider** — drafts from owned/licensed sources (see copyright guardrails). Async.

## Bounded contexts (⬛ candidate module seams)
- ⬛ **Content/Editorial** — Article, MediaAsset, AiDraftJob; draft→review→publish. **First slice.**
- ⬛ **Registry** — Team, Player, Coach, Event, BoardMember, Stat.
- ⬛ **Commerce** — Product, Order (Stripe Checkout), Donation (Stripe). App-native admin.
- ⬛ **Identity/Access** — User, Role (Supabase Auth + RBAC).

## 🔴 Hotspots — resolution status
- ~~H1 donations vs merch~~ → **RESOLVED: two flows.**
- ~~H2 commerce ownership~~ → **RESOLVED: app-native (local DB + Stripe Checkout), no external platform.**
- H3 AI sourcing → **design RESOLVED** (owned/licensed + human review + provenance); *which specific owned sources the Federation feeds it* — content question, open with Federation.
- ~~H4 stats capture~~ → **RESOLVED: manual entry / CSV import** (no GameChanger API). Stat set per domain research.
- ~~H5 auth mechanism~~ → **RESOLVED (assumed): Supabase Auth + RBAC.**
- ~~H6 publish gate~~ → **RESOLVED: contributors submit, only editors publish.**
- ~~H7 backend platform~~ → **RESOLVED: Supabase/Neon Postgres + CMS-in-admin.**
- ~~H8 existing prototype~~ → **RESOLVED: ignore, start clean.**
- ~~H9 flagship-event date~~ → **RESOLVED: St. John, March 2023** (Federation-confirmed).
- ~~H10 team model~~ → **RESOLVED: persistent team hubs.**

## Handoff
- Feeds: `information-architecture.md` (structure) → `/conceptualize` prototype (what to build).
- **All hotspots resolved.** Remaining input from Federation is content-only: the *specific
  owned/licensed sources* to feed the AI drafter (not a design blocker).
