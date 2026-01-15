#!/bin/bash
set -euo pipefail

# Required environment variables:
# GITHUB_TOKEN
# REPO_OWNER
# REPO_NAME
# BLOCKED_COUNT

COUNT_LABEL="one or more"
if [[ "$BLOCKED_COUNT" =~ ^[0-9]+$ ]]; then
  COUNT_LABEL="$BLOCKED_COUNT"
fi

gh issue create \
  --title "Jules task blocked - manual intervention required" \
  --body "Heartbeat detected ${COUNT_LABEL} blocked task(s). Review Jules for details and restart the loop when ready." \
  --repo "$REPO_OWNER/$REPO_NAME"

echo "Created issue for blocked task"
