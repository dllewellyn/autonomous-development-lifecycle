#!/bin/bash
set -euo pipefail

# Required environment variables:
# JULES_API_KEY

if [ -f .ralph-state.json ]; then
  CURRENT_ID=$(jq -r '.current_task_id // empty' .ralph-state.json)
  if [ -n "$CURRENT_ID" ] && [ "$CURRENT_ID" != "null" ]; then
     echo "Checking status of existing session: $CURRENT_ID"
     RESPONSE=$(curl -s -H "X-Goog-Api-Key: $JULES_API_KEY" "https://jules.googleapis.com/v1alpha/sessions/$CURRENT_ID")
     STATE=$(echo "$RESPONSE" | jq -r '.state // empty')
     
     if [[ "$STATE" == "QUEUED" || "$STATE" == "PLANNING" || "$STATE" == "IN_PROGRESS" || "$STATE" == "AWAITING_USER_FEEDBACK" ]]; then
       echo "Session $CURRENT_ID is still active ($STATE). Aborting new task."
       exit 1
     fi
     echo "Session $CURRENT_ID is in state: $STATE. Proceeding."
  fi
fi
