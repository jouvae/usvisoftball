#!/usr/bin/env bash
#
# scenario-lint.sh - validates embedded scenario blocks across the codebase.
#
# Usage: scenario-lint.sh [feature-name]
#
# If feature-name is provided, only test files referenced by that feature's plan
# are checked. Otherwise, the entire repo is scanned.
#
# Exit codes:
#   0 - all scenario blocks valid
#   1 - one or more validation errors
#   2 - script error (missing dependencies, bad arguments)

set -euo pipefail

FEATURE="${1:-}"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# Locate test files to scan
if [[ -n "$FEATURE" ]]; then
  PLAN="docs/features/$FEATURE/plan.md"
  if [[ ! -f "$PLAN" ]]; then
    echo "error: $PLAN not found" >&2
    exit 2
  fi
  mapfile -t TEST_FILES < <({
    grep -oE '[a-zA-Z0-9_/.\-]+_test\.go' "$PLAN" || true
    grep -oE '[a-zA-Z0-9_/.\-]+\.(test|spec)\.(tsx?|jsx?)' "$PLAN" || true
  } | sort -u)
else
  mapfile -t TEST_FILES < <(find . -type f \( -name '*_test.go' -o -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -not -path './node_modules/*' -not -path './vendor/*')
fi

# Accumulate parsed scenarios, one per line:
# file<TAB>line<TAB>k=v<TAB>k=v...
RAW="$(mktemp)"
trap 'rm -f "$RAW"' EXIT

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
        # Portable key:value parse without gawk extensions
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

errors=0
declare -A seen_ids
declare -A all_ids
all_refs=()

while IFS=$'\t' read -r file line rest; do
  [[ -z "$file" ]] && continue

  declare -A fm=()
  # Re-tokenize the rest into k=v pairs
  remaining="$rest"
  while [[ -n "$remaining" ]]; do
    if [[ "$remaining" == *$'\t'* ]]; then
      kv="${remaining%%$'\t'*}"
      remaining="${remaining#*$'\t'}"
    else
      kv="$remaining"
      remaining=""
    fi
    [[ -z "$kv" ]] && continue
    k="${kv%%=*}"
    v="${kv#*=}"
    fm[$k]="$v"
  done

  id="${fm[id]:-}"
  stack="${fm[stack]:-}"
  feature="${fm[feature]:-}"
  status="${fm[status]:-}"
  name="${fm[name]:-}"
  refs="${fm[references]:-}"

  for field_name in id stack feature status name; do
    if [[ -z "${fm[$field_name]:-}" ]]; then
      echo "  $file:$line: missing required field '$field_name'"
      errors=$((errors+1))
    fi
  done
  [[ -z "$id" ]] && continue

  if ! [[ "$id" =~ ^[a-z0-9-]+-[a-z0-9]+-[0-9]{3}$ ]]; then
    echo "  $file:$line: id '$id' does not match {feature}-{stack}-NNN pattern"
    errors=$((errors+1))
  fi

  if ! [[ "$stack" =~ ^(go|web|e2e)$ ]]; then
    echo "  $file:$line: stack '$stack' must be one of: go, web, e2e"
    errors=$((errors+1))
  fi

  if [[ -n "$stack" ]]; then
    id_stack="$(echo "$id" | awk -F'-' '{print $(NF-1)}')"
    if [[ "$id_stack" != "$stack" ]]; then
      echo "  $file:$line: id stack segment '$id_stack' does not match stack field '$stack'"
      errors=$((errors+1))
    fi
    id_feature="$(echo "$id" | sed -E "s/-${stack}-[0-9]{3}$//")"
    if [[ -n "$feature" && "$id_feature" != "$feature" ]]; then
      echo "  $file:$line: id feature segment '$id_feature' does not match feature field '$feature'"
      errors=$((errors+1))
    fi
  fi

  if ! [[ "$status" =~ ^(pending|scaffolded|red|green|refactored|done)$ ]]; then
    echo "  $file:$line: status '$status' must be one of: pending, scaffolded, red, green, refactored, done"
    errors=$((errors+1))
  fi

  priority="${fm[priority]:-}"
  if [[ -n "$priority" ]] && ! [[ "$priority" =~ ^P[0-3]$ ]]; then
    echo "  $file:$line: priority '$priority' must be one of: P0, P1, P2, P3"
    errors=$((errors+1))
  fi

  group="${fm[group]:-}"
  if [[ -n "$group" ]] && ! [[ "$group" =~ ^[A-Z]$ ]]; then
    echo "  $file:$line: group '$group' must be a single uppercase letter"
    errors=$((errors+1))
  fi

  if [[ -n "$name" && "$name" != "${id}:"* ]]; then
    echo "  $file:$line: name must begin with '${id}: ' (got: '$name')"
    errors=$((errors+1))
  fi

  if [[ -n "${seen_ids[$id]:-}" ]]; then
    echo "  $file:$line: duplicate id '$id' (also at ${seen_ids[$id]})"
    errors=$((errors+1))
  else
    seen_ids[$id]="$file:$line"
  fi

  all_ids[$id]="$file:$line"

  if [[ -n "$refs" && "$refs" != "[]" ]]; then
    cleaned="$(echo "$refs" | tr -d ' "[]')"
    IFS=',' read -ra ref_array <<< "$cleaned"
    for ref in "${ref_array[@]}"; do
      [[ -z "$ref" ]] && continue
      all_refs+=("$file:$line|$ref")
    done
  fi

  unset fm

done < "$RAW"

# Second pass: validate references
for entry in "${all_refs[@]:-}"; do
  [[ -z "$entry" ]] && continue
  loc="${entry%%|*}"
  ref="${entry##*|}"
  if [[ -z "${all_ids[$ref]:-}" ]]; then
    echo "  $loc: references unknown id '$ref'"
    errors=$((errors+1))
  fi
done

if [[ $errors -gt 0 ]]; then
  echo ""
  echo "scenario-lint: $errors error(s) found"
  exit 1
fi

echo "scenario-lint: ok (${#all_ids[@]} scenarios validated)"
exit 0
