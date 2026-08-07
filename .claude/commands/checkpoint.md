---
description: Persist current progress to durable memory + the feature handoff doc so a new session can resume exactly where this one left off.
---

# Checkpoint — save progress for a clean session handoff

The user is about to clear context. Capture everything needed to resume this work in a
fresh session **with no memory of this conversation**. Optional scope/note: **$ARGUMENTS**

## Context (current repo reality)

- Branch: !`git branch --show-current 2>/dev/null`
- Uncommitted changes: !`git status --short 2>/dev/null | head -50`
- Recent commits: !`git log --oneline -8 2>/dev/null`

## What to do

### 1. Establish the work
Identify the active task/feature from this conversation (and `$ARGUMENTS` if given): what
was the goal, what's DONE, what's IN PROGRESS, what's NEXT, and any decisions the user locked
in. Note the build/test/verification state you last observed.

### 2. Update durable memory
Write to your persistent file-based memory (the `MEMORY.md` index + one file per fact).

- **Find the existing memory file** for this feature/task and UPDATE it.
- Put a scannable **`## ▶ RESUME (as of <absolute date>)`** block at the TOP.
- Update that memory's `description:` frontmatter and its entry in `MEMORY.md`.
- Delete any memory line that this checkpoint proves wrong.

### 3. Update the feature handoff doc
If a handoff/architecture/status doc exists, update its status/implementation section.

### 4. Do NOT commit
Saving progress means memory + docs, not git.

### 5. Report back
Print a concise summary: the files you updated, the one-line current state, and the exact
NEXT step a new session should start with.

$ARGUMENTS
