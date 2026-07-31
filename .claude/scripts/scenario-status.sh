#!/usr/bin/env bash
#
# scenario-status.sh - regenerates docs/features/{feature}/status.yaml from
# embedded scenario blocks plus the most recent test execution results.
#
# Usage: scenario-status.sh <feature-name>
#
# Test result lookup:
#   - .claude/cache/test-results/{feature}.json (optional, written by your
#     test runner). If absent, falls back to frontmatter status only.

set -euo pipefail

FEATURE="${1:-}"
if [[ -z "$FEATURE" ]]; then
  echo "usage: scenario-status.sh <feature-name>" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

PLAN="docs/features/$FEATURE/plan.md"
STATUS_FILE="docs/features/$FEATURE/status.yaml"
TEST_RESULTS=".claude/cache/test-results/$FEATURE.json"

if [[ ! -f "$PLAN" ]]; then
  echo "error: $PLAN not found" >&2
  exit 2
fi

mapfile -t TEST_FILES < <({
  grep -oE '[a-zA-Z0-9_/.\-]+_test\.go' "$PLAN" || true
  grep -oE '[a-zA-Z0-9_/.\-]+\.(test|spec)\.(tsx?|jsx?)' "$PLAN" || true
} | sort -u)

# Extract one record per scenario block: file<TAB>line<TAB>k=v<TAB>k=v...
RAW="$(mktemp)"
SORTED="$(mktemp)"
trap 'rm -f "$RAW" "$SORTED"' EXIT

for file in "${TEST_FILES[@]}"; do
  [[ -f "$file" ]] || continue
  awk -v f="$file" '
    function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }

    /\/\*/ { if (!in_block) { in_block = 1; block_start = NR; in_fm = 0; fm_lines = 0; delete fm; next } }

    in_block && /\*\// {
      if (fm_lines > 0) {
        printf("%s\t%d", f, block_start)
        for (k in fm) {
          v = fm[k]; gsub(/\t/, " ", v)
          printf("\t%s=%s", k, v)
        }
        printf("\n")
      }
      in_block = 0; in_fm = 0; fm_lines = 0; delete fm
      next
    }

    in_block {
      line = trim($0)
      if (line == "---") {
        if (in_fm == 0) { in_fm = 1; next }
        else { in_fm = 2; next }
      }
      if (in_fm == 1 && line != "") {
        colon = index(line, ":")
        if (colon > 1) {
          key = substr(line, 1, colon - 1)
          val = substr(line, colon + 1)
          sub(/^[[:space:]]+/, "", val)
          if (key ~ /^[a-zA-Z_]+$/) {
            if (key == "name") { sub(/^"/, "", val); sub(/"$/, "", val) }
            fm[key] = val
            fm_lines++
          }
        }
      }
    }
  ' "$file" >> "$RAW"
done

# Sort by id for deterministic output. Prepend the id as a sort key.
while IFS= read -r row; do
  [[ -z "$row" ]] && continue
  id="$(echo "$row" | tr '\t' '\n' | grep '^id=' | head -1 | sed 's/^id=//' || true)"
  [[ -z "$id" ]] && continue
  printf "%s\t%s\n" "$id" "$row" >> "$SORTED"
done < "$RAW"

if [[ -s "$SORTED" ]]; then
  sort -t$'\t' -k1,1 "$SORTED" -o "$SORTED"
fi

get_effective_status() {
  local id="$1"
  local fm_status="$2"

  if [[ "$fm_status" == "refactored" || "$fm_status" == "done" ]]; then
    echo "$fm_status"; return
  fi

  if [[ ! -f "$TEST_RESULTS" ]] || ! command -v jq >/dev/null 2>&1; then
    echo "$fm_status"; return
  fi

  local result
  result="$(jq -r --arg id "$id" '.[$id] // "unknown"' "$TEST_RESULTS" 2>/dev/null || echo "unknown")"
  case "$result" in
    pass) echo "green" ;;
    fail_assertion) echo "red" ;;
    fail_not_implemented) echo "scaffolded" ;;
    *) echo "$fm_status" ;;
  esac
}

# Parse a row into key-value pairs into an associative array named "fm" in caller's scope.
# Usage: parse_row "$row"
parse_row() {
  local row="$1"
  fm=()
  local rest="$row"
  # Drop file and line (first two tab-separated fields)
  rest="${rest#*$'\t'}"
  rest="${rest#*$'\t'}"
  while [[ -n "$rest" ]]; do
    local kv
    if [[ "$rest" == *$'\t'* ]]; then
      kv="${rest%%$'\t'*}"
      rest="${rest#*$'\t'}"
    else
      kv="$rest"; rest=""
    fi
    [[ -z "$kv" || "$kv" != *=* ]] && continue
    local k="${kv%%=*}"
    local v="${kv#*=}"
    fm[$k]="$v"
  done
}

# Aggregates
total=0
declare -A by_status=([pending]=0 [scaffolded]=0 [red]=0 [green]=0 [refactored]=0 [done]=0)
declare -A by_stack=([go]=0 [web]=0 [e2e]=0)

while IFS=$'\t' read -r sortkey row; do
  [[ -z "$row" ]] && continue
  declare -A fm
  parse_row "$row"
  id="${fm[id]:-}"; [[ -z "$id" ]] && { unset fm; continue; }
  effective="$(get_effective_status "$id" "${fm[status]:-}")"
  by_status[$effective]=$(( ${by_status[$effective]:-0} + 1 ))
  [[ -n "${fm[stack]:-}" ]] && by_stack[${fm[stack]}]=$(( ${by_stack[${fm[stack]}]:-0} + 1 ))
  total=$(( total + 1 ))
  unset fm
done < "$SORTED"

mkdir -p "$(dirname "$STATUS_FILE")"
{
  echo "feature: $FEATURE"
  echo "generated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "generated_by: scripts/scenario-status.sh"
  echo "total: $total"
  echo "by_status:"
  for s in pending scaffolded red green refactored done; do
    echo "  $s: ${by_status[$s]:-0}"
  done
  echo "by_stack:"
  for s in go web e2e; do
    echo "  $s: ${by_stack[$s]:-0}"
  done
  echo "scenarios:"

  while IFS=$'\t' read -r sortkey row; do
    [[ -z "$row" ]] && continue
    file="$(echo "$row" | cut -f1)"
    line="$(echo "$row" | cut -f2)"
    declare -A fm
    parse_row "$row"
    id="${fm[id]:-}"; [[ -z "$id" ]] && { unset fm; continue; }
    effective="$(get_effective_status "$id" "${fm[status]:-}")"

    echo "  - id: $id"
    echo "    name: \"${fm[name]:-}\""
    echo "    file: $file"
    echo "    line: $line"
    echo "    status: $effective"
    echo "    priority: ${fm[priority]:-}"
    echo "    group: ${fm[group]:-}"
    echo "    stack: ${fm[stack]:-}"
    echo "    references: ${fm[references]:-[]}"
    unset fm
  done < "$SORTED"
} > "$STATUS_FILE"

echo "scenario-status: wrote $STATUS_FILE ($total scenarios)"
