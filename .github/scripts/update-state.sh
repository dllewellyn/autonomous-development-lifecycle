#!/bin/bash
set -e

# Update .ralph-state.json to reflect that a task is now in progress
jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.last_updated = $timestamp | .status = "started"' \
   .ralph-state.json > .ralph-state.json.tmp
mv .ralph-state.json.tmp .ralph-state.json

echo "Ralph state updated successfully"
