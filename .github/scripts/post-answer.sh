#!/bin/bash
set -euo pipefail

# Required environment variables:
# JULES_API_KEY
# SESSION_NAME
# ANSWER_FILE (path to file containing the answer)

if [ -z "${SESSION_NAME:-}" ]; then
  echo "Error: SESSION_NAME is not set." >&2
  exit 1
fi

if [ ! -f "${ANSWER_FILE:-final_answer.txt}" ]; then
    echo "Error: Answer file not found." >&2
    exit 1
fi

BASE_URL="https://jules.googleapis.com/v1alpha"
ANSWER=$(cat "${ANSWER_FILE:-final_answer.txt}")

# Use jq to safely JSON encode the payload
PAYLOAD=$(jq -n --arg prompt "$ANSWER" '{prompt: $prompt}')

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "X-Goog-Api-Key: $JULES_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$BASE_URL/${SESSION_NAME}:sendMessage")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Posted answer to Jules"
else
  echo "Failed to post answer to Jules. HTTP Code: $HTTP_CODE"
  exit 1
fi
