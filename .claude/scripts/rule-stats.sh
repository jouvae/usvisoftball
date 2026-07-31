#!/usr/bin/env bash
# rule-stats.sh — learning-loop health report.
# Reads .claude/metrics/aggregated/rule-effectiveness.json and surfaces:
#   - INEFFECTIVE rules (recurrences_after > 0)  -> rewrite or gate them
#   - VALIDATED rules (binding & features_clean >= 3) -> graduate them
#   - RETIRED tombstones ready to delete
#   - per-agent rule counts vs the ~40 budget
# Usage: .claude/scripts/rule-stats.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FILE="$ROOT/.claude/metrics/aggregated/rule-effectiveness.json"

if [[ ! -f "$FILE" ]]; then
  echo "no rule-effectiveness.json at $FILE" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for rule-stats.sh" >&2
  exit 1
fi

echo "== Learning-loop rule health =="
echo "source: $FILE"
echo

echo "-- Status counts --"
jq -r '.rules | group_by(.status)[] | "\(.[0].status): \(length)"' "$FILE"
echo

echo "-- INEFFECTIVE (recurrences_after > 0 — rewrite the rule or escalate to a gate) --"
jq -r '.rules[] | select(.recurrences_after > 0)
        | "  \(.rule_id)  [\(.agent)]  recurred=\(.recurrences_after)  status=\(.status)"' "$FILE" \
  | grep . || echo "  none — all promoted rules are holding"
echo

echo "-- VALIDATED & ready to GRADUATE (binding, features_clean >= 3) --"
jq -r '.rules[] | select(.status=="binding" and .features_clean >= 3)
        | "  \(.rule_id)  [\(.agent)]  clean_features=\(.features_clean)  -> move to standard / gate"' "$FILE" \
  | grep . || echo "  none yet"
echo

echo "-- RETIRED tombstones (delete at next consolidation) --"
jq -r '.rules[] | select(.status=="retired") | "  \(.rule_id)  [\(.agent)]"' "$FILE" \
  | grep . || echo "  none"
echo

echo "-- Per-agent rule load (budget ~40 active records) --"
jq -r '.rules[] | select(.status!="retired") | .agent' "$FILE" \
  | sort | uniq -c | awk '{ flag=($1>40)?"  <-- OVER BUDGET":""; printf "  %-22s %3d%s\n", $2, $1, flag }'
echo

echo "Tip: run /improve --consolidate to dedup, retire, graduate, and gate rules."
