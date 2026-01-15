#!/bin/bash
set -e

SESSION_ID="${1:-null}"

# Update .ralph-state.json to reflect that a task is now in progress
jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   --arg session_id "$SESSION_ID" \
   '.last_updated = $timestamp | .status = "started" | .current_task_id = (if $session_id == "null" or $session_id == "" then null else $session_id end)' \
   .ralph-state.json > .ralph-state.json.tmp
mv .ralph-state.json.tmp .ralph-state.json

echo "Ralph state updated successfully with Session ID: $SESSION_ID"
