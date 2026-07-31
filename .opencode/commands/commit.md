---
description: Analyze uncommitted changes and create a detailed, accurate commit message.
model: opencode/big-pickle
---

## Context

- Current branch and recent history: !`git log --oneline -5 2>/dev/null || echo "No commits yet"`
- Working tree status: !`git status --short`
- Full diff of all uncommitted changes (staged + unstaged): !`git diff HEAD 2>/dev/null || git diff --staged 2>/dev/null || echo "No changes detected"`

## Task

Create a detailed, accurate git commit for all current uncommitted work.

### Step 1: Understand the Changes

Carefully read through the full diff. For every file changed, identify:
- **What** was changed
- **Why** it was likely changed
- **How** the changes relate to each other

### Step 2: Check for Problems Before Committing

Scan the diff for:
- `TODO`, `FIXME`, `HACK`, `XXX` comments
- Commented-out code blocks
- Debugging artifacts (`console.log`, `print()`, `debugger`)
- Hardcoded test data or mocked values
- Leftover merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
- Credentials, API keys, or secrets

If any are found, stop and ask before proceeding.

### Step 3: Prevent Committing Disallowed Files

Ensure `.gitignore` exists with rules for env files, build artifacts, dependencies, logs, etc.

### Step 4: Write the Commit Message

Format:
```
<type>(<scope>): <concise summary in imperative mood, max 72 chars>

<detailed body explaining WHAT changed and WHY>

- Group related changes together
- Reference specific files/modules
- Explain non-obvious decisions
```

**Type** must be one of: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`.

### Step 5: Commit

Run `git commit` with the message. Do NOT add any AI attribution, co-authorship tags, or generated-by markers.

### Argument Handling

If the user provided arguments (`$ARGUMENTS`), use them as high-level context.
