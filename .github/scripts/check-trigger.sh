#!/bin/bash
set -e

# Check when the last update was and determine if we should trigger the Planner
LAST_UPDATED=$(jq -r '.last_updated' .ralph-state.json)
CURRENT_TIME=$(date -u +%s)
LAST_TIME=$(date -d "$LAST_UPDATED" +%s 2>/dev/null || echo "0")
TIME_DIFF=$((CURRENT_TIME - LAST_TIME))

# Trigger if more than 10 minutes since last update (task likely completed or needs new task)
if [ $TIME_DIFF -gt 600 ]; then
  echo "should_trigger=true" >> $GITHUB_OUTPUT
  echo "Time since last update: ${TIME_DIFF}s - triggering Planner"
else
  echo "should_trigger=false" >> $GITHUB_OUTPUT
  echo "Recent activity detected - waiting"
fi
