---
name: event-storm
description: Run an interactive Big-Picture EventStorming session — a live back-and-forth between the human and the agent that surfaces the domain as actors, commands, domain events, policies, aggregates, read models, external systems, and hotspots, then writes it to event-storming.md. Invoked by /empathize after synthesis; its output feeds the information-architecture artifact and the /conceptualize prototype.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Facilitate a **live, interactive EventStorming session** for a feature. The human and
I build the domain model **together, in the main conversation** — I propose elements,
the human corrects/adds/removes, we converge — and I persist the agreed model to
`docs/features/{group}/{feature}/event-storming.md`.

This is **Step 5.5 of `/empathize`** (after the research-synthesizer pass, before the
Information Architecture artifact and the BDD scenarios). It is also independently
invokable: `/event-storm {group}/{feature}`.

The point is *shared understanding before prototyping*: a chronological event model
that names every actor, command, event, policy, aggregate, read model, external
system, and open question. `/information-architecture` distils it into structure; the
`/conceptualize` prototype is steered against it, so we prototype the right thing.

## The sticky vocabulary (EventStorming elements)

I model the domain with the canonical EventStorming notation. Every element gets a
colour name so the artifact reads like a physical board.

| Element | Colour | Meaning | Phrasing |
|---|---|---|---|
| **Domain Event** | 🟧 orange | A thing that *happened*, past tense. The backbone of the timeline. | `NoticeSubmittedToCARICOM`, `PassportAdded` |
| **Command** | 🟦 blue | An intent/action that *causes* an event. | `SubmitNotice`, `AddGuestToBooking` |
| **Actor / Role** | 🟨 yellow | The person/role issuing a command. | `Charter Operator`, `Primary-workspace Reviewer` |
| **Aggregate / Entity** | 🟫 pale-yellow | The consistency boundary a command lands on and an event mutates. Maps to `docs/entities.md`. | `Manifest`, `Instance`, `Booking` |
| **Policy / Reaction** | 🟪 lilac | "**Whenever** \<event\> **then** \<command\>" — the rules that chain events to new commands (incl. time-based: "24h before arrival"). | `Whenever ManifestValidated → enable SubmitNotice` |
| **Read Model / View** | 🟩 green | The information a actor reads to decide the next command (the seed of a screen). | `Submission Readiness panel`, `Passenger roster` |
| **External System** | 🟥 pink | A system outside our boundary we call or that calls us. | `CARICOM eAPIS`, `Calendar service`, `Stripe` |
| **Hotspot / Question** | 🔴 red | A conflict, unknown, risk, or disagreement to resolve. **Never silently dropped.** | "Is acknowledgement sync or async?" |
| **Bounded Context / Subdomain** | ⬛ frame | A cohesive cluster of the above with its own language; names a service/module seam. | `Notice Filing`, `Manifest Assembly` |

A healthy model has an event for every command, an actor for every command, an
aggregate every command targets, and a policy for every "and then automatically…".
Hotspots are a feature, not a failure — they become the questions empathize answers
and the risks `/triage` weighs.

## The interactive protocol (this is the core of the skill)

Run it as a **conversation, one pass at a time — hard stop and wait after each pass.**
Never generate the whole board in one shot and call it done; the value is in the
back-and-forth. Ground every pass in the corpus already gathered (`overview.md`,
`research/`, `docs/entities.md`, any spec/uxui docs, the codebase).

1. **Frame (1 message).** Restate the feature's spine in one line and the slice of the
   domain this session covers. Confirm the starting corpus with the human.
2. **Pass 1 — Chaotic event sweep (orange first).** Propose the domain events on the
   timeline, **past tense, roughly time-ordered**, walking the spine end to end. Keep
   them observable ("NoticeAcknowledged"), not technical ("rowUpdated"). Present as a
   numbered list. **Stop. The human adds/renames/removes/reorders.**
3. **Pass 2 — Commands & actors.** For each agreed event, propose the command that
   causes it and the actor who issues it. Surface where one event triggers another via
   a **policy** (lilac). **Stop. Human refines.**
4. **Pass 3 — Aggregates & read models.** Attach each command to the aggregate it lands
   on (reconcile names against `docs/entities.md` — flag drift), and name the read
   model each actor consults before acting. **Stop. Human refines.**
5. **Pass 4 — External systems & boundaries.** Mark the pink external systems and draw
   the bounded-context frames (candidate service/module seams). **Stop. Human refines.**
6. **Pass 5 — Hotspots & convergence.** Collect every 🔴 hotspot raised along the way,
   add any the human flags, and confirm the model is "good enough to prototype against"
   (it never needs to be exhaustive — EventStorming is deliberately incomplete-but-shared).
7. **Persist.** Write/refresh `event-storming.md` (schema below). Reconcile any new or
   renamed entity into `docs/entities.md` with a dated, *proposed* changelog entry (same
   discipline as every ECA phase). Append a `changelog.md` line.

Re-entrant: on resume, read the existing `event-storming.md` and continue from the last
pass rather than restarting.

### Facilitation rules
- **You facilitate; the human owns the truth.** Propose concretely (a real list to
  react to beats "what events do you see?"), but the human's correction always wins.
- **One pass, then stop.** Match the per-slice hard-stop discipline of `/conceptualize`.
- **Past tense for events, imperative for commands** — enforce the grammar; it keeps
  cause (command) and effect (event) honest.
- **Every "automatically/whenever/after N hours" is a policy** — make the rule explicit.
- **Capture disagreement as a hotspot, don't resolve it by fiat.**
- **Stay in the domain language** of the corpus and `docs/entities.md`; when you must
  coin a term, mark it a hotspot for ratification.

## The artifact: `event-storming.md`

```markdown
# Event Storming — {group}/{feature}

**Updated:** {YYYY-MM-DD}   **Session pass:** {1–5 | complete}   **Facilitator:** event-storm

> Big-Picture EventStorming model. Deliberately shared-but-incomplete. Hotspots are
> open questions, not defects. Entity names reconcile to docs/entities.md.

## Timeline (the spine)
<!-- Domain events in time order, the backbone. Group into phases if long. -->
1. 🟧 {EventInPastTense} — {one-line meaning}
   - 🟦 command: {Command} · 🟨 actor: {Role} · 🟫 aggregate: {Entity} · 🟩 reads: {View}
   - 🟪 policy: whenever this → {next command} {(time/condition)}
   - 🟥 external: {System} {(in/out)}
...

## Actors / roles
- 🟨 {Role} — {what they do, what they care about}

## Commands → Events (cause → effect)
| 🟦 Command | 🟨 Actor | 🟫 Aggregate | 🟧 Event(s) | 🟩 Read model |
|---|---|---|---|---|

## Policies (whenever → then)
- 🟪 Whenever {event} [condition] then {command} — {why}

## Read models / views
- 🟩 {View} — {what info, for whom, to decide what}

## External systems
- 🟥 {System} — {direction, contract, sync/async}

## Aggregates / entities (vs docs/entities.md)
- 🟫 {Entity} — {invariants it protects}; registry status: {matches | proposed change → entities.md A.x}

## Bounded contexts / subdomains
- ⬛ {Context} — {events/commands it owns}; candidate seam: {service/module}

## 🔴 Hotspots & open questions
- {Question/conflict/risk} — owner: {who answers} — blocks: {what}

## Handoff
- Feeds: information-architecture.md (structure) → conceptualize prototype (what to build).
- Unresolved hotspots carried to: {empathize problem statement | /triage risk | /plan}.
```

## Boundaries
- **Discovery, not design.** Model the domain; don't pick storage, frameworks, or APIs
  here (that's `/plan`). Tactical/Design-Level EventStorming can refine an aggregate
  later if a feature warrants it — Big-Picture is the empathize default.
- **No code.** This skill writes only the artifact + entity-registry reconciliation.
- **Don't fabricate.** Every element traces to the corpus, the codebase, or an explicit
  human statement. Anything invented is a 🔴 hotspot until the human ratifies it.
- **Keep `status.md`/`changelog.md` current** per the standing ECA requirement.
