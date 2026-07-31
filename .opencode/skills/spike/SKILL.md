---
name: spike
description: Analyze a feature request and produce a spike document with user stories, technical assessment, and recommendations.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Analyze a feature request and produce a spike document with user stories, technical assessment, and recommendations.

## Inputs

- Inline instructions or file path to feature description

## Process

1. **Understand the feature** — Read the feature description and identify scope, user needs, and constraints.
2. **Analyze the codebase**:
   - **Go backend**: Find relevant services, proto files, migrations, and tests.
   - **Next.js frontend**: Find relevant components, API routes, types, and tests.
   - **Shared concerns**: Auth patterns, idempotency, error handling, tracing.
3. **Identify risks & open questions** — What's unclear, what could go wrong, what decisions are needed.
4. **Formulate questions** — Specific, answerable questions for the user.
5. **Provide recommendations** — Suggested approach, architecture, and implementation order.
6. **Write spike document** to `docs/features/{feature}/spike.md`.

## Spike Document Format

```markdown
# {Feature Name} — Spike

## Overview
2-3 sentence description of the feature and its business value.

## User Stories
- As a {role}, I want to {action} so that {benefit}.

## Current State Analysis

### Existing Types Map
| Concept | Location | Status |
|---------|----------|--------|
| Entity | path/to/file | New/Existing/Modified |

### Technical Assessment

#### Backend Changes
- New proto service/messages
- New migration types
- New service handlers
- New/Modified Dorothy routes

#### Frontend Changes
- New components
- New API routes
- New types
- New test pages

### Recommendations
- Suggested implementation order
- Architectural decisions
- Dependency considerations

### Open Questions
- Question 1
- Question 2

### Revision History
| Date | Author | Change |
|------|--------|--------|
```

## Output Format

Brief summary including:
- Top 3-5 follow-up questions for the user
- Primary recommendation
- Path to spike document
