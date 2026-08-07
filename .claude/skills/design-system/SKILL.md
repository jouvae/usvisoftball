---
name: design-system
description: Pointer to the project's design-system source of truth (DESIGN.md) and the rules any prototyping or frontend implementation must honor — component tiers, the useApis hook (never raw fetch), serverApiClient, shadcn, and data-testid. Loaded by /conceptualize and the nextjs agents.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Point at the **single source of truth** for frontend architecture and encode the few
conventions that bite if a prototype or implementation ignores them. **Do not
duplicate `DESIGN.md` here** — read it.

## Source of truth

- **`DESIGN.md`** (repo root) — component architecture, the three tiers, data flow,
  form patterns. Read it before building any UI.
- **`.claude/skills/nextjs/`** (if present) — framework-level App Router patterns.
  `DESIGN.md` covers *our* architecture; the nextjs skill covers *framework* patterns.

## The conventions that bite

1. **Three component tiers, split by where data comes from:**
   - `src/components/ui/` — stateless shadcn primitives; no data, no API calls.
     Add via `npx shadcn@latest add <component>`.
   - `src/components/client/` (and `src/components/forms/`) — `"use client"`;
     interactivity, forms, real-time. Compose UI components.
   - `src/app/**/page.tsx` — server pages; fetch via `serverApiClient`, pass data down.
2. **Client components call `useApis` — never raw `fetch`.** All client-side requests
   target Next.js API routes, never the backend directly.
3. **Server pages fetch via `serverApiClient`** and compose; they never define
   components inline.
4. **Every component accepts `className`, exposes `data-testid`, prefers
   `children`/slots.** `data-testid` is what Playwright e2e selects on — required.
5. **Never mock mode in live prototyping.** `NEXT_PUBLIC_MOCK_MODE` must be off; the
   prototype runs against the real backend.

## When to load me

- `/conceptualize` — before building any live UI slice.
- `nextjs-tester` / `nextjs-implementer` already reference `DESIGN.md`; this skill is
  the shared pointer so the ECA commands stay consistent with them.
