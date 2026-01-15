#!/bin/bash
set -e

# Restart the loop by updating .ralph-state.json
jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.status = "started" | .current_task_id = null | .last_updated = $timestamp' \
   .ralph-state.json > .ralph-state.json.tmp
mv .ralph-state.json.tmp .ralph-state.json

echo "Loop restarted - ready for next task"
