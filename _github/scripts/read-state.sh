#!/bin/bash
set -e

# Read Ralph state and check if system should continue
if [ ! -f .ralph-state.json ]; then
  echo "Error: .ralph-state.json not found"
  exit 1
fi

STATUS=$(jq -r '.status' .ralph-state.json)
echo "status=$STATUS" >> $GITHUB_OUTPUT

if [ "$STATUS" = "stopped" ]; then
  echo "System is stopped. Terminating."
  exit 0
fi

echo "System status: $STATUS"
