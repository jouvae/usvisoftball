#!/usr/bin/env bash
#
# scope-check.sh - verifies the working tree only modifies files listed in
# plan.md for the given feature.
#
# Usage: scope-check.sh <feature-name> [--base <ref>]
#
# Compares the diff between --base (default: HEAD) and the working tree.
# Any file that is modified, added, or deleted that is NOT in plan.md's
# file list is a scope violation.
#
# Exit codes:
#   0 - all changes within scope
#   1 - one or more out-of-scope changes
#   2 - script error

set -euo pipefail

FEATURE="${1:-}"
shift || true

BASE="HEAD"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$FEATURE" ]]; then
  echo "usage: scope-check.sh <feature-name> [--base <ref>]" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

PLAN="docs/features/$FEATURE/plan.md"
if [[ ! -f "$PLAN" ]]; then
  echo "error: $PLAN not found" >&2
  exit 2
fi

# Extract the list of in-scope files from plan.md.
# Files appear as bullet items under "### New files" and "### Modified files".
mapfile -t IN_SCOPE < <(awk '
  /^### (New|Modified) files/ { in_section = 1; next }
  /^##/ && in_section { in_section = 0 }
  in_section && /^- / {
    line = $0
    sub(/^- /, "", line)
    sub(/[[:space:]]+—.*$/, "", line)  # strip em-dash and trailing reason
    sub(/[[:space:]]+--.*$/, "", line)
    sub(/[[:space:]]*$/, "", line)
    if (length(line) > 0) print line
  }
' "$PLAN")

# Always allow the feature's own docs directory and the status file
IN_SCOPE+=("docs/features/$FEATURE/plan.md")
IN_SCOPE+=("docs/features/$FEATURE/scenarios.md")
IN_SCOPE+=("docs/features/$FEATURE/status.yaml")
IN_SCOPE+=("docs/features/$FEATURE/observations.md")

# Get the list of changed files: tracked diff vs base, staged diff, plus untracked.
mapfile -t CHANGED < <({
  git diff --name-only "$BASE" -- 2>/dev/null || true
  git diff --name-only --cached -- 2>/dev/null || true
  git ls-files --others --exclude-standard 2>/dev/null || true
} | sort -u | grep -v '^$' || true)

violations=0
for f in "${CHANGED[@]}"; do
  found=0
  for s in "${IN_SCOPE[@]}"; do
    if [[ "$f" == "$s" ]]; then
      found=1
      break
    fi
  done
  if [[ $found -eq 0 ]]; then
    echo "  out of scope: $f"
    violations=$((violations+1))
  fi
done

if [[ $violations -gt 0 ]]; then
  echo ""
  echo "scope-check: $violations violation(s)"
  echo "to expand scope, edit $PLAN and re-run Quality Gate 2"
  exit 1
fi

echo "scope-check: ok (${#CHANGED[@]} files changed, all in scope)"
exit 0
