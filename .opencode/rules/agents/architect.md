# architect — learned rules

Accumulated rules from prior features. Loaded by `.opencode/agents/architect.md`.
Schema + lifecycle policy: [`../LEARNING-LOOP.md`](../LEARNING-LOOP.md).
Budget: ~40 records. Graduate validated rules into `go-standard.md`.

---

### R-architect-enum-map-sync
- trigger: adding a value to an enum that is consumed by a `Record<>`-typed map or a Go `map`/`switch` requiring every enum value
- rule: update every consumer map/transition table that keys on that enum in the same change; grep the enum's consumers before returning
- status: binding
- confidence: high
- source: 05-29-2026-create-reservations
- promoted: 2026-05-29
- last_validated: 2026-05-29
- recurrences_after: 0
- gate: none

### R-architect-zed-authoritative
- trigger: touching a reservation/booking/section/calendar relation or the `RelationName` enum
- rule: `configs/spicedb/main.zed` is authoritative; update `main.zed`, the `RelationName` enum, and `relationNameToString` together, then run the identity test suite. Proto enums bend to the schema, never the reverse.
- status: binding
- confidence: high
- source: refactor-plan §4.C (C-D2); identity-service-todo #1
- promoted: 2026-06-24
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none

### R-architect-no-retired-domains
- trigger: defining or referencing a SpiceDB definition or subject type
- rule: never reintroduce `experience_domain`/`identity_domain`/`vault_domain` (replaced by `workspace_*_section`) or `guest` subject (now `identity`/`idn_…`); do not expand `experience`/`experience_provider` surface without a confirmed domain decision (ADR-6, experiences→listings)
- status: binding
- confidence: high
- source: refactor-plan §4.B/§4.C; audit domain review
- promoted: 2026-06-24
- last_validated: 2026-06-24
- recurrences_after: 0
- gate: none
