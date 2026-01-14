#!/bin/bash
set -euo pipefail

# Required environment variables:
# GITHUB_TOKEN
# JULES_API_KEY
# REPO_OWNER
# REPO_NAME
# PR_NUMBER

if [ ! -f "audit_result.json" ]; then
  echo "Error: audit_result.json not found."
  exit 1
fi

VIOLATIONS=$(jq -r '.violations[]' audit_result.json | sed 's/^/- /')
COMMENT="## 🚨 Constitution Violation Detected

@jules The following violations were found:

$VIOLATIONS

Please address these issues before merging."

# 1. Post to PR
gh pr comment "$PR_NUMBER" --body "$COMMENT" --repo "$REPO_OWNER/$REPO_NAME"

# 2. Request changes
gh pr review "$PR_NUMBER" --request-changes --body "Constitution violations detected. See comments for details." --repo "$REPO_OWNER/$REPO_NAME"

# 3. Send feedback directly to Jules API
if [ -f .ralph-state.json ]; then
  SESSION_ID=$(jq -r '.current_task_id // empty' .ralph-state.json)
  
  if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "null" ]; then
    echo "Sending violation feedback to Jules Session: $SESSION_ID"
    
    JULES_MESSAGE="Constitution Violation Detected:

$VIOLATIONS

Please fix these issues immediately."

    jq -n --arg content "$JULES_MESSAGE" '{message: {content: $content}}' > jules_violation.json
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://jules.googleapis.com/v1alpha/sessions/$SESSION_ID:sendMessage" \
      -H "Content-Type: application/json" \
      -H "X-Goog-Api-Key: $JULES_API_KEY" \
      -d @jules_violation.json)
      
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
      echo "Successfully sent feedback to Jules API"
    else
      echo "Failed to send message to Jules. HTTP Code: $HTTP_CODE"
    fi
    rm jules_violation.json
  else
    echo "No active Jules session ID found in .ralph-state.json. Skipping API feedback."
  fi
fi
