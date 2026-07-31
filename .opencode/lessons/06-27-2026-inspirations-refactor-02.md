---
id: L-insp-refactor-05
date: 2026-06-27
feature: inspirations/refactor
tier: T3
trigger: human-direction
category: convention
status: active
---

## Context
Before the conceptualize phase, the human set three baseline conventions for the
`inspirations` service (a clone that grew out of the decommissioning `novella` service).
Executed as a 4-pass refactor (analytics removal + novella scrub → domain-type
localization → proto cleanup → test scrub); all builds stayed green.

## What happened — three durable conventions
1. **Service independence / total novella excision.** The inspiration service is its own
   thing; it must contain **zero** mention of novella in any form — imports, comments, log
   strings, AND env-var names (`BOOTSTRAP_TOKEN_NOVELLA` → `BOOTSTRAP_TOKEN_INSPIRATIONS`,
   `NOVELLA_SERVICE_GRPC_SERVER_ADDRESS` → `INSPIRATIONS_SERVICE_GRPC_SERVER_ADDRESS`, the
   `NOVELLA_GRAPH_*` getenvs, and the `.env.example` entries). A clone's heritage is not a
   dependency; scrub it fully, env source included.
2. **Each service owns its domain types — no shared `libs/go/postgres/migrations` import.**
   Define and maintain entity types inside the service directory (`package service`
   `models_*.go`, mirroring the reservations service), not in the shared migrations package.
   Localizing is also an opportunity to shed unused fields/methods that drag in unrelated
   type graphs (`Guest`, `ExperienceInstance`, `File`, `RefundTier`) — keep only the surface
   the service actually uses, preserving the serialized (Meilisearch JSONB) shape.
3. **Domain services don't do analytics.** Inspiration-event tracking/metrics belong to a
   separate future analytics service. Remove the analytics surface entirely
   (`analytics.go`, the `inspiration_events` Redis-stream consumer, `InspirationEvent`/
   `InspirationMetric`, the analytics proto types) — a domain service exposes domain RPCs,
   not analytical functionality.

## Meta-lesson (corrects my earlier move)
A prior step "decoupled" inspirations from novella by **moving** the analytics proto types
(`InspirationEventType`/`EventMetadata`) **into** `inspirations.proto`. That was the wrong
direction: analytics never belonged in the inspiration domain, so relocating it there only
created rework (move in, then remove). **Before relocating a thing across a boundary to
"decouple," ask whether it belongs in the target domain at all** — if not, delete it from
the scope, don't re-home it. The legacy analytics type stayed with novella (its current
owner) until the analytics service exists; the shared migrations analytics type may import
`novella_service` — that's fine because it is not the inspiration service.

## What to do differently
- New/refactored services: own your entity types (`package service`), import nothing from
  `libs/go/postgres/migrations` for domain types; keep the service free of unrelated-domain
  concerns (analytics, other services' names). Reference template: the reservations service.
- Rule candidate for **go-implementer / architect / reviewer**: *a domain service must not
  import shared `migrations` entity types or carry another (esp. deprecated) service's name
  in imports/strings/env vars, and must not host analytics; flag any such coupling.*
  `/improve` to promote and to extend the `data.md` supersession banner. Builds on
  [[06-26-2026-inspirations-refactor-01]] (no `repo` package).
