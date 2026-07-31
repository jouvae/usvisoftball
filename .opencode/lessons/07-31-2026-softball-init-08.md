---
id: L-init-08
date: 2026-07-31
feature: softball/init
tier: T3
trigger: phase-boundary
category: training
status: active
---

## Context
Conceptualize (Phase 2), all slices. The loop is architect → qa → tester → implementer, each a subagent, with the orchestrator self-verifying every slice.

## What happened
A subagent's reported green cannot be trusted at face value: (a) a subagent's **dev server dies when its task ends**, so its "suite passed" cannot be re-observed as-is; (b) a subagent's **sandbox may lack egress to the live backend** — during the Supabase outage the tester could not reach Supabase at all, and even when up, psql egress varied between subagents. Treating a subagent's green as truth would repeatedly violate verify-by-observing.

## What to do differently
The **orchestrator owns verification** and re-does it from scratch each slice: apply migrations itself (psql from the orchestrator env, confirming replayability); kill any leftover subagent server (identify by `readlink /proc/<pid>/cwd`, **never by port** — :3000 here is an unrelated `inspirations` project); start its **own** dev server from a clean `.next`; run the full suite; **drive the real browser** (assert rendered DOM + screenshot); and prove RLS/data properties with **out-of-band REST probes using real-role JWTs** (password-grant a real contributor/editor token; the service key is used only to seed/read the fixture, never on the assertion path — a service-key "success" proves nothing about RLS). This backbone caught real issues (e.g. a self-inflicted cleanup leak via total-count) that the subagents' green would have hidden. **Trigger for /improve:** an orchestrator must never mark a slice verified on a subagent's report alone.
