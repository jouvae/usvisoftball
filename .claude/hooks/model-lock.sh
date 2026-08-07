#!/usr/bin/env bash
# 3D hook — model-lock enforcement (PreToolUse: Edit|Write|MultiEdit).
# Blocks edits to a LOCKED model/IA artifact unless an approval flag is present.
# Wired in .claude/settings.json (PreToolUse: Edit|Write|MultiEdit).
#
# Source of truth: Supabase `models` — the locked path globs live in
# `models.locked_globs` (text[]) on rows where `locked = true`, set at lock time
# in the Design phase. This hook reads them via REST using a service key.
#
# Creds (gitignored, .claude/settings.local.json `env`): SUPABASE_URL +
# SUPABASE_SERVICE_KEY. SAFE NO-OP when unset — the lock simply does not enforce
# without provisioning (matches the other 3D flow hooks). FAIL-OPEN on any REST
# error/timeout so a network blip never blocks an edit.
#
# Approval override: env APPROVE_MODEL_EDIT=1 (an approved, human-instructed edit).
set -euo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')"
[ -z "$file" ] && exit 0

# Approved this session?
[ "${APPROVE_MODEL_EDIT:-0}" = "1" ] && exit 0

: "${SUPABASE_URL:=}"; : "${SUPABASE_SERVICE_KEY:=}"
[ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ] && exit 0   # unprovisioned → no-op

# Repo-relative path for glob matching (globs are stored repo-relative).
proj="${CLAUDE_PROJECT_DIR:-$PWD}"
rel="${file#"$proj"/}"

# Fetch the union of locked globs from all currently-locked models.
globs="$(curl -sf --max-time 3 -G "${SUPABASE_URL}/rest/v1/models" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  --data-urlencode "locked=eq.true" \
  --data-urlencode "select=locked_globs" 2>/dev/null \
  | jq -r '.[].locked_globs[]?' 2>/dev/null || true)"
[ -z "$globs" ] && exit 0   # nothing locked, or REST failed → fail-open (allow)

while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  case "$rel" in
    $pattern)
      echo "🔒 model-lock: '$rel' matches locked pattern '$pattern'. The Model+IA is LOCKED." >&2
      echo "Request explicit human instruction before changing a locked model, or set" >&2
      echo "APPROVE_MODEL_EDIT=1 for an approved edit. Editing it re-opens the model gate." >&2
      exit 2 ;;
  esac
done <<EOF
$globs
EOF
exit 0
