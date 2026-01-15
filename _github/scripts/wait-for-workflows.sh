#!/bin/bash
set -euo pipefail

# Required environment variables:
# GITHUB_TOKEN
# JULES_API_KEY
# HEAD_SHA
# CURRENT_RUN_ID
# REPO_OWNER
# REPO_NAME
# PR_NUMBER

echo "Checking for other workflows on commit: $HEAD_SHA"

SLEEP_INTERVAL=30
TIMEOUT_SEC=$((15 * 60))
START_TIME=$(date +%s)

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  
  if [ "$ELAPSED" -gt "$TIMEOUT_SEC" ]; then
    echo "Timeout waiting for workflows."
    exit 1
  fi

  # List runs for the commit, excluding the current run
  RUNS_JSON=$(gh run list --commit "$HEAD_SHA" --json databaseId,name,status,conclusion,url --repo "$REPO_OWNER/$REPO_NAME")
  
  # Filter out current run
  OTHER_RUNS=$(echo "$RUNS_JSON" | jq --argjson current_id "$CURRENT_RUN_ID" '[.[] | select(.databaseId != $current_id)]')
  
  PENDING_RUNS=$(echo "$OTHER_RUNS" | jq '[.[] | select(.status == "queued" or .status == "in_progress" or .status == "waiting")]')
  PENDING_COUNT=$(echo "$PENDING_RUNS" | jq '. | length')

  if [ "$PENDING_COUNT" -eq 0 ]; then
    echo "All other workflows have completed."
    break
  fi

  PENDING_NAMES=$(echo "$PENDING_RUNS" | jq -r '.[].name' | paste -sd ", " -)
  echo "Waiting for $PENDING_COUNT workflow(s) to complete: $PENDING_NAMES"
  sleep "$SLEEP_INTERVAL"
done

# Check for failures
FAILED_RUNS=$(echo "$OTHER_RUNS" | jq '[.[] | select(.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out")]')
FAILED_COUNT=$(echo "$FAILED_RUNS" | jq '. | length')

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "Found $FAILED_COUNT failed workflow(s)."
  
  FAILURE_DETAILS=$(echo "$FAILED_RUNS" | jq -r '.[] | "- **\(.name)**: [View Log](\(.url))"' | paste -sd "\n" -)
  MESSAGE="## ❌ CI Checks Failed

The following workflows failed for this commit:

$FAILURE_DETAILS

Please fix the build/tests before merging."

  # Post comment to PR
  gh pr comment "$PR_NUMBER" --body "$MESSAGE" --repo "$REPO_OWNER/$REPO_NAME"

  # Send to Jules API
  if [ -f .ralph-state.json ]; then
    SESSION_ID=$(jq -r '.current_task_id // empty' .ralph-state.json)
    if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
      echo "Reporting failure to Jules Session: $SESSION_ID"
      
      JULES_MESSAGE="CI Checks Failed:

$FAILURE_DETAILS

Please investigate the logs and fix the errors."
      
      # Using a temporary file for the JSON payload to avoid quoting issues
      jq -n --arg content "$JULES_MESSAGE" '{message: {content: $content}}' > jules_payload.json
      
      curl -s -X POST "https://jules.googleapis.com/v1alpha/sessions/$SESSION_ID:sendMessage" \
        -H "Content-Type: application/json" \
        -H "X-Goog-Api-Key: $JULES_API_KEY" \
        -d @jules_payload.json
        
      rm jules_payload.json
    fi
  fi
  
  echo "Other workflows have failed. Blocking merge."
  exit 1
else
  echo "All other workflows passed."
fi
