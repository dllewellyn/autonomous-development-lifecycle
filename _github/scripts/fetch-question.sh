#!/bin/bash
set -euo pipefail

# Required environment variables:
# JULES_API_KEY
# GITHUB_OUTPUT (for setting output variables)
# GITHUB_ENV (for setting env variables)

BASE_URL="https://jules.googleapis.com/v1alpha"

SESSIONS_RESPONSE=$(curl -fsS -H "X-Goog-Api-Key: $JULES_API_KEY" "$BASE_URL/sessions?pageSize=100")
SESSION_NAME=$(echo "$SESSIONS_RESPONSE" | jq -e -r '
  if has("sessions") and (.sessions | type == "array") then
    (.sessions
      | map(select(.state == "AWAITING_USER_FEEDBACK"))
      | sort_by(.updateTime)
      | last
      | .name // empty)
  else
    error("Unexpected sessions response shape")
  end
')

if [ -z "$SESSION_NAME" ]; then
  echo "Error: no sessions awaiting user feedback found" >&2
  exit 1
fi

ACTIVITIES_RESPONSE=$(curl -fsS -H "X-Goog-Api-Key: $JULES_API_KEY" "$BASE_URL/${SESSION_NAME}/activities?pageSize=50")
QUESTION=$(echo "$ACTIVITIES_RESPONSE" | jq -e -r '
  if has("activities") and (.activities | type == "array") then
    (.activities
      | map(select(.agentMessaged.agentMessage != null))
      | sort_by(.createTime)
      | last
      | .agentMessaged.agentMessage // empty)
  else
    error("Unexpected activities response shape")
  end
')

if [ -z "$QUESTION" ]; then
  echo "Error: no agent message found for $SESSION_NAME" >&2
  exit 1
fi

# Determine delimiter for multiline output
DELIMITER="EOF_$(date +%s)"

{
  echo "question<<$DELIMITER"
  echo "$QUESTION"
  echo "$DELIMITER"
} >> "$GITHUB_OUTPUT"

{
  echo "BLOCKER_QUESTION<<$DELIMITER"
  echo "$QUESTION"
  echo "$DELIMITER"
} >> "$GITHUB_ENV"

echo "SESSION_NAME=$SESSION_NAME" >> "$GITHUB_ENV"
