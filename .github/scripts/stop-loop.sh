#!/bin/bash
set -euo pipefail

# Updates .ralph-state.json to stop the loop

jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.status = "stopped" | .last_updated = $timestamp' \
   .ralph-state.json > .ralph-state.json.tmp
mv .ralph-state.json.tmp .ralph-state.json
echo "Loop stopped due to blocked task(s)"

