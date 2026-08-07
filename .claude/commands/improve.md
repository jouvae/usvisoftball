---
description: >
  Close the learning loop. Default mode captures lessons from a feature's cycle into the
  Supabase `lessons` table and ratifies rules (gated) into the six path-scoped files in
  .claude/rules/. --consolidate runs the Verify & Prune pass over the ratified rule set
  (dedup, retire dead concepts, move rules down the ladder to gates, check for
  contradiction). Governed by .claude/rules/LEARNING-LOOP.md — the repo holds only
  ratified rules; everything unratified lives in Supabase.
---

Read `.claude/rules/LEARNING-LOOP.md` first — it owns the maturity ladder, the ratification policy,
and the lesson-row schema. Then read `.claude/skills/improve/SKILL.md` and follow its instructions.

$ARGUMENTS
