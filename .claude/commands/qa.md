---
description: >
  Phase 1.5 — Plan QA Review. Validates a BDD plan before implementation by
  orchestrating nextjs-qa-reviewer and go-qa-reviewer subagents in parallel.
  Reads scenarios and artifact references from the Neo4j graph, checks all
  referenced files exist on disk, then delegates cross-domain validation to
  the reviewers. Merges their reports into a single plan-review-{N}.md verdict.
  Never modifies plan artifacts — read-only review gate.
---

Read `.opencode/commands/qa.md` and follow its instructions.

$ARGUMENTS
