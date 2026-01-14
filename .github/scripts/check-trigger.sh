#!/bin/bash
set -euo pipefail

: "${GITHUB_OUTPUT:?}"
: "${JULES_API_TOKEN:?}"
: "${REPO_OWNER:?}"
: "${REPO_NAME:?}"

API_URL="https://api.jules.ai/repos/${REPO_OWNER}/${REPO_NAME}/tasks"
RESPONSE=$(curl -fsS -H "Authorization: Bearer $JULES_API_TOKEN" "$API_URL")

TASKS=$(echo "$RESPONSE" | jq -e -c '
  if type == "array" then .
  elif type == "object" and has("tasks") and (.tasks | type == "array") then .tasks
  else error("Unexpected tasks response shape") end
')

if ! echo "$TASKS" | jq -e 'all(.[]; has("status"))' >/dev/null; then
  echo "Error: tasks response missing status fields" >&2
  exit 1
fi

STATUS=$(echo "$TASKS" | jq -r '
  map(.status) as $statuses |
  if any($statuses[]; . == "blocked") then "blocked"
  elif any($statuses[]; . == "waiting_for_input") then "waiting_for_input"
  elif any($statuses[]; . == "in_progress") then "in_progress"
  else "none_active" end
')

BLOCKED_COUNT=$(echo "$TASKS" | jq '[.[] | select(.status == "blocked")] | length')

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
