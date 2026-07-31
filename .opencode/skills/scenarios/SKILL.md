---
name: scenarios
description: Authoritative format for BDD scenario blocks embedded in test files, scenario ID conventions, and rules for writing them.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Define the authoritative format for BDD scenario blocks embedded in test files, scenario ID conventions, and rules for writing them.

## Scenario ID Format

`{feature}-{stack}-{NNN}` where stack is `go`, `web`, or `e2e`.

Example: `contacts-go-001`, `auth-web-002`, `onboarding-e2e-003`

## scenarios.md Format

Human-authored Gherkin file at `docs/features/{feature}/scenarios.md`:

```markdown
# {feature} Scenarios

## {feature}-go-001: {description}
- **Priority**: P0|P1|P2
- **Group**: A|B|C
- **Stack**: go|web|e2e

**Given** {context}
**When** {action}
**Then** {observable outcome}
```

## Embedded Scenario Block Format

In Go test files:
```go
/*
---
id: reservations-go-001
name: "reservations-go-001: Unauthenticated request rejected"
feature: reservations-v4
stack: go
priority: P1
status: scaffolded
group: A
references:
  - apis/protos/experiences/reservations.proto
---

## Given
A request is submitted without a valid authentication token.

## When
The system evaluates the request.

## Then
The request is rejected with codes.Unauthenticated.
*/
```

In TypeScript/Next.js test files:
```typescript
/*
---
id: contacts-web-001
name: "contacts-web-001: Create contact form"
feature: workspace-contacts
stack: web
priority: P1
status: scaffolded
group: A
references:
  - clients/web/src/types/contacts.ts
---

## Given
An authenticated workspace member is on the contacts page.

## When
They fill out the create contact form and submit.

## Then
The new contact appears in the contacts list.
*/
```

## Required Frontmatter Fields

- `id` — Scenario ID
- `name` — Human-readable name with ID prefix
- `feature` — Feature name
- `stack` — go, web, or e2e
- `priority` — P0, P1, P2
- `status` — pending, scaffolded, red, green, refactored, done
- `group` — Parallel execution group (A, B, C, ...)
- `references` — List of file paths to related artifacts

## Status Lifecycle

pending → scaffolded → red → green → refactored → done

## Hard Rules

1. Scenario files only describe behavior — no implementation details.
2. Do not inline proto definitions, migration structs, or TS interfaces in scenario files.
3. Every scenario must reference real files in the codebase.
4. Scenario names must describe user/client behaviors, not internal functions.
5. Every scenario must include authorization coverage (unauthenticated + permission-denied).
6. Error conditions are part of each scenario's success criteria, not separate scenarios.
