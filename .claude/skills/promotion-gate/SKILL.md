---
name: promotion-gate
description: The prototype-to-shippable debt audit run at the start of /actualize. A checklist that finds and RESOLVES prototype-quality debt — TODOs, hardcoded secrets/values, missing error paths, throwaway data shapes, absent tests — rather than scanning around it. The first step before any test backfill or gate.
metadata:
  audience: developers
  workflow: eca
---

## What I Do

Define the **promotion gate**: the audit that turns prototype debt into shippable
code at the start of `/actualize`. A prototype built in the main codebase may be most
of a feature, but it carries the shortcuts prototyping intentionally allowed. This
gate finds them and **resolves** them — it does not document-and-skip.

## The audit checklist

Run across the prototyped surface (the files touched in `/conceptualize`). For each
item: find every instance, then fix it. Dispatch contract fixes to **architect**,
backend to **go-implementer**, frontend to **nextjs-implementer**.

1. **TODOs / FIXME / placeholder comments** — resolve or convert to a tracked,
   scoped item in `changelog.md`. None survive into a shipped scenario.
2. **Hardcoded secrets / values** — no inline keys, tokens, URLs, or magic values.
   Secrets move to env/secrets config; values become constants or config. (Secret
   *rotation* is a human checklist item, not something the loop does.)
3. **Missing error paths** — every RPC/handler/component handles its failure, loading,
   and empty states (frontend per `DESIGN.md` tier-2 rules). No happy-path-only code.
4. **Throwaway data shapes** — prototype structs/JSON blobs become real contracts:
   proto messages + GORM migration types via **architect**, never ad-hoc shapes
   inside handlers or components.
5. **Absent tests** — note every scenario lacking a test; the test backfill (next
   `/actualize` step) covers them. The gate's job is to make the code *testable*
   (thin orchestrators, injected deps), not to write the tests.
6. **Scope creep from prototyping** — anything built beyond the scenarios is flagged
   per the `scope-discipline` skill: keep it only if it earns a scenario, else cut it.
7. **Convention drift** — `useApis` not raw `fetch`; `gormClient` not a Repository
   interface; tests RPC-only; proto-first types. (These are the conventions that bite
   in DEV_FLOW.md / AGENTS.md.)

## Output

Append a resolved-debt summary to `changelog.md`:
```
promotion-gate {YYYY-MM-DD}: resolved {N} items
  - {item} → {resolution}
deferred (tracked): {item} → {why, owner}
```

## Critical rules

1. **Resolve, don't scan around.** A documented TODO left in shipped code is a gate
   failure, not a pass.
2. **Throwaway shapes become real contracts** — route them through architect; never
   ship an ad-hoc data shape.
3. **The gate makes code testable; it does not write tests** — that is the tester's
   job in the backfill step.
4. **Secret values are removed; secret rotation is a human checklist item** — surface
   it, don't fake it.
