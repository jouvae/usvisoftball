---
name: information-architecture
description: Distil the event-storming model + research into an Information Architecture artifact with two halves — UX/product IA (screen & route inventory, navigation map, per-surface content) and domain IA (bounded contexts, aggregates, entity map). Invoked by /empathize after /event-storm; its output is the structure /conceptualize prototypes against.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Turn the shared domain model into **structure**. After `/event-storm` produces the
chronological model, I distil it (plus `overview.md`, `research/`, `docs/entities.md`,
and any spec/uxui docs) into one artifact —
`docs/features/{group}/{feature}/information-architecture.md` — with **two halves**:

1. **UX / product IA** — the screen & route inventory, the navigation map, and what
   information lives on each surface. This is the skeleton `/conceptualize` prototypes.
2. **Domain IA** — the bounded contexts, aggregates, and entity-relationship map drawn
   from the event storming and reconciled to `docs/entities.md`. This is the seam the
   prototype (and later `/plan`) builds against.

This is **Step 5.6 of `/empathize`** (after `/event-storm`, before the BDD scenarios).
Also independently invokable: `/information-architecture {group}/{feature}`.

## How the two halves derive from the event storm

| Event-storm element | Becomes (UX IA) | Becomes (Domain IA) |
|---|---|---|
| 🟩 Read model / view | a **screen / panel** | — |
| 🟦 Command | a **CTA / action** on a screen | an operation on an aggregate |
| 🟨 Actor / role | a **navigation entry point** / audience per screen | a context boundary owner |
| 🟧 Domain event | a **state change** reflected in the UI status model | a domain event the aggregate emits |
| 🟫 Aggregate / entity | the **entity a screen renders** | a node in the entity map |
| 🟪 Policy | an **auto-state / system activity** shown in the UI | a reaction across aggregates |
| 🟥 External system | an **out-of-band status** (sync/async ack) | an integration boundary |
| ⬛ Bounded context | a **navigation section** | a **service/module seam** |
| 🔴 Hotspot | an **unresolved screen/flow** (mark TBD) | an unresolved boundary (mark TBD) |

So nothing is invented: every screen traces to a read model + the commands available
on it; every entity-map node traces to an aggregate.

## Process

1. **Read the inputs.** `event-storming.md` (primary), `overview.md`, `research/`,
   `docs/entities.md`, plus any `spec.md` / `uxui.md` companion docs in the feature dir.
   If `event-storming.md` is missing, say so and recommend running `/event-storm` first.
2. **Build the UX IA.** Inventory the screens/routes (one per read model + entry/edit
   flows the commands imply), draw the navigation map (how an actor moves between them),
   and for each screen list its content, the actions (commands) available, and the status
   states it must render. Honour any `uxui.md` visual/state spec — IA is *structure*, not
   visual design, but it must be consistent with the UX spec.
3. **Build the domain IA.** List the bounded contexts (candidate service/module seams),
   the aggregates within each, the entity-relationship map, and the cross-context events
   that flow between them. Reconcile names to `docs/entities.md` and flag drift.
4. **Cross-link.** Each screen names the aggregate(s) it renders; each aggregate names
   the screen(s) that surface it. This is the bridge the prototype walks.
5. **Carry hotspots.** Pull unresolved 🔴 hotspots forward as explicit TBDs on the
   affected screen or boundary — never silently complete them.
6. **Persist** `information-architecture.md` (schema below); reconcile new/renamed
   entities into `docs/entities.md` (dated, *proposed*); append a `changelog.md` line.

## The artifact: `information-architecture.md`

```markdown
# Information Architecture — {group}/{feature}

**Updated:** {YYYY-MM-DD}   **Derived from:** event-storming.md ({pass}), research/, docs/entities.md

> Two halves: UX/product IA (what to prototype) + domain IA (what to build against).
> Every screen traces to a read model; every entity traces to an aggregate.

## Part 1 — UX / Product IA

### Screen & route inventory
| Screen | Route | Primary actor | Renders (aggregate) | Actions (commands) | Status states |
|---|---|---|---|---|---|

### Navigation map
<!-- How actors move between screens; entry points; back/forward; modal vs page. -->
{ascii/outline map: Section → Screen → Screen, with the commands that move between them}

### Per-surface content
- **{Screen}** — eyebrow/title/meta; primary + secondary actions; panels (e.g. issues,
  readiness, activity); empty/loading/error/partial states; the read model behind it.

### Status / state model (UI)
<!-- The status→label→colour→CTA mapping the UI is driven by (consistent across screens). -->
| State | Label | CTA | Surfaced where |

## Part 2 — Domain IA

### Bounded contexts (candidate seams)
- ⬛ {Context} — owns {aggregates/events}; candidate service/module: {…}; talks to {context} via {event}.

### Aggregate & entity map
<!-- Nodes = aggregates/entities; edges = relationships (1–N, owns, references). Reconciled to entities.md. -->
{outline or table of Entity → relationship → Entity, registry status}

### Cross-context event flow
- {Context A} —{event}→ {Context B} — {sync|async}, {why}

## TBD / carried hotspots
- {screen or boundary} — {open question from event-storming.md} — resolve in {phase}

## Handoff
- /conceptualize prototypes the Part-1 screens against the Part-2 seams, one slice at a time.
- Entity-map changes are *proposed* until ratified in /plan.
```

## Boundaries
- **Structure, not visual design.** Inventory and relationships, not pixels/components —
  but stay consistent with `uxui.md` where one exists.
- **Structure, not implementation.** No protos, schemas, or framework choices (that's
  `/plan`). Aggregates name *what* protects an invariant, not *how* it's stored.
- **Don't fabricate.** Every screen and entity traces to the event storm / corpus /
  `docs/entities.md`. Gaps become TBDs, not guesses.
- **Keep `status.md`/`changelog.md` current** per the standing ECA requirement.
