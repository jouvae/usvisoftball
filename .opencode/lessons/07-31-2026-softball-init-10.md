---
id: L-init-10
date: 2026-07-31
feature: softball/init
tier: T3
trigger: phase-boundary
category: process-change
status: active
---

## Context
Actualize (Phase 3), promotion-gate debt audit. All dev/e2e checks were green (`next dev` + Playwright + tsc + eslint).

## What happened
`app/layout.tsx` used `next/font/google` (Oswald + Geist). Next 16 **self-hosts Google fonts by fetching them during `next build`** — so a network-less CI / Fly builder fails the production build. This passed every check in the dev/test loop (which all run `next dev`, never a production build) and was invisible until the promotion-gate auditor reasoned about deploy-time behavior. It was the single most important ship-blocker, caught by analysis rather than by any red test.

## What to do differently
The `/actualize` promotion gate must **run an offline-safe `next build`** as an explicit deploy-readiness check — `tsc`/`eslint`/e2e are necessary but all exercise `next dev` and never catch build-time-only behavior. Fix fonts by self-hosting via `next/font/local` + a vendored (or `@fontsource`) `.woff2`, then verify `next build` completes with no outbound fetch. **Generalize:** deploy-time build behavior — build-time font fetches, `next/image` remote-host config, env read at build vs runtime, `output:'standalone'` — is invisible to the dev/test loop; assert each explicitly before ship. **Trigger for /improve:** add "offline `next build` succeeds" to the promotion-gate checklist for any Next.js feature heading to a containerized/CI deploy.
