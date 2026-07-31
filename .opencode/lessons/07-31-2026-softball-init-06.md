---
id: L-init-06
date: 2026-07-31
feature: softball/init
tier: T3
trigger: phase-boundary
category: process-change
status: active
---

## Context
Conceptualize (Phase 2), building the 9 first-slice scenarios of softball/init — several of which are **absence/denial** properties: `init-e2e-008` (unauthenticated cannot reach /admin), `init-web-002` (drafts never leak), `init-e2e-004` (contributor cannot publish), plus empty-state and 404 scenarios.

## What happened
A negative/absence scenario passes **vacuously** when the capability it denies does not yet exist. The auth gate (04) would have passed by redirecting *everyone* — a gate that never lets an admin through is broken but green. "Contributor cannot publish" (init-e2e-004) is meaningless until an editor *can* publish. An empty-feed test passes whether RLS works or the seed is broken. In each case a green test proved nothing about the property that mattered.

## What to do differently
Sequence a negative/absence scenario **after** the positive capability it denies, and prove the barrier **empirically, out-of-band, with a real-role JWT** — not structurally. Concretely, this session: built "gate + real login" (verify an admin *does* get in) rather than "gate only"; built editor-publish (slice 06) **before** contributor-cannot-publish (slice 07), so 07 was a genuine negative against a real capability; proved the never-autopublish RLS by *attempting* an (ai, published) insert as both roles and observing rejection. Also make the anti-tautology deliberate in code (e.g. the by-slug read omits a redundant `status='published'` filter so a broken RLS policy fails the 404 test instead of masking it). **Trigger for /improve:** when a scenario asserts denial/absence/empty/404, the plan must (a) order it after the capability, and (b) include an out-of-band positive+negative probe — a UI-only green is insufficient.
