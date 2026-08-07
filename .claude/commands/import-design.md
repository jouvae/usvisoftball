---
description: Download a Claude Design artifact zip/tar.gz from a URL, extract it, analyze its contents, and generate an implementation plan via the plan skill. Useful for importing externally authored design specs (protos, types, structs, flows) into the BDD feature pipeline.
---

# /import-design

Import design artifacts from a Claude Design URL, extract them, derive the feature name, and kick off the BDD pipeline.

## Inputs

- `$1` — URL to a `.zip` or `.tar.gz` file
- `$2+` — optional flags: `--feature <name>`, `--skip-plan`, `--plan-only`

## Procedure

### Step 1 — Resolve Parameters

```bash
URL="$1"
FEATURE=""
SKIP_PLAN=false
PLAN_ONLY=false
```

### Step 2 — Verify Prerequisites

curl, unzip, tar, python3 must be available.

### Step 3 — Download the Artifact

```bash
TMPDIR=$(mktemp -d /tmp/import-design-XXXXXX)
curl -sL -o "$DOWNLOAD_PATH" "$URL"
```

### Step 4 — Extract

Support `.zip`, `.tar.gz`, `.tgz`, `.gz`.

### Step 5 — Read and Analyze Artifacts

Classify files by type: protos, types/ts, models/go, flows/md, tests, configs, other.

### Step 6 — Derive Feature Name

From `--feature` flag or auto-detect from extracted content.

### Step 7 — Stage Artifacts

| Class | Target directory |
|-------|-----------------|
| protos | `apis/protos/{service}/` |
| types/ts | `clients/web/src/types/` |
| models/go | `libs/go/postgres/migrations/` |
| flows | `docs/features/$FEATURE/` |
| tests | `services/alpha/modules/{svc}/tests/` |

### Step 8 — Generate Spike Document

Write `docs/features/$FEATURE/spike.md`.

### Step 9 — Generate Scenarios

Run `/create-scenarios $FEATURE --files`.

### Step 10 — Run Plan

Unless `--skip-plan` was passed, run the plan skill.

### Step 11 — Report

## Constraints

- Do not delete or overwrite existing files without prompting.
- Downloaded archives are cleaned up on exit.

$ARGUMENTS
