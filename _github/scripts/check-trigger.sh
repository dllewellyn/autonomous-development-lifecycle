#!/bin/bash
set -euo pipefail

: "${GITHUB_OUTPUT:?}"
: "${JULES_API_KEY:?}"

BASE_URL="https://jules.googleapis.com/v1alpha"
RESPONSE=$(curl -fsS -H "X-Goog-Api-Key: $JULES_API_KEY" "$BASE_URL/sessions?pageSize=100")

SESSIONS=$(echo "$RESPONSE" | jq -e -c '
  if type == "object" and has("sessions") and (.sessions | type == "array") then .sessions
  else error("Unexpected sessions response shape") end
')

if ! echo "$SESSIONS" | jq -e 'all(.[]; has("state"))' >/dev/null; then
  echo "Error: sessions response missing state fields" >&2
  exit 1
fi

STATUS=$(echo "$SESSIONS" | jq -r '
  map(.state) as $states |
  if any($states[]; . == "FAILED" or . == "PAUSED" or . == "AWAITING_PLAN_APPROVAL" or . == "STATE_UNSPECIFIED") then "blocked"
  elif any($states[]; . == "AWAITING_USER_FEEDBACK") then "waiting_for_input"
  elif any($states[]; . == "QUEUED" or . == "PLANNING" or . == "IN_PROGRESS") then "in_progress"
  else "none_active" end
')

BLOCKED_COUNT=$(echo "$SESSIONS" | jq '[.[] | select(.state == "FAILED" or .state == "PAUSED" or .state == "AWAITING_PLAN_APPROVAL" or .state == "STATE_UNSPECIFIED")] | length')

case "$STATUS" in
  blocked)
    echo "should_stop=true" >> "$GITHUB_OUTPUT"
    ;;
  waiting_for_input)
    echo "should_trigger_troubleshooter=true" >> "$GITHUB_OUTPUT"
    ;;
  none_active)
    echo "should_trigger_planner=true" >> "$GITHUB_OUTPUT"
    ;;
  in_progress)
    ;;
  *)
    echo "Error: unrecognized status \"$STATUS\"" >&2
    exit 1
    ;;
esac

echo "status=$STATUS" >> "$GITHUB_OUTPUT"
echo "blocked_count=$BLOCKED_COUNT" >> "$GITHUB_OUTPUT"
