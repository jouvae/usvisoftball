---
id: L-workspaces-providers-01
date: 2026-06-29
feature: workspaces/providers
tier: T3
trigger: phase-boundary
category: learning
status: active
---

## Context

Empathize phase for `workspaces/providers` (the CARICOM partner onboarding → notice-submission
spine, branch `caricom`). During codebase mining the scaffolded provider seam
(`services/alpha/modules/reservations/providers/`) was the primary mined research signal — the
manifest/notice model was assumed to exist there.

## What happened

`providers/logic.go` imports and references `migrations.Manifest` / `migrations.ManifestPassenger` /
`migrations.ManifestCrewAssignment`. On the surface this read as a **convention divergence** — a type
living in the wrong place (`libs/go/postgres/migrations`) that L-insp-refactor-05 says should be
service-owned. The instinct was to log it as "migrate the type into the service."

Running `go build ./services/alpha/modules/reservations/providers/...` proved otherwise: those three
types **exist nowhere in the repo** (only `migrations.Resource` is defined) — **the package does not
compile**. The manifest model is **absent, not mislocated**. That flips the downstream work from "move
an existing type" to "**define the Manifest/passenger/crew domain types from scratch**, service-owned,"
which is materially larger and re-scoped the §2.24 entity proposal and the /plan hotspot. Because the
fact was *verified* (build run, not just import-read), the entity reconciliation, scenarios
(wsp-e2e-013/014/015, wsp-go-018/019), and the carried-to-/plan note are all grounded in reality.

## What to do differently

When empathize mines a **scaffolded/stubbed** surface and a referenced type/symbol is about to be
recorded as a "convention divergence" or "mislocated," **first run the build (`go build ./<pkg>/...`)
to confirm the symbol actually exists.** Distinguish three states explicitly: *present-and-correct*,
*present-but-mislocated* (a real divergence), and *absent/phantom* (compile failure → define from
scratch). A scaffold's imports are a claim, not evidence — a non-compiling package will silently
mis-scope the whole downstream plan if the phantom symbol is trusted.

Rule trigger (for /improve to generalize, candidate R-{research-synthesizer/Explore}-verify-mined-symbol):
*before recording any mined code reference as an entity/convention finding during empathize, compile the
referencing package and classify the symbol as present / mislocated / phantom.*
