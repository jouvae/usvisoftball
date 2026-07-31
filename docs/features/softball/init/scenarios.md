# softball/init Scenarios

<!--
Drafted after EventStorming (complete) + Information Architecture (5.6). Scope = the FIRST BUILD
SLICE only: Foundation + News feed + the editorial draft→review→publish workflow. Registry, Store,
Donations, and AI-source-expansion scenarios belong to their own child features (see overview
§Roadmap) and are NOT drafted here.

Status: all `draft` (Empathize). `references` point to the current design artifacts; `/plan` will
repoint them at real code files. The `Then` clauses are the canonical spec dcon later validates.
-->

## init-web-001: Public visitor reads the news feed
- **Priority**: P0 · **Group**: A · **Stack**: web
- **references**: information-architecture.md, docs/entities.md

**Given** published articles exist and an unauthenticated visitor opens `/news`
**When** the feed loads
**Then** only `published` articles appear, newest first, each showing headline, category, author byline, date, and hero image; and when no articles are published the feed shows an empty state (not an error).

## init-web-002: Public visitor reads a published article; drafts stay hidden
- **Priority**: P0 · **Group**: A · **Stack**: web
- **references**: information-architecture.md, docs/entities.md

**Given** one article is `published` and another is `draft`/`in_review`
**When** an unauthenticated visitor opens the published article's `/news/[slug]` and then attempts the draft's slug
**Then** the published article renders (headline, byline, body, gallery), and the draft/in_review slug returns 404 (never exposed to the public).

## init-e2e-003: Contributor creates and submits an article draft
- **Priority**: P0 · **Group**: B · **Stack**: e2e
- **references**: information-architecture.md, docs/entities.md

**Given** a signed-in user with the `contributor` role in the admin
**When** they create an article (title, body, category, hero image), save it, and submit it for review
**Then** the article is stored as `source=human`, transitions `draft → in_review`, appears in the editorial queue, and is NOT visible on the public feed.

## init-e2e-004: Contributor cannot publish (permission-denied)
- **Priority**: P0 · **Group**: B · **Stack**: e2e
- **references**: information-architecture.md, docs/entities.md

**Given** a signed-in `contributor` viewing their own `in_review` article
**When** they attempt to publish it (via UI and via a direct publish request)
**Then** no Publish control is available in the UI and the direct request is rejected as permission-denied; the article's status is unchanged.

## init-e2e-005: Editor reviews, edits, and publishes an article
- **Priority**: P0 · **Group**: B · **Stack**: e2e
- **references**: information-architecture.md, docs/entities.md

**Given** a signed-in `editor` and an article in `in_review`
**When** they edit the body and publish it
**Then** the article transitions to `published` with a `published_at` timestamp and now appears on the public `/news` feed and its article page.

## init-e2e-006: Editor unpublishes a live article (removal)
- **Priority**: P1 · **Group**: B · **Stack**: e2e
- **references**: information-architecture.md, docs/entities.md

**Given** a signed-in `editor` and a `published` article
**When** they unpublish it
**Then** the article transitions to `unpublished`, disappears from the public feed and its public slug returns 404, while remaining visible in the editorial queue for re-publish.

## init-e2e-007: AI draft is generated for review and never auto-published
- **Priority**: P0 · **Group**: C · **Stack**: e2e
- **references**: information-architecture.md, docs/research/domain-and-comparables.md

**Given** a signed-in `contributor`/`editor` on the AI draft panel with an owned/licensed source selected
**When** they request an AI draft and then accept the generated result
**Then** an article is created with `source=ai` and `status=draft` (never `published`), with stored `ai_provenance` (source + model); it enters the normal review workflow and appears only in the editorial queue, not the public feed.

## init-e2e-008: Unauthenticated user cannot reach the admin
- **Priority**: P0 · **Group**: A · **Stack**: e2e
- **references**: information-architecture.md, docs/entities.md

**Given** an unauthenticated visitor
**When** they navigate to any `/admin` route (dashboard, editorial queue, draft editor, AI panel)
**Then** they are redirected to `/admin/login` and no admin data is returned.

## init-web-009: Foundation shell renders core navigation
- **Priority**: P1 · **Group**: A · **Stack**: web
- **references**: information-architecture.md

**Given** an unauthenticated visitor on the home page `/`
**When** the site shell loads
**Then** the primary navigation (News, Teams, Events, About, Shop, Donate) and the federation branding render, and each nav item routes to its section (sections not yet built resolve to a visible placeholder, not a broken link or error).
