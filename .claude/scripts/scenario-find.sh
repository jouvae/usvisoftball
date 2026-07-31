#!/usr/bin/env bash
#
# scenario-find.sh - locate a scenario block by id.
#
# Usage:
#   scenario-find.sh <scenario-id>          # print file:line for that id
#   scenario-find.sh --feature <feature>    # list all scenarios for a feature
#   scenario-find.sh --stack <stack>        # list all scenarios for a stack
#   scenario-find.sh --status <status>      # list all scenarios with status

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [[ $# -eq 0 ]]; then
  echo "usage: scenario-find.sh <scenario-id> | --feature <name> | --stack <stack> | --status <status>" >&2
  exit 2
fi

mode="id"
target="$1"
case "$1" in
  --feature) mode="feature"; target="${2:-}" ;;
  --stack)   mode="stack";   target="${2:-}" ;;
  --status)  mode="status";  target="${2:-}" ;;
esac

if [[ -z "$target" ]]; then
  echo "usage: scenario-find.sh <scenario-id> | --feature <name> | --stack <stack> | --status <status>" >&2
  exit 2
fi

mapfile -t TEST_FILES < <(find . -type f \( -name '*_test.go' -o -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) -not -path './node_modules/*' -not -path './vendor/*')

for file in "${TEST_FILES[@]}"; do
  awk -v f="$file" -v mode="$mode" -v target="$target" '
    function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }

    /\/\*/ { if (!in_block) { in_block = 1; block_start = NR; in_fm = 0; fm_lines = 0; delete fm; next } }

    in_block && /\*\// {
      if (fm_lines > 0) {
        id       = (("id"       in fm) ? fm["id"]       : "")
        feature  = (("feature"  in fm) ? fm["feature"]  : "")
        stack    = (("stack"    in fm) ? fm["stack"]    : "")
        status   = (("status"   in fm) ? fm["status"]   : "")

        match_found = 0
        if      (mode == "id"      && id      == target) match_found = 1
        else if (mode == "feature" && feature == target) match_found = 1
        else if (mode == "stack"   && stack   == target) match_found = 1
        else if (mode == "status"  && status  == target) match_found = 1

        if (match_found) {
          printf("%s:%d  %s  [%s]\n", f, block_start, id, status)
        }
      }
      in_block = 0; in_fm = 0; fm_lines = 0; delete fm
      next
    }

    in_block {
      line = trim($0)
      if (line == "---") {
        if (in_fm == 0) { in_fm = 1; next }
        else            { in_fm = 2; next }
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
  ' "$file"
done
