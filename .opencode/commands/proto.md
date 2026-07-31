---
description: Enter live, full-stack Prototyping Mode — design a feature (UI-first) directly in the running app, against the real backend, in tight visible loops. Orchestrates architect, nextjs-tester, nextjs-implementer, and (when needed) go-tester / go-implementer. One slice at a time.
---

# Prototyping Mode

You are entering **Prototyping Mode**. The user is sitting in front of the app and wants to chat, watch changes appear in the browser in real time, play with them, and steer the next step.

**What to prototype:** $ARGUMENTS

## Step 0 — Preflight

1. **Frontend up?** `curl -sf -o /dev/null -w "%{http_code}" http://alpha.jouvae.com`
2. **Backend reachable?** `curl http://api.alpha.jouvae.com/api/v1/health/check` with proper headers
3. **Mock mode MUST be off:** grep `NEXT_PUBLIC_MOCK_MODE` in `clients/web/.env.local`

## Core principles

1. **Live-first.** Every change must be immediately visible in the running app.
2. **Smallest visible slice.** Pick the smallest increment that produces something the user can see.
3. **UI-first, real data underneath.**
4. **Never use mock mode.**
5. **Tests trail confirmed reality.**
6. **One slice at a time. Hard stop after each.**
7. **Never write implementation or test code yourself.** You orchestrate agents.
8. **Keep the handoff doc live.**

## The prototyping loop

### 1. Align
Restate the smallest next slice in one line.

### 2. Shape it with the architect
Spawn the **architect** agent to sketch the slice.

### 3. QA review the plan
Run `go-qa-reviewer` and/or `nextjs-qa-reviewer`.

### 4. Decide the data path
- **Existing RPC?** Use it.
- **No RPC exists?** go-tester → go-implementer.

### 5. Build the UI slice
nextjs-tester → nextjs-implementer.

### 6. Self-verify against the live app
Use playwright-cli or curl.

### 7. Hand off and wait — HARD STOP

### 8. Learn — update commands and agents from this session

## Agent responsibilities

| Agent | Trigger | What they do |
|---|---|---|
| architect | Every non-trivial slice | Sketches the plan |
| go-qa-reviewer | New Go/proto/gRPC changes | Reviews backend plan |
| nextjs-qa-reviewer | New frontend changes | Reviews frontend plan |
| go-tester | New backend endpoint | Writes failing test |
| go-implementer | After go-tester has red test | Makes test pass |
| nextjs-tester | Every UI slice | Writes failing Playwright e2e |
| nextjs-implementer | After nextjs-tester has red test | Implements UI |

## Report format

- **Built:** one line on the slice + files touched
- **Look at it:** exact URL + what to click
- **Data:** existing RPC reused, or new endpoint added
- **Backend:** healthy?
- **Test:** e2e path + run command
- **Waiting for:** what you need from the user
