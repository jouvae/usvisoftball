#!/usr/bin/env bash
#
# eca-metrics.sh — compute the computable-now ECA success metrics by reading the
# feature directories under docs/features/. Definitions live in
# .opencode/metrics/eca-metrics.md. Emits a human-readable report and writes
# .claude/metrics/aggregated/eca-metrics.json.
#
# An "ECA feature" is any directory under docs/features/ that carries the ECA
# artifact set (overview.md + status.md + changelog.md), excluding _template and
# archive. Metrics that need a data source we don't yet have (tier-calibration:
# incident/rollback rate by tier) are reported as TODO(metric), never faked.
#
# Usage: bash .claude/scripts/eca-metrics.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FEATURES_DIR="$ROOT/docs/features"
OUT="$ROOT/.claude/metrics/aggregated/eca-metrics.json"
TODAY="$(date +%Y-%m-%d)"

# --- collect ECA feature dirs -------------------------------------------------
mapfile -t OVERVIEWS < <(find "$FEATURES_DIR" -type f -name overview.md \
  -not -path "*/_template/*" -not -path "*/archive/*" 2>/dev/null | sort)

total=0
declare -A tier_count=( [T1]=0 [T2]=0 [T3]=0 [unknown]=0 )
lessons_applied=0
escalated=0
killed=0
shipped=0
dcon_pass=0; dcon_seen=0
rtc_pass=0;  rtc_seen=0
rti_pass=0;  rti_seen=0
cycle_days_sum=0; cycle_days_n=0

json_features=""

for ov in "${OVERVIEWS[@]}"; do
  dir="$(dirname "$ov")"
  [[ -f "$dir/status.md" && -f "$dir/changelog.md" ]] || continue
  total=$((total+1))
  feat="${dir#"$FEATURES_DIR"/}"

  # tier (from overview.md "**Tier:**" line)
  tier="$(grep -m1 -E '\*\*Tier:\*\*' "$ov" 2>/dev/null | grep -oE 'T[123]' | head -1)"
  [[ -z "$tier" ]] && tier="unknown"
  tier_count[$tier]=$(( ${tier_count[$tier]:-0} + 1 ))

  # lessons applied (Research section: "Prior lessons applied:" not none/empty)
  la="$(grep -m1 -iE 'prior lessons applied' "$ov" 2>/dev/null | sed -E 's/.*applied:?\*{0,2}//I')"
  if echo "$la" | grep -qiE '[a-z0-9]' && ! echo "$la" | grep -qiE 'none|n/a|\{'; then
    lessons_applied=$((lessons_applied+1)); la_flag=true; else la_flag=false; fi

  # auto-escalation fired (triggers line has anything other than none/n/a/{...})
  esc="$(grep -m1 -iE 'auto-escalation triggers fired' "$ov" 2>/dev/null | sed -E 's/.*fired:?\*{0,2}//I')"
  if echo "$esc" | grep -qiE '[a-z]' && ! echo "$esc" | grep -qiE 'none|n/a|\{'; then
    escalated=$((escalated+1)); esc_flag=true; else esc_flag=false; fi

  # kill/pivot (changelog)
  if grep -qiE 'kill|invalidat|pivot|flop' "$dir/changelog.md" 2>/dev/null; then
    killed=$((killed+1)); kill_flag=true; else kill_flag=false; fi

  # shipped (status board or changelog)
  if grep -qiE 'shipped' "$dir/status.md" "$dir/changelog.md" 2>/dev/null; then
    shipped=$((shipped+1)); ship_flag=true; else ship_flag=false; fi

  # gate reports
  gate_dcon="n/a"; gate_rtc="n/a"; gate_rti="n/a"
  if [[ -f "$dir/dcon-report.md" ]]; then dcon_seen=$((dcon_seen+1))
    if grep -qiE 'dcon:\s*PASS' "$dir/dcon-report.md"; then dcon_pass=$((dcon_pass+1)); gate_dcon="PASS"; else gate_dcon="FAIL"; fi; fi
  if [[ -f "$dir/red-team-code-report.md" ]]; then rtc_seen=$((rtc_seen+1))
    if grep -qiE 'red-team-code:\s*PASS' "$dir/red-team-code-report.md"; then rtc_pass=$((rtc_pass+1)); gate_rtc="PASS"; else gate_rtc="BLOCKED"; fi; fi
  if [[ -f "$dir/red-team-interactive-report.md" ]]; then rti_seen=$((rti_seen+1))
    if grep -qiE 'red-team-interactive:\s*PASS' "$dir/red-team-interactive-report.md"; then rti_pass=$((rti_pass+1)); gate_rti="PASS"; else gate_rti="BLOCKED"; fi; fi

  # cycle time (first date in changelog → date on the line mentioning ship)
  first_date="$(grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' "$dir/changelog.md" 2>/dev/null | head -1)"
  ship_date="$(grep -iE 'ship' "$dir/changelog.md" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | tail -1)"
  cdays=""
  if [[ -n "$first_date" && -n "$ship_date" ]]; then
    s="$(date -d "$first_date" +%s 2>/dev/null)"; e="$(date -d "$ship_date" +%s 2>/dev/null)"
    if [[ -n "$s" && -n "$e" && "$e" -ge "$s" ]]; then
      cdays=$(( (e - s) / 86400 )); cycle_days_sum=$((cycle_days_sum+cdays)); cycle_days_n=$((cycle_days_n+1))
    fi
  fi

  json_features+="$(printf '{"feature":"%s","tier":"%s","lessons_applied":%s,"auto_escalated":%s,"killed":%s,"shipped":%s,"dcon":"%s","red_team_code":"%s","red_team_interactive":"%s","cycle_days":%s}' \
    "$feat" "$tier" "$la_flag" "$esc_flag" "$kill_flag" "$ship_flag" "$gate_dcon" "$gate_rtc" "$gate_rti" "${cdays:-null}"),"
done

pct() { local n=$1 d=$2; [[ "$d" -gt 0 ]] && awk "BEGIN{printf \"%.0f\", ($n/$d)*100}" || echo 0; }
avg_cycle="n/a"; [[ "$cycle_days_n" -gt 0 ]] && avg_cycle=$(awk "BEGIN{printf \"%.1f\", $cycle_days_sum/$cycle_days_n}")

# --- report -------------------------------------------------------------------
echo "== ECA metrics =="
echo "source: $FEATURES_DIR   features: $total"
echo
echo "-- North Star --"
echo "  Features by tier:        T1=${tier_count[T1]}  T2=${tier_count[T2]}  T3=${tier_count[T3]}  unknown=${tier_count[unknown]}"
echo "  Avg cycle time (days):   $avg_cycle  (triage→shipped, n=$cycle_days_n)"
echo "  Lessons-applied rate:    $(pct "$lessons_applied" "$total")%  ($lessons_applied/$total)"
echo "  Tier calibration:        TODO(metric): incident/rollback rate by tier — needs incident feed (LGTM + Fly rollback log)"
echo
echo "-- Phase-gate (Actualize) --"
echo "  dcon PASS:               $dcon_pass/$dcon_seen features with a dcon report"
echo "  red-team-code PASS:      $rtc_pass/$rtc_seen"
echo "  red-team-interactive:    $rti_pass/$rti_seen"
echo
echo "-- Supporting (diagnostics) --"
echo "  Auto-escalation hit:     $(pct "$escalated" "$total")%  ($escalated/$total)"
echo "  Prototype kill rate:     $(pct "$killed" "$total")%  ($killed/$total)   (healthy — a diagnostic, not a failure)"
echo "  Shipped:                 $shipped/$total"
echo
echo "Repeat-error rate lives in the learning loop — see: bash .claude/scripts/rule-stats.sh"

# --- json out -----------------------------------------------------------------
mkdir -p "$(dirname "$OUT")"
{
  printf '{\n  "updated": "%s",\n  "total_features": %s,\n' "$TODAY" "$total"
  printf '  "tier_count": {"T1": %s, "T2": %s, "T3": %s, "unknown": %s},\n' "${tier_count[T1]}" "${tier_count[T2]}" "${tier_count[T3]}" "${tier_count[unknown]}"
  printf '  "avg_cycle_days": %s,\n' "$([[ "$cycle_days_n" -gt 0 ]] && echo "$avg_cycle" || echo null)"
  printf '  "lessons_applied_rate_pct": %s,\n' "$(pct "$lessons_applied" "$total")"
  printf '  "auto_escalation_hit_pct": %s,\n' "$(pct "$escalated" "$total")"
  printf '  "prototype_kill_rate_pct": %s,\n' "$(pct "$killed" "$total")"
  printf '  "shipped": %s,\n' "$shipped"
  printf '  "gates": {"dcon_pass": %s, "dcon_seen": %s, "red_team_code_pass": %s, "red_team_code_seen": %s, "red_team_interactive_pass": %s, "red_team_interactive_seen": %s},\n' \
    "$dcon_pass" "$dcon_seen" "$rtc_pass" "$rtc_seen" "$rti_pass" "$rti_seen"
  printf '  "tier_calibration": "TODO(metric): incident/rollback rate by tier — needs incident feed",\n'
  printf '  "features": [%s]\n}\n' "${json_features%,}"
} > "$OUT"
echo
echo "wrote $OUT"
