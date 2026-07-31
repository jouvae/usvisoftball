---
id: L-init-09
date: 2026-07-31
feature: softball/init
tier: T3
trigger: mid-session-error
category: training
status: active
---

## Context
Conceptualize (Phase 2), slice 09 (AI draft). Test/verify data is created with a unique marker so it can be filtered and cleaned up.

## What happened
The AI stub drafter composes the article **title** as `"Federation report: " + prompt`, so the `[e2e-007] <uuid>` marker lands **mid-title**, not at the start. An orchestrator ad-hoc verify driver used a **prefix** delete (`title LIKE '[verify-09]%'`) which matched nothing → it leaked one AI draft. Worse, the leftover-check re-queried with the **same prefix pattern**, so it reported 0 leftovers while a row remained (total count was 6, not the expected 5). QA had independently flagged the same class of bug in the contract (MINOR-1) for the e2e teardown.

## What to do differently
When a generator embeds a unique test marker **inside** a larger string, both the cleanup delete and any queue/list filter must use a **contains-match** (`title LIKE '%marker%'` / Playwright `hasText`), never a prefix. And confirm the restored baseline by **total row count**, not by re-querying with the same (possibly faulty) marker pattern — a match-pattern bug hides itself from a same-pattern check. Encode the contains-match in the **spec** (the e2e teardown), not just the ad-hoc driver, so the discipline is durable. **Trigger for /improve (nextjs-tester):** marker-based teardown/filter must match the marker's actual position in the value; verify cleanup by absolute count.
