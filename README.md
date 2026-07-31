# USVI Softball Federation

Public site + admin/editorial platform for the U.S. Virgin Islands Softball Federation.

**Stack:** Next.js 16 (App Router, React 19), Tailwind CSS v4 (CSS-first `@theme`), Supabase
(Auth + Postgres + Storage), deployed on Fly.io. TypeScript throughout; Playwright for e2e.

## What it does

- **Public** — branded home + a news feed (`/news`) and article pages (`/news/[slug]`). Only
  `published` articles are visible; drafts/in-review/unpublished return a real 404 (enforced by
  Postgres Row-Level Security, not just a query filter).
- **Admin** (`/admin`, Supabase Auth email+password) — a role-based editorial workflow:
  contributors write and submit drafts; editors review, edit, **publish** and **unpublish**;
  an AI-draft panel (feature-flagged — see below) generates drafts that are **always** created
  as `draft` with stored provenance and never auto-published.

Authorization is simple RBAC enforced **at the database** via RLS (`public.profiles.roles text[]`
+ a `has_role()` SECURITY DEFINER helper). See `docs/entities.md` for the entity registry and
`docs/features/softball/init/` for the feature docs (scenarios, status, changelog, slice contracts).

## Prerequisites

- Node 20+ (`tsx` is a devDependency used to run the TypeScript seed scripts)
- A Supabase project
- `psql` (migrations are applied out of band — DDL is not exposed over the Supabase HTTP API)

## Environment

Create `.env.local` (gitignored) with these **names** (never commit values):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key — **RLS-enforced**, browser-safe |
| `SUPABASE_KEY` | New-format secret key (`sb_secret_…`) — **server-only, RLS-bypassing** (seeds/admin) |
| `SUPABASE_DB_URL` | Direct Postgres connection string — **`psql` only**, never in app code (migrations) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Seeded editor operator |
| `SEED_CONTRIBUTOR_EMAIL` / `SEED_CONTRIBUTOR_PASSWORD` | Seeded contributor operator |
| `NEXT_PUBLIC_AI_DRAFT_ENABLED` | `true` enables the AI draft panel (dev/test). **Unset/`false` in production** until the Federation supplies the owned/licensed source list and a real model is wired. |

> The `SUPABASE_KEY` secret bypasses RLS — read it only in Server Components / Server Actions /
> route handlers, never in client code. Only the `NEXT_PUBLIC_*` values may reach the browser.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
```

## Database

Migrations live in `supabase/migrations/` (versioned in git — RLS is the security control and must
be reviewable). Apply them with `psql` (replayable/idempotent):

```bash
for f in supabase/migrations/000*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
```

Seed through the real write paths (never hand-written rows):

```bash
npm run seed             # articles (via createArticle)
npm run seed:admin       # editor operator (via auth.admin.createUser + profiles)
npm run seed:contributor # contributor operator
```

## Test

```bash
npm run test:e2e
# against an already-running dev server:
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
```

The Playwright suite runs `workers: 1` / `fullyParallel: false` — the projects share one Supabase
database and some specs mutate it; do not parallelize.

## Deploy (Fly.io)

Build is `output: 'standalone'` and containerized (`Dockerfile` + `fly.toml`). Supabase env vars
are set as **Fly secrets** (`fly secrets set NEXT_PUBLIC_SUPABASE_URL=… …`), never baked into the
image. Fonts are self-hosted so `next build` needs no network access. Leave
`NEXT_PUBLIC_AI_DRAFT_ENABLED` unset in production to keep the AI panel gated off.
