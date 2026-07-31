---
name: scope-discipline
description: Rules for staying within the agreed scope of a feature implementation. No "while I'm in here" fixes, no proactive refactoring, no new dependencies without plan entry.
metadata:
  audience: developers
  workflow: bdd
---

## What I Do

Enforce scope discipline during feature implementation. The file list in `plan.md` is exhaustive — read unrestricted, write restricted to the plan.

## Rules

1. **The file list in `plan.md` is exhaustive.** You may read any file in the repo, but you may only write to files listed in the plan.
2. **No "while I'm in here" fixes.** If you discover a bug in a file you're already touching, follow the scope expansion procedure instead of fixing it inline.
3. **No proactive refactoring.** Even if you see a cleaner way to structure existing code, leave it alone. The plan is the contract.
4. **No new dependencies without plan entry.** If implementation reveals a needed package not in the plan, follow scope expansion.
5. **The scenario list is also exhaustive.** If you find behavior that isn't covered by a scenario, do not implement it — flag it to the caller.
6. **When tempted to expand scope:** write the observation to `docs/features/{feature}/observations.md` with a one-line description and rationale.

## What Scope Creep Usually Looks Like

- "Since I'm fixing the validation function, I'll also fix the error messages for the whole module."
- "This component is similar to the one I'm building, I'll refactor it too."
- "I noticed this API route is missing error handling, I'll add it while I'm here."
- "This test file has a typo in a comment, I'll fix it."

## Scope Expansion Procedure

1. Pause current work
2. Note what you need in `observations.md`
3. Continue with the original scope
4. Report the expansion need in your output for the caller to decide
