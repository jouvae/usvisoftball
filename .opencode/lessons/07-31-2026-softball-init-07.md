---
id: L-init-07
date: 2026-07-31
feature: softball/init
tier: T3
trigger: mid-session-error
category: process-change
status: active
---

## Context
Conceptualize (Phase 2), slice 05a (role foundation). Mid-build, every Supabase-touching step began failing.

## What happened
The project's Supabase subdomain (`<ref>.supabase.co` and `db.<ref>.supabase.co`) **stopped resolving in DNS** — the signature of a free-tier project that was paused/deleted/renamed. It had worked earlier in the same session. Because Conceptualize forbids mocking the backend, the build genuinely could not proceed: no migrations, seeds, real-auth e2e, or RLS probes. General egress was healthy (control hosts resolved), so the failure was project-specific.

## What to do differently
Verify backend reachability at phase start. On loss: **diagnose general-vs-project-specific DNS** (resolve control hosts like example.com/github/npm; if those work but the project host doesn't, it's the project, not the network) to attribute the outage correctly. Then **surface it as a first-class human blocker** — the human owns the Supabase project and is the only one who can restore it — and record it in status.md with exact resume steps. **Never mock or fake past a vanished live dependency**; halting honestly is correct, not a failure. Authoring unverified code in parallel is acceptable **only with explicit human opt-in**, and every line must be re-verified against the restored backend before anything is marked done (which is what happened: the human restored the project, then migration 0003 + seeds + 8/8 RLS probes + real-browser 8/8 all ran green).
